from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import requests
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date, timedelta
import bcrypt
import jwt
import base64
import aiofiles
from enum import Enum

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / 'uploads'
UPLOADS_DIR.mkdir(exist_ok=True)
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'clinic-emr-secret-key-2024')
JWT_ALGORITHM = "HS256"

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

# Object Storage (Emergent) — private file storage for attachments
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
STORAGE_APP_NAME = "private-clinic-emr"
_storage_key = None

def init_storage():
    """Initialize object storage session key once and reuse it."""
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key

def storage_put(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type or "application/octet-stream"},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def storage_get(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

app = FastAPI(title="Private Clinic EMR API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== ENUMS ==============
class UserRole(str, Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    RECEPTIONIST = "receptionist"

class QueueStatus(str, Enum):
    WAITING = "waiting"
    IN_CONSULTATION = "in_consultation"
    DONE = "done"
    NO_SHOW = "no_show"

class AttachmentTag(str, Enum):
    LAB = "lab"
    XRAY = "x-ray"
    ULTRASOUND = "ultrasound"
    ECG = "ecg"
    OTHER = "other"

# ============== MODELS ==============
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    license_no: Optional[str] = None
    ptr_no: Optional[str] = None
    prc_no: Optional[str] = None
    specialization: Optional[str] = None

class UserCreate(UserBase):
    password: str

class ReceptionistCreate(BaseModel):
    """Model for creating receptionist accounts - role is auto-set"""
    email: EmailStr
    full_name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    created_at: str
    is_active: bool = True

class PatientBase(BaseModel):
    full_name: str
    birthdate: str
    sex: str
    address: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: List[str] = []
    chronic_conditions: List[str] = []

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    birthdate: Optional[str] = None
    sex: Optional[str] = None
    address: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None

class PatientResponse(PatientBase):
    id: str
    patient_id: str
    age: int
    created_at: str
    updated_at: str

class Vitals(BaseModel):
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    heart_rate: Optional[int] = None
    respiratory_rate: Optional[int] = None
    temperature: Optional[float] = None
    spo2: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    bmi: Optional[float] = None

class VisitBase(BaseModel):
    patient_id: str
    vitals: Optional[Vitals] = None
    soap_subjective: Optional[str] = None
    soap_objective: Optional[str] = None
    soap_assessment: Optional[str] = None
    soap_plan: Optional[str] = None
    diagnosis_codes: List[str] = []
    follow_up_date: Optional[str] = None
    patient_instructions: Optional[str] = None
    warning_signs: Optional[str] = None

class VisitCreate(VisitBase):
    pass

class VisitUpdate(BaseModel):
    vitals: Optional[Vitals] = None
    soap_subjective: Optional[str] = None
    soap_objective: Optional[str] = None
    soap_assessment: Optional[str] = None
    soap_plan: Optional[str] = None
    diagnosis_codes: Optional[List[str]] = None
    follow_up_date: Optional[str] = None
    patient_instructions: Optional[str] = None
    warning_signs: Optional[str] = None
    created_at: Optional[str] = None

class VisitResponse(VisitBase):
    id: str
    created_by: str
    created_by_name: str
    created_at: str
    updated_at: str

class AppointmentBase(BaseModel):
    patient_id: str
    patient_name: str
    date: str
    time: str
    reason: Optional[str] = None
    status: QueueStatus = QueueStatus.WAITING
    vitals: Optional[Dict[str, Any]] = None  # Pre-recorded vitals

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[QueueStatus] = None
    vitals: Optional[Dict[str, Any]] = None

class AppointmentResponse(AppointmentBase):
    id: str
    created_at: str

class AttachmentBase(BaseModel):
    patient_id: str
    visit_id: Optional[str] = None
    filename: str
    tag: AttachmentTag = AttachmentTag.OTHER
    notes: Optional[str] = None

class AttachmentResponse(AttachmentBase):
    id: str
    file_data: str
    content_type: str
    uploaded_by: str
    uploaded_at: str

class PrescriptionBase(BaseModel):
    visit_id: str
    patient_id: str
    medications: List[Dict[str, Any]]
    notes: Optional[str] = None

class PrescriptionCreate(PrescriptionBase):
    pass

class PrescriptionResponse(PrescriptionBase):
    id: str
    created_by: str
    created_at: str

class CertificateBase(BaseModel):
    visit_id: str
    patient_id: str
    certificate_type: str  # medical_certificate, fit_to_work, referral
    content: Dict[str, Any]

class CertificateCreate(CertificateBase):
    pass

class CertificateResponse(CertificateBase):
    id: str
    created_by: str
    created_at: str

class LabRequestBase(BaseModel):
    visit_id: str
    patient_id: str
    request_type: str  # lab, imaging
    tests: List[Dict[str, Any]]  # [{name, instructions}]
    clinical_info: Optional[str] = None
    urgency: str = "routine"  # routine, urgent, stat

class LabRequestCreate(LabRequestBase):
    pass

class LabRequestResponse(LabRequestBase):
    id: str
    created_by: str
    created_at: str

class ClinicSettings(BaseModel):
    clinic_name: str = "Private Clinic EMR"
    address: str = ""
    phone: str = ""
    email: str = ""
    license_no: str = ""
    ptr_no: str = ""
    prc_no: str = ""
    specialization: str = ""
    logo_data: Optional[str] = None
    # Print Header customization
    print_header_title: str = ""
    print_header_subtitle: str = ""
    print_header_logo: str = ""
    print_header_extra: str = ""
    # OpenAI API Key for Whisper transcription
    openai_api_key: Optional[str] = None

class AIRequest(BaseModel):
    text: str
    request_type: str  # soap_convert, diagnosis_suggest, patient_instructions, full_consultation, icd10_code, drug_calculator, red_flag_check
    patient_context: Optional[Dict[str, Any]] = None  # For context-aware suggestions
    medications: Optional[List[str]] = None  # For drug interaction checks
    vitals: Optional[Dict[str, Any]] = None  # For red flag detection

class AIDraftCreate(BaseModel):
    patient_id: str
    clinical_notes: str
    ai_result: Dict[str, Any]
    red_flags: Optional[List[str]] = None

class AIDraftResponse(BaseModel):
    id: str
    patient_id: str
    clinical_notes: str
    ai_result: Dict[str, Any]
    red_flags: Optional[List[str]] = None
    owner_id: str
    created_by_name: str
    created_at: str

class AuditLog(BaseModel):
    id: str
    user_id: str
    user_name: str
    action: str
    entity_type: str
    entity_id: str
    details: Optional[str] = None
    timestamp: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

# In-memory rate limiting for password change attempts
password_change_attempts: Dict[str, Dict[str, Any]] = {}

# ============== HELPER FUNCTIONS ==============
def calculate_age(birthdate_str: str) -> int:
    try:
        birthdate = datetime.strptime(birthdate_str, "%Y-%m-%d").date()
        today = date.today()
        age = today.year - birthdate.year - ((today.month, today.day) < (birthdate.month, birthdate.day))
        return age
    except Exception:
        return 0

def generate_patient_id() -> str:
    return f"P{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:4].upper()}"

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def log_audit(user_id: str, user_name: str, action: str, entity_type: str, entity_id: str, details: str = None):
    log = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(log)

async def get_owner_id_for_user(current_user: dict) -> str:
    """
    Returns the owner_id to use for data queries.
    - For receptionist: returns the ID of the doctor who created them (created_by)
    - For others: returns their own ID
    """
    if current_user["role"] == "receptionist":
        # Receptionist sees data of the doctor who invited them
        return current_user.get("created_by", current_user["id"])
    return current_user["id"]

# ============== AUTH ROUTES ==============
@api_router.post("/auth/register")
async def register_user(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user.model_dump()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["password"] = hash_password(user.password)
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    user_dict["is_active"] = True
    
    await db.users.insert_one(user_dict)
    
    # Create token for auto-login after registration
    token = create_token(user_dict["id"], user_dict["role"])
    
    return {
        "token": token,
        "user": {
            "id": user_dict["id"],
            "email": user_dict["email"],
            "full_name": user_dict["full_name"],
            "role": user_dict["role"],
            "license_no": user_dict.get("license_no"),
            "ptr_no": user_dict.get("ptr_no"),
            "prc_no": user_dict.get("prc_no"),
            "specialization": user_dict.get("specialization")
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "license_no": user.get("license_no"),
            "ptr_no": user.get("ptr_no"),
            "prc_no": user.get("prc_no"),
            "specialization": user.get("specialization")
        }
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post("/account/change-password")
async def change_password(request: PasswordChangeRequest, current_user: dict = Depends(get_current_user)):
    """Change password for the authenticated user (doctors/admins)"""
    user_id = current_user["id"]
    
    # Rate limiting check
    now = datetime.now(timezone.utc)
    if user_id in password_change_attempts:
        attempts = password_change_attempts[user_id]
        # Check if locked out (5 failed attempts = 10 minute lockout)
        if attempts.get("lockout_until"):
            lockout_until = datetime.fromisoformat(attempts["lockout_until"])
            if now < lockout_until:
                remaining = int((lockout_until - now).total_seconds() / 60) + 1
                raise HTTPException(
                    status_code=429, 
                    detail=f"Too many failed attempts. Please try again in {remaining} minutes."
                )
            else:
                # Lockout expired, reset
                password_change_attempts[user_id] = {"count": 0, "lockout_until": None}
    
    # Validate new password
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    if request.new_password != request.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match")
    
    # Get current user with password
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(request.current_password, user["password"]):
        # Track failed attempt
        if user_id not in password_change_attempts:
            password_change_attempts[user_id] = {"count": 0, "lockout_until": None}
        
        password_change_attempts[user_id]["count"] += 1
        
        # Check if should lock out
        if password_change_attempts[user_id]["count"] >= 5:
            lockout_time = now + timedelta(minutes=10)
            password_change_attempts[user_id]["lockout_until"] = lockout_time.isoformat()
            raise HTTPException(
                status_code=429, 
                detail="Too many failed attempts. Account locked for 10 minutes."
            )
        
        remaining_attempts = 5 - password_change_attempts[user_id]["count"]
        raise HTTPException(
            status_code=400, 
            detail=f"Current password is incorrect. {remaining_attempts} attempts remaining."
        )
    
    # Check if new password is same as current
    if verify_password(request.new_password, user["password"]):
        raise HTTPException(status_code=400, detail="New password cannot be the same as current password")
    
    # Hash and update new password
    new_password_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "password": new_password_hash,
                "password_updated_at": now.isoformat()
            }
        }
    )
    
    # Clear rate limiting on success
    if user_id in password_change_attempts:
        del password_change_attempts[user_id]
    
    # Log the action (without exposing password)
    await log_audit(user_id, current_user["full_name"], "change_password", "user", user_id)
    
    return {"message": "Password changed successfully"}

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.post("/users/create-receptionist")
async def create_receptionist(user: ReceptionistCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors or admins can create receptionist accounts")
    
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user.model_dump()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["role"] = "receptionist"
    user_dict["password"] = hash_password(user_dict["password"])
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    user_dict["created_by"] = current_user["id"]
    user_dict["is_active"] = True
    
    await db.users.insert_one(user_dict)
    user_dict.pop("_id", None)
    user_dict.pop("password", None)
    await log_audit(current_user["id"], current_user["full_name"], "create", "receptionist", user_dict["id"], user_dict["full_name"])
    
    return {"message": "Receptionist account created", "id": user_dict["id"], "full_name": user_dict["full_name"]}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    # Admin can update any user
    # Doctors can update their own receptionists
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_own_receptionist = (
        target_user.get("role") == "receptionist" and 
        target_user.get("created_by") == current_user["id"]
    )
    
    if current_user["role"] != "admin" and current_user["id"] != user_id and not is_own_receptionist:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Handle password update
    if "password" in updates and updates["password"]:
        updates["password"] = hash_password(updates["password"])
    else:
        updates.pop("password", None)  # Don't update password if empty
    
    # Remove fields that shouldn't be updated
    updates.pop("id", None)
    updates.pop("created_by", None)
    updates.pop("created_at", None)
    
    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
    
    await log_audit(current_user["id"], current_user["full_name"], "update", "user", user_id)
    return {"message": "User updated"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    # Admin can delete any user (except themselves)
    # Doctors can delete their own receptionists
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_own_receptionist = (
        target_user.get("role") == "receptionist" and 
        target_user.get("created_by") == current_user["id"]
    )
    
    if current_user["role"] != "admin" and not is_own_receptionist:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    await db.users.delete_one({"id": user_id})
    await log_audit(current_user["id"], current_user["full_name"], "delete", "user", user_id, target_user.get("email"))
    return {"message": "User deleted"}

@api_router.get("/users/my-receptionists")
async def get_my_receptionists(current_user: dict = Depends(get_current_user)):
    """Get receptionists created by the current doctor"""
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can have receptionists")
    
    receptionists = await db.users.find(
        {"role": "receptionist", "created_by": current_user["id"]},
        {"_id": 0, "password": 0}
    ).to_list(100)
    return receptionists

# ============== PATIENT ROUTES ==============
@api_router.post("/patients", response_model=PatientResponse)
async def create_patient(patient: PatientCreate, current_user: dict = Depends(get_current_user)):
    # Receptionist creates patient under their doctor's ownership
    owner_id = await get_owner_id_for_user(current_user)
    
    patient_dict = patient.model_dump()
    patient_dict["id"] = str(uuid.uuid4())
    patient_dict["patient_id"] = generate_patient_id()
    patient_dict["age"] = calculate_age(patient.birthdate)
    patient_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    patient_dict["updated_at"] = patient_dict["created_at"]
    patient_dict["owner_id"] = owner_id  # Data isolation: track owner (doctor)
    patient_dict["created_by"] = current_user["id"]  # Track who actually created
    
    await db.patients.insert_one(patient_dict)
    await log_audit(current_user["id"], current_user["full_name"], "create", "patient", patient_dict["id"], patient.full_name)
    
    patient_dict.pop("_id", None)
    return patient_dict

@api_router.get("/patients", response_model=List[PatientResponse])
async def get_patients(
    search: Optional[str] = None,
    limit: int = Query(default=10000, le=10000),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    # Receptionist sees patients of their doctor; others only their own
    owner_id = await get_owner_id_for_user(current_user)
    query = {"owner_id": owner_id}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}},
            {"patient_id": {"$regex": search, "$options": "i"}}
        ]
    
    patients = await db.patients.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    # Recalculate ages
    for p in patients:
        p["age"] = calculate_age(p.get("birthdate", ""))
    return patients

@api_router.get("/patients/{patient_id}", response_model=PatientResponse)
async def get_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    owner_id = await get_owner_id_for_user(current_user)
    patient = await db.patients.find_one({"id": patient_id, "owner_id": owner_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient["age"] = calculate_age(patient.get("birthdate", ""))
    return patient

@api_router.put("/patients/{patient_id}", response_model=PatientResponse)
async def update_patient(patient_id: str, updates: PatientUpdate, current_user: dict = Depends(get_current_user)):
    # Data isolation: verify ownership (receptionist can update their doctor's patients)
    owner_id = await get_owner_id_for_user(current_user)
    patient = await db.patients.find_one({"id": patient_id, "owner_id": owner_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if "birthdate" in update_dict:
        update_dict["age"] = calculate_age(update_dict["birthdate"])
    
    await db.patients.update_one({"id": patient_id, "owner_id": owner_id}, {"$set": update_dict})
    await log_audit(current_user["id"], current_user["full_name"], "update", "patient", patient_id)
    
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    patient["age"] = calculate_age(patient.get("birthdate", ""))
    return patient

@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Data isolation: only delete own patients
    result = await db.patients.delete_one({"id": patient_id, "owner_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Also delete related data
    await db.visits.delete_many({"patient_id": patient_id})
    await db.appointments.delete_many({"patient_id": patient_id})
    await db.prescriptions.delete_many({"patient_id": patient_id})
    await db.certificates.delete_many({"patient_id": patient_id})
    await db.attachments.delete_many({"patient_id": patient_id})
    
    await log_audit(current_user["id"], current_user["full_name"], "delete", "patient", patient_id)
    return {"message": "Patient deleted"}

# Helper function to verify patient ownership
async def verify_patient_ownership(patient_id: str, user_id: str) -> bool:
    patient = await db.patients.find_one({"id": patient_id, "owner_id": user_id})
    return patient is not None

async def verify_patient_access(patient_id: str, current_user: dict) -> bool:
    """Receptionist can access their doctor's patients; others only their own."""
    owner_id = await get_owner_id_for_user(current_user)
    return await verify_patient_ownership(patient_id, owner_id)

# ============== VISIT ROUTES ==============
@api_router.post("/visits", response_model=VisitResponse)
async def create_visit(visit: VisitCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can create visits")
    
    # Data isolation: verify patient belongs to current user
    if not await verify_patient_ownership(visit.patient_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="Patient not found")
    
    visit_dict = visit.model_dump()
    visit_dict["id"] = str(uuid.uuid4())
    visit_dict["created_by"] = current_user["id"]
    visit_dict["created_by_name"] = current_user["full_name"]
    visit_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    visit_dict["updated_at"] = visit_dict["created_at"]
    
    # Calculate BMI if weight and height provided
    if visit_dict.get("vitals"):
        vitals = visit_dict["vitals"]
        if vitals.get("weight") and vitals.get("height"):
            height_m = vitals["height"] / 100
            vitals["bmi"] = round(vitals["weight"] / (height_m * height_m), 1)
    
    await db.visits.insert_one(visit_dict)
    await log_audit(current_user["id"], current_user["full_name"], "create", "visit", visit_dict["id"])
    
    visit_dict.pop("_id", None)
    return visit_dict

@api_router.get("/visits", response_model=List[VisitResponse])
async def get_visits(
    patient_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "receptionist":
        raise HTTPException(status_code=403, detail="Receptionists cannot access visit records")
    # Data isolation: only get visits for patients owned by current user
    owned_patients = await db.patients.find({"owner_id": current_user["id"]}, {"id": 1}).to_list(length=None)
    owned_patient_ids = [p["id"] for p in owned_patients]
    
    query = {"patient_id": {"$in": owned_patient_ids}}
    if patient_id:
        if patient_id not in owned_patient_ids:
            return []
        query["patient_id"] = patient_id
    
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        query["created_at"] = date_query
    
    visits = await db.visits.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return visits

@api_router.get("/visits/{visit_id}", response_model=VisitResponse)
async def get_visit(visit_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "receptionist":
        raise HTTPException(status_code=403, detail="Receptionists cannot access visit records")
    visit = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    # Data isolation: verify patient ownership
    if not await verify_patient_ownership(visit["patient_id"], current_user["id"]):
        raise HTTPException(status_code=404, detail="Visit not found")
    
    return visit

@api_router.put("/visits/{visit_id}", response_model=VisitResponse)
async def update_visit(visit_id: str, updates: VisitUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can update visits")
    
    # Data isolation: verify ownership
    visit = await db.visits.find_one({"id": visit_id})
    if not visit or not await verify_patient_ownership(visit["patient_id"], current_user["id"]):
        raise HTTPException(status_code=404, detail="Visit not found")
    
    update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Recalculate BMI if vitals updated
    if "vitals" in update_dict and update_dict["vitals"]:
        vitals = update_dict["vitals"]
        if isinstance(vitals, dict) and vitals.get("weight") and vitals.get("height"):
            height_m = vitals["height"] / 100
            vitals["bmi"] = round(vitals["weight"] / (height_m * height_m), 1)
    
    await db.visits.update_one({"id": visit_id}, {"$set": update_dict})
    await log_audit(current_user["id"], current_user["full_name"], "update", "visit", visit_id)
    
    visit = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    return visit

@api_router.delete("/visits/{visit_id}")
async def delete_visit(visit_id: str, current_user: dict = Depends(get_current_user)):
    visit = await db.visits.find_one({"id": visit_id})
    if not visit or not await verify_patient_ownership(visit["patient_id"], current_user["id"]):
        raise HTTPException(status_code=404, detail="Visit not found")
    
    await db.visits.delete_one({"id": visit_id})
    await db.prescriptions.delete_many({"visit_id": visit_id})
    await db.certificates.delete_many({"visit_id": visit_id})
    await log_audit(current_user["id"], current_user["full_name"], "delete", "visit", visit_id)
    
    return {"message": "Visit deleted"}

# ============== APPOINTMENT ROUTES ==============
@api_router.post("/appointments", response_model=AppointmentResponse)
async def create_appointment(appointment: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    if not await verify_patient_access(appointment.patient_id, current_user):
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Receptionist creates appointment under their doctor's name
    owner_id = await get_owner_id_for_user(current_user)
    
    apt_dict = appointment.model_dump()
    apt_dict["id"] = str(uuid.uuid4())
    apt_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    apt_dict["owner_id"] = owner_id
    apt_dict["created_by"] = current_user["id"]  # Track who actually created it
    
    await db.appointments.insert_one(apt_dict)
    apt_dict.pop("_id", None)
    return apt_dict

@api_router.get("/appointments", response_model=List[AppointmentResponse])
async def get_appointments(
    date: Optional[str] = None,
    status: Optional[QueueStatus] = None,
    limit: int = Query(default=100, le=500),
    current_user: dict = Depends(get_current_user)
):
    # Receptionist sees appointments of their doctor; others only their own
    owner_id = await get_owner_id_for_user(current_user)
    query = {"owner_id": owner_id}
    if date:
        query["date"] = date
    if status:
        query["status"] = status.value
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort([("date", 1), ("time", 1)]).limit(limit).to_list(limit)
    return appointments

@api_router.get("/appointments/today", response_model=List[AppointmentResponse])
async def get_today_appointments(
    local_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Use client's local date if provided, otherwise fall back to server date
    today = local_date if local_date else date.today().isoformat()
    owner_id = await get_owner_id_for_user(current_user)
    appointments = await db.appointments.find({"date": today, "owner_id": owner_id}, {"_id": 0}).sort("time", 1).to_list(100)
    return appointments

@api_router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(appointment_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single appointment by ID"""
    owner_id = await get_owner_id_for_user(current_user)
    appointment = await db.appointments.find_one(
        {"id": appointment_id, "owner_id": owner_id},
        {"_id": 0}
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment

@api_router.get("/queue/today", response_model=List[AppointmentResponse])
async def get_today_queue(
    local_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Use client's local date if provided, otherwise fall back to server date
    today = local_date if local_date else date.today().isoformat()
    # Receptionist sees queue of their doctor; others only their own
    owner_id = await get_owner_id_for_user(current_user)
    appointments = await db.appointments.find(
        {"date": today, "status": {"$in": ["waiting", "in_consultation"]}, "owner_id": owner_id},
        {"_id": 0}
    ).sort("time", 1).to_list(100)
    return appointments

@api_router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(appointment_id: str, updates: AppointmentUpdate, current_user: dict = Depends(get_current_user)):
    # Receptionist can update their doctor's appointments
    owner_id = await get_owner_id_for_user(current_user)
    apt = await db.appointments.find_one({"id": appointment_id, "owner_id": owner_id})
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    update_dict = {k: v.value if isinstance(v, Enum) else v for k, v in updates.model_dump().items() if v is not None}
    
    await db.appointments.update_one({"id": appointment_id, "owner_id": owner_id}, {"$set": update_dict})
    
    apt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    return apt

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, current_user: dict = Depends(get_current_user)):
    # Receptionist can delete their doctor's appointments
    owner_id = await get_owner_id_for_user(current_user)
    result = await db.appointments.delete_one({"id": appointment_id, "owner_id": owner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"message": "Appointment deleted"}

# ============== ATTACHMENT ROUTES ==============
@api_router.post("/attachments")
async def upload_attachment(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    visit_id: Optional[str] = Form(None),
    tag: str = Form("other"),
    notes: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    # Data isolation: verify patient ownership
    if not await verify_patient_ownership(patient_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Generate unique object path and upload to object storage
    attachment_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix if file.filename else ''
    owner_id = await get_owner_id_for_user(current_user)
    storage_path = f"{STORAGE_APP_NAME}/attachments/{owner_id}/{attachment_id}{file_ext}"

    content = await file.read()
    put_result = storage_put(storage_path, content, file.content_type or "application/octet-stream")

    attachment = {
        "id": attachment_id,
        "patient_id": patient_id,
        "visit_id": visit_id,
        "filename": file.filename,
        "storage_path": put_result.get("path", storage_path),  # Object storage key
        "content_type": file.content_type,
        "file_size": len(content),
        "tag": tag,
        "notes": notes,
        "uploaded_by": current_user["id"],
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.attachments.insert_one(attachment)
    await log_audit(current_user["id"], current_user["full_name"], "upload", "attachment", attachment["id"], file.filename)
    
    attachment.pop("_id", None)
    return attachment

@api_router.get("/attachments")
async def get_attachments(
    patient_id: Optional[str] = None,
    visit_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Data isolation: receptionist accesses their doctor's patients only
    owner_id = await get_owner_id_for_user(current_user)
    if patient_id and not await verify_patient_ownership(patient_id, owner_id):
        return []
    
    query = {}
    if patient_id:
        query["patient_id"] = patient_id
    if visit_id:
        query["visit_id"] = visit_id
    
    # If no patient_id specified, scope to accessible patients
    if not patient_id:
        owned_patients = await db.patients.find({"owner_id": owner_id}, {"id": 1}).to_list(length=None)
        owned_patient_ids = [p["id"] for p in owned_patients]
        query["patient_id"] = {"$in": owned_patient_ids}
    
    attachments = await db.attachments.find(query, {"_id": 0}).sort("uploaded_at", -1).to_list(100)
    return attachments

@api_router.get("/attachments/{attachment_id}")
async def get_attachment(attachment_id: str, current_user: dict = Depends(get_current_user)):
    """Get attachment metadata"""
    attachment = await db.attachments.find_one({"id": attachment_id}, {"_id": 0})
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Data isolation: verify patient ownership (receptionist uses doctor's owner_id)
    owner_id = await get_owner_id_for_user(current_user)
    if not await verify_patient_ownership(attachment["patient_id"], owner_id):
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    return attachment

@api_router.get("/attachments/{attachment_id}/file")
async def get_attachment_file(attachment_id: str, current_user: dict = Depends(get_current_user)):
    """Download/view the actual file"""
    attachment = await db.attachments.find_one({"id": attachment_id})
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Data isolation: verify patient ownership
    owner_id = await get_owner_id_for_user(current_user)
    if not await verify_patient_ownership(attachment["patient_id"], owner_id):
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # New system: object storage
    storage_path = attachment.get("storage_path")
    if storage_path:
        try:
            content, ct = storage_get(storage_path)
        except Exception as e:
            logger.error(f"Storage fetch failed for {storage_path}: {e}")
            raise HTTPException(status_code=404, detail="File not found")
        return Response(
            content=content,
            media_type=attachment.get("content_type") or ct,
            headers={"Content-Disposition": f"inline; filename={attachment.get('filename', 'file')}"}
        )

    # Legacy: local disk file
    stored_filename = attachment.get("stored_filename")
    if stored_filename:
        file_path = UPLOADS_DIR / stored_filename
        if file_path.exists():
            return FileResponse(
                path=file_path,
                filename=attachment.get("filename", stored_filename),
                media_type=attachment.get("content_type", "application/octet-stream")
            )
    
    # Fallback for old base64 data (legacy support)
    file_data = attachment.get("file_data")
    if file_data:
        import io
        from starlette.responses import StreamingResponse
        content = base64.b64decode(file_data)
        return StreamingResponse(
            io.BytesIO(content),
            media_type=attachment.get("content_type", "application/octet-stream"),
            headers={"Content-Disposition": f"inline; filename={attachment.get('filename', 'file')}"}
        )
    
    raise HTTPException(status_code=404, detail="File not found")

class AttachmentUpdate(BaseModel):
    filename: Optional[str] = None
    tag: Optional[str] = None
    notes: Optional[str] = None
    visit_id: Optional[str] = None

@api_router.put("/attachments/{attachment_id}")
async def update_attachment(attachment_id: str, updates: AttachmentUpdate, current_user: dict = Depends(get_current_user)):
    attachment = await db.attachments.find_one({"id": attachment_id})
    owner_id = await get_owner_id_for_user(current_user)
    if not attachment or not await verify_patient_ownership(attachment["patient_id"], owner_id):
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.attachments.update_one({"id": attachment_id}, {"$set": update_dict})
    await log_audit(current_user["id"], current_user["full_name"], "update", "attachment", attachment_id, updates.filename)
    
    updated = await db.attachments.find_one({"id": attachment_id}, {"_id": 0, "file_data": 0})
    return updated

@api_router.delete("/attachments/{attachment_id}")
async def delete_attachment(attachment_id: str, current_user: dict = Depends(get_current_user)):
    attachment = await db.attachments.find_one({"id": attachment_id})
    owner_id = await get_owner_id_for_user(current_user)
    if not attachment or not await verify_patient_ownership(attachment["patient_id"], owner_id):
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Delete file from disk if it exists
    stored_filename = attachment.get("stored_filename")
    if stored_filename:
        file_path = UPLOADS_DIR / stored_filename
        if file_path.exists():
            file_path.unlink()
    
    await db.attachments.delete_one({"id": attachment_id})
    await log_audit(current_user["id"], current_user["full_name"], "delete", "attachment", attachment_id)
    return {"message": "Attachment deleted"}

# ============== PRESCRIPTION ROUTES ==============
@api_router.post("/prescriptions", response_model=PrescriptionResponse)
async def create_prescription(prescription: PrescriptionCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can create prescriptions")
    
    # Data isolation: verify patient ownership
    if not await verify_patient_ownership(prescription.patient_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="Patient not found")
    
    rx_dict = prescription.model_dump()
    rx_dict["id"] = str(uuid.uuid4())
    rx_dict["created_by"] = current_user["id"]
    rx_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.prescriptions.insert_one(rx_dict)
    rx_dict.pop("_id", None)
    return rx_dict

@api_router.get("/prescriptions")
async def get_prescriptions(
    patient_id: Optional[str] = None,
    visit_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "receptionist":
        return []
    if patient_id and not await verify_patient_ownership(patient_id, current_user["id"]):
        return []
    
    query = {}
    if patient_id:
        query["patient_id"] = patient_id
    if visit_id:
        query["visit_id"] = visit_id
    
    # If no patient_id specified, only return prescriptions for owned patients
    if not patient_id:
        owned_patients = await db.patients.find({"owner_id": current_user["id"]}, {"id": 1}).to_list(length=None)
        owned_patient_ids = [p["id"] for p in owned_patients]
        query["patient_id"] = {"$in": owned_patient_ids}
    
    prescriptions = await db.prescriptions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return prescriptions

@api_router.delete("/prescriptions/{prescription_id}")
async def delete_prescription(prescription_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can delete prescriptions")
    
    # Verify ownership through patient
    prescription = await db.prescriptions.find_one({"id": prescription_id})
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if not await verify_patient_ownership(prescription["patient_id"], current_user["id"]):
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    await db.prescriptions.delete_one({"id": prescription_id})
    await log_audit(current_user["id"], current_user["full_name"], "delete", "prescription", prescription_id)
    return {"message": "Prescription deleted"}

# ============== CERTIFICATE ROUTES ==============
@api_router.post("/certificates", response_model=CertificateResponse)
async def create_certificate(certificate: CertificateCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can create certificates")
    
    # Data isolation: verify patient ownership
    if not await verify_patient_ownership(certificate.patient_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="Patient not found")
    
    cert_dict = certificate.model_dump()
    cert_dict["id"] = str(uuid.uuid4())
    cert_dict["created_by"] = current_user["id"]
    cert_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.certificates.insert_one(cert_dict)
    cert_dict.pop("_id", None)
    return cert_dict

@api_router.get("/certificates")
async def get_certificates(
    patient_id: Optional[str] = None,
    visit_id: Optional[str] = None,
    certificate_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "receptionist":
        return []
    if patient_id and not await verify_patient_ownership(patient_id, current_user["id"]):
        return []
    
    query = {}
    if patient_id:
        query["patient_id"] = patient_id
    if visit_id:
        query["visit_id"] = visit_id
    if certificate_type:
        query["certificate_type"] = certificate_type
    
    # If no patient_id specified, only return certificates for owned patients
    if not patient_id:
        owned_patients = await db.patients.find({"owner_id": current_user["id"]}, {"id": 1}).to_list(length=None)
        owned_patient_ids = [p["id"] for p in owned_patients]
        query["patient_id"] = {"$in": owned_patient_ids}
    
    certificates = await db.certificates.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return certificates

@api_router.delete("/certificates/{certificate_id}")
async def delete_certificate(certificate_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can delete certificates")
    
    # Verify ownership through patient
    certificate = await db.certificates.find_one({"id": certificate_id})
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    if not await verify_patient_ownership(certificate["patient_id"], current_user["id"]):
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    await db.certificates.delete_one({"id": certificate_id})
    await log_audit(current_user["id"], current_user["full_name"], "delete", "certificate", certificate_id)
    return {"message": "Certificate deleted"}

# ============== LAB REQUEST ROUTES ==============
@api_router.post("/lab-requests", response_model=LabRequestResponse)
async def create_lab_request(request: LabRequestCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can create lab requests")
    
    # Data isolation: verify patient ownership
    if not await verify_patient_ownership(request.patient_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="Patient not found")
    
    req_dict = request.model_dump()
    req_dict["id"] = str(uuid.uuid4())
    req_dict["created_by"] = current_user["id"]
    req_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.lab_requests.insert_one(req_dict)
    req_dict.pop("_id", None)
    return req_dict

@api_router.get("/lab-requests")
async def get_lab_requests(
    patient_id: Optional[str] = None,
    visit_id: Optional[str] = None,
    request_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "receptionist":
        return []
    if patient_id and not await verify_patient_ownership(patient_id, current_user["id"]):
        return []
    
    query = {}
    if patient_id:
        query["patient_id"] = patient_id
    if visit_id:
        query["visit_id"] = visit_id
    if request_type:
        query["request_type"] = request_type
    
    # If no patient_id specified, only return requests for owned patients
    if not patient_id:
        owned_patients = await db.patients.find({"owner_id": current_user["id"]}, {"id": 1}).to_list(length=None)
        owned_patient_ids = [p["id"] for p in owned_patients]
        query["patient_id"] = {"$in": owned_patient_ids}
    
    lab_requests = await db.lab_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return lab_requests

@api_router.delete("/lab-requests/{request_id}")
async def delete_lab_request(request_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can delete lab requests")
    
    # Verify ownership through patient
    lab_request = await db.lab_requests.find_one({"id": request_id})
    if not lab_request:
        raise HTTPException(status_code=404, detail="Lab request not found")
    
    if not await verify_patient_ownership(lab_request["patient_id"], current_user["id"]):
        raise HTTPException(status_code=404, detail="Lab request not found")
    
    await db.lab_requests.delete_one({"id": request_id})
    await log_audit(current_user["id"], current_user["full_name"], "delete", "lab_request", request_id)
    return {"message": "Lab request deleted"}

# ============== CLINIC SETTINGS ==============
@api_router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"owner_id": current_user["id"]}, {"_id": 0})
    if not settings:
        # Pre-fill with the user's signup data
        settings = ClinicSettings(
            clinic_name=current_user.get("full_name", ""),
            email=current_user.get("email", ""),
            license_no=current_user.get("license_no", "") or "",
            ptr_no=current_user.get("ptr_no", "") or "",
            prc_no=current_user.get("prc_no", "") or "",
            specialization=current_user.get("specialization", "") or "",
        ).model_dump()
    # Never expose the full API key — return masked version
    raw_key = settings.get("openai_api_key") or OPENAI_API_KEY or ""
    if raw_key and len(raw_key) > 8:
        settings["openai_api_key_masked"] = raw_key[:5] + "..." + raw_key[-4:]
    else:
        settings["openai_api_key_masked"] = ""
    settings.pop("openai_api_key", None)
    return settings

@api_router.put("/settings")
async def update_settings(settings: ClinicSettings, current_user: dict = Depends(get_current_user)):
    update_data = settings.model_dump()
    # If openai_api_key is empty/None, preserve the existing key in DB
    if not update_data.get("openai_api_key"):
        existing = await db.settings.find_one({"owner_id": current_user["id"]}, {"_id": 0, "openai_api_key": 1})
        if existing and existing.get("openai_api_key"):
            update_data["openai_api_key"] = existing["openai_api_key"]
    await db.settings.update_one(
        {"owner_id": current_user["id"]},
        {"$set": {**update_data, "owner_id": current_user["id"]}},
        upsert=True
    )
    await log_audit(current_user["id"], current_user["full_name"], "update", "settings", "clinic")
    return {"message": "Settings updated"}

# ============== AI ROUTES ==============
@api_router.post("/ai/assist")
async def ai_assist(request: AIRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can use AI features")
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        system_prompts = {
            "soap_convert": """You are a medical documentation assistant. Convert the provided clinical notes into a structured SOAP format:
S (Subjective): Patient's complaints, history of present illness, review of systems
O (Objective): Physical examination findings, vital signs observations
A (Assessment): Diagnosis or differential diagnoses
P (Plan): Treatment plan, medications, follow-up

Be concise and professional. Use medical terminology appropriately.""",
            
            "diagnosis_suggest": """You are a clinical decision support assistant. Based on the provided symptoms and findings, suggest possible differential diagnoses. 
IMPORTANT: These are suggestions only and must be verified by the attending physician.
List diagnoses in order of likelihood with brief reasoning.""",
            
            "patient_instructions": """You are a patient education assistant. Convert the medical instructions into simple, easy-to-understand language for the patient.
Include:
- What to do (medications, diet, activity)
- Warning signs to watch for
- When to return or seek emergency care
Use simple words, avoid medical jargon.""",

            "full_consultation": """You are an AI clinical decision support system for physicians. Based on the brief clinical notes provided, generate a comprehensive consultation response in JSON format:

{
  "soap": {
    "subjective": "Patient's complaints and history",
    "objective": "Physical examination findings based on the notes",
    "assessment": "Primary diagnosis with differential diagnoses",
    "plan": "Treatment plan with specific recommendations"
  },
  "diagnoses": [
    {"name": "Primary Diagnosis", "icd10": "ICD-10 code", "confidence": "high/medium/low", "reasoning": "brief explanation"}
  ],
  "medications": [
    {"name": "Drug name", "dose": "Recommended dose", "frequency": "Dosing frequency", "duration": "Treatment duration", "notes": "Special instructions"}
  ],
  "follow_up": {
    "timeline": "When to follow up",
    "instructions": "What to monitor",
    "red_flags": ["Warning signs to watch for"]
  },
  "icd10_codes": ["List of relevant ICD-10 codes"]
}

IMPORTANT: These are AI suggestions only. All clinical decisions must be verified by the attending physician. Consider patient allergies, contraindications, and individual factors.""",

            "icd10_code": """You are a medical coding assistant. Based on the diagnosis or clinical description provided, suggest appropriate ICD-10-CM codes.
Format your response as:
- Primary code: [CODE] - [Description]
- Related codes: [CODE] - [Description]
Include the most specific code applicable.""",

            "drug_calculator": """You are a clinical pharmacology assistant. Calculate the appropriate drug dosing based on the medication and patient information provided.
Consider:
- Age and weight-based dosing
- Renal/hepatic adjustments if applicable
- Maximum daily doses
- Pediatric vs adult dosing
Provide the calculated dose with frequency and any important warnings.""",

            "red_flag_check": """You are a clinical safety alert system. Analyze the provided vitals, lab values, and medications for any red flags or safety concerns.
Check for:
1. Critical vital signs (BP > 180/120, HR < 40 or > 150, SpO2 < 90%, Temp > 39.5°C)
2. Critical lab values if provided
3. Drug-drug interactions
4. Pregnancy category concerns
5. Contraindications based on patient history

Return alerts in JSON format:
{
  "alerts": [
    {"severity": "critical/warning/info", "type": "vital/lab/drug/interaction", "message": "Alert description", "recommendation": "What to do"}
  ],
  "has_critical": true/false
}"""
        }
        
        system_message = system_prompts.get(request.request_type, system_prompts["patient_instructions"])
        
        # Build context-aware prompt
        prompt_text = request.text
        if request.patient_context:
            context = request.patient_context
            prompt_text += f"\n\nPatient Context:\n- Age: {context.get('age', 'Unknown')}\n- Sex: {context.get('sex', 'Unknown')}"
            if context.get('allergies'):
                prompt_text += f"\n- Allergies: {', '.join(context['allergies'])}"
            if context.get('chronic_conditions'):
                prompt_text += f"\n- Chronic Conditions: {', '.join(context['chronic_conditions'])}"
        
        if request.medications and request.request_type == "red_flag_check":
            prompt_text += f"\n\nCurrent Medications: {', '.join(request.medications)}"
        
        if request.vitals and request.request_type == "red_flag_check":
            vitals = request.vitals
            prompt_text += f"\n\nVitals: BP: {vitals.get('bp', 'N/A')}, HR: {vitals.get('hr', 'N/A')}, Temp: {vitals.get('temp', 'N/A')}, SpO2: {vitals.get('spo2', 'N/A')}, RR: {vitals.get('rr', 'N/A')}"
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"emr-ai-{current_user['id']}-{datetime.now().timestamp()}",
            system_message=system_message
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=prompt_text)
        response = await chat.send_message(user_message)
        
        return {"result": response, "type": request.request_type}
    
    except Exception as e:
        logger.error(f"AI assist error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

# ============== OCR ENDPOINT ==============
class OCRRequest(BaseModel):
    attachment_id: str

@api_router.post("/ai/ocr")
async def extract_text_from_image(request: OCRRequest, current_user: dict = Depends(get_current_user)):
    """Extract SOAP notes from an uploaded image using OCR/Vision AI"""
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can use OCR")
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Get attachment
        attachment = await db.attachments.find_one({"id": request.attachment_id}, {"_id": 0})
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        
        # Check file type
        content_type = attachment.get("content_type", "")
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="OCR only works with image files (JPG, PNG, etc.)")
        
        # Get the file content - object storage (new) then legacy fallbacks
        file_content = None

        if attachment.get("storage_path"):
            try:
                file_content, _ = storage_get(attachment["storage_path"])
            except Exception as e:
                logger.error(f"OCR storage fetch failed: {e}")

        if file_content is None and attachment.get("stored_filename"):
            # Legacy: file stored on disk
            file_path = UPLOADS_DIR / attachment.get("stored_filename")
            if file_path.exists():
                async with aiofiles.open(file_path, 'rb') as f:
                    file_content = await f.read()
        
        if file_content is None and attachment.get("file_url"):
            # File is stored on disk (legacy format)
            file_path = UPLOADS_DIR / attachment.get("file_url")
            if file_path.exists():
                async with aiofiles.open(file_path, 'rb') as f:
                    file_content = await f.read()
        
        if file_content is None and attachment.get("file_data"):
            # File is stored as base64 in database (legacy)
            try:
                file_content = base64.b64decode(attachment["file_data"])
            except Exception:
                pass
        
        if file_content is None:
            raise HTTPException(status_code=404, detail="File content not found")
        
        # Convert to base64
        image_base64 = base64.b64encode(file_content).decode('utf-8')
        
        # Create the OCR prompt
        system_message = """You are a medical document OCR specialist. Extract text from the provided image of medical notes, specifically looking for SOAP format content.

Extract and organize the content into these sections if present:
- Subjective (S): Patient's reported symptoms, chief complaint, history
- Objective (O): Physical examination findings, vital signs, observations  
- Assessment (A): Diagnosis, differential diagnoses, clinical impressions
- Plan (P): Treatment plan, medications, follow-up instructions

Return the extracted text in this JSON format:
{
  "raw_text": "The complete raw text extracted from the image",
  "soap": {
    "subjective": "Extracted subjective content or empty string",
    "objective": "Extracted objective content or empty string", 
    "assessment": "Extracted assessment content or empty string",
    "plan": "Extracted plan content or empty string"
  },
  "confidence": "high/medium/low based on image clarity",
  "notes": "Any observations about the image quality or content"
}

If the image is not a medical document or is unreadable, return:
{
  "raw_text": "",
  "soap": {"subjective": "", "objective": "", "assessment": "", "plan": ""},
  "confidence": "low",
  "notes": "Description of the issue"
}"""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"emr-ocr-{current_user['id']}-{datetime.now().timestamp()}",
            system_message=system_message
        ).with_model("openai", "gpt-5.2")
        
        # Create image content for vision API
        from emergentintegrations.llm.chat import ImageContent
        
        image_content = ImageContent(image_base64=image_base64)
        
        # Send message with image
        user_message = UserMessage(
            text="Please extract the text from this medical document image and organize it into SOAP format if applicable.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Try to parse the JSON response
        import json
        try:
            # Clean the response - remove markdown code blocks if present
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
                clean_response = clean_response.strip()
            
            result = json.loads(clean_response)
        except json.JSONDecodeError:
            # If parsing fails, return raw response
            result = {
                "raw_text": response,
                "soap": {"subjective": "", "objective": "", "assessment": "", "plan": ""},
                "confidence": "low",
                "notes": "Could not parse structured response"
            }
        
        return {"result": result, "attachment_id": request.attachment_id}
    
    except Exception as e:
        logger.error(f"OCR error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OCR service error: {str(e)}")

# ============== AI DRAFT ROUTES ==============
@api_router.post("/ai/drafts", response_model=AIDraftResponse)
async def create_ai_draft(draft: AIDraftCreate, current_user: dict = Depends(get_current_user)):
    """Save an AI consultation draft for later review"""
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can save AI drafts")
    
    # Verify patient ownership
    patient = await db.patients.find_one({"id": draft.patient_id, "owner_id": current_user["id"]})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    draft_doc = {
        "id": str(uuid.uuid4()),
        "patient_id": draft.patient_id,
        "clinical_notes": draft.clinical_notes,
        "ai_result": draft.ai_result,
        "red_flags": draft.red_flags or [],
        "owner_id": current_user["id"],
        "created_by_name": current_user["full_name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ai_drafts.insert_one(draft_doc)
    
    # Keep max 10 drafts per patient per owner
    existing_count = await db.ai_drafts.count_documents({
        "patient_id": draft.patient_id,
        "owner_id": current_user["id"]
    })
    
    if existing_count > 10:
        # Delete oldest drafts beyond limit
        oldest = await db.ai_drafts.find({
            "patient_id": draft.patient_id,
            "owner_id": current_user["id"]
        }).sort("created_at", 1).limit(existing_count - 10).to_list(existing_count - 10)
        
        for old_draft in oldest:
            await db.ai_drafts.delete_one({"id": old_draft["id"]})
    
    return {k: v for k, v in draft_doc.items() if k != "_id"}

@api_router.get("/ai/drafts/{patient_id}", response_model=List[AIDraftResponse])
async def get_ai_drafts(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Get all AI consultation drafts for a patient"""
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can view AI drafts")
    
    # Verify patient ownership
    patient = await db.patients.find_one({"id": patient_id, "owner_id": current_user["id"]})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    drafts = await db.ai_drafts.find(
        {"patient_id": patient_id, "owner_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return drafts

@api_router.delete("/ai/drafts/{draft_id}")
async def delete_ai_draft(draft_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a specific AI consultation draft"""
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can delete AI drafts")
    
    result = await db.ai_drafts.delete_one({
        "id": draft_id,
        "owner_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    return {"message": "Draft deleted"}

@api_router.delete("/ai/drafts/patient/{patient_id}")
async def delete_all_patient_drafts(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Delete all AI consultation drafts for a patient"""
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors can delete AI drafts")
    
    result = await db.ai_drafts.delete_many({
        "patient_id": patient_id,
        "owner_id": current_user["id"]
    })
    
    return {"message": f"Deleted {result.deleted_count} drafts"}

# ============== AUDIT LOG ROUTES ==============
@api_router.get("/audit-logs", response_model=List[AuditLog])
async def get_audit_logs(
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs

# ============== EXPORT ROUTES ==============
@api_router.get("/export/patients")
async def export_patients(
    current_user: dict = Depends(get_current_user)
):
    # Data isolation: only export own patients. No cap — full backup limited only by storage.
    query = {"owner_id": current_user["id"]}
    total_count = await db.patients.count_documents(query)
    patients = await db.patients.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    return {"data": patients, "count": len(patients), "total": total_count}

@api_router.get("/export/visits")
async def export_visits(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Data isolation: only export visits for own patients. No cap — full backup.
    owned_patients = await db.patients.find({"owner_id": current_user["id"]}, {"id": 1, "patient_id": 1, "full_name": 1}).to_list(length=None)
    patient_map = {p["id"]: p for p in owned_patients}
    owned_patient_ids = [p["id"] for p in owned_patients]
    
    query = {"patient_id": {"$in": owned_patient_ids}}
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    total_count = await db.visits.count_documents(query)
    visits = await db.visits.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    # Enrich visits with patient info for easier re-import
    enriched_visits = []
    for visit in visits:
        patient = patient_map.get(visit.get("patient_id"), {})
        visit["patient_display_id"] = patient.get("patient_id", "")  # P-XXXX format
        visit["patient_name"] = patient.get("full_name", "")
        enriched_visits.append(visit)
    
    return {"data": enriched_visits, "count": len(enriched_visits), "total": total_count}

# ============== IMPORT DATA ==============
class ImportResult(BaseModel):
    success: int = 0
    failed: int = 0
    errors: List[str] = []

@api_router.post("/import/patients")
async def import_patients(
    data: List[dict],
    current_user: dict = Depends(get_current_user)
):
    """Import patients from JSON array"""
    if current_user["role"] not in ["doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Only doctors and admins can import patients")
    
    user_id = current_user["id"]
    result = {"success": 0, "failed": 0, "errors": [], "imported_ids": []}
    
    for i, patient_data in enumerate(data):
        try:
            # Required fields validation
            if not patient_data.get("full_name"):
                result["errors"].append(f"Row {i+1}: Missing required field 'full_name'")
                result["failed"] += 1
                continue
            if not patient_data.get("birthdate"):
                result["errors"].append(f"Row {i+1}: Missing required field 'birthdate'")
                result["failed"] += 1
                continue
            if not patient_data.get("sex"):
                result["errors"].append(f"Row {i+1}: Missing required field 'sex'")
                result["failed"] += 1
                continue
            
            # Generate new IDs
            patient_id = f"P-{str(uuid.uuid4())[:8].upper()}"
            new_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            
            # Build patient document
            new_patient = {
                "id": new_id,
                "patient_id": patient_id,
                "full_name": patient_data["full_name"],
                "birthdate": patient_data["birthdate"],
                "sex": patient_data["sex"],
                "address": patient_data.get("address"),
                "mobile": patient_data.get("mobile"),
                "email": patient_data.get("email"),
                "emergency_contact_name": patient_data.get("emergency_contact_name"),
                "emergency_contact_phone": patient_data.get("emergency_contact_phone"),
                "allergies": patient_data.get("allergies", []),
                "chronic_conditions": patient_data.get("chronic_conditions", []),
                "owner_id": user_id,
                "created_by": user_id,
                "created_at": now,
                "updated_at": now
            }
            
            await db.patients.insert_one(new_patient)
            result["success"] += 1
            result["imported_ids"].append({"id": new_id, "patient_id": patient_id, "full_name": patient_data["full_name"]})
            
        except Exception as e:
            result["errors"].append(f"Row {i+1}: {str(e)}")
            result["failed"] += 1
    
    return result

@api_router.post("/import/visits")
async def import_visits(
    data: List[dict],
    current_user: dict = Depends(get_current_user)
):
    """Import visits from JSON array. Will try to match patient_id, but imports even if no match found."""
    if current_user["role"] not in ["doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Only doctors and admins can import visits")
    
    user_id = current_user["id"]
    result = {"success": 0, "failed": 0, "errors": [], "imported_ids": [], "warnings": []}
    
    # Get all patient IDs owned by this user for matching
    owned_patients = await db.patients.find({"owner_id": user_id}, {"id": 1, "patient_id": 1, "full_name": 1}).to_list(length=None)
    patient_id_map = {p["patient_id"]: p for p in owned_patients}
    patient_internal_id_map = {p["id"]: p for p in owned_patients}
    # Also map by full_name for flexible matching (strip whitespace, lowercase)
    patient_name_map = {p["full_name"].strip().lower(): p for p in owned_patients}
    
    # Log available patients for debugging
    logger.info(f"Import visits: Found {len(owned_patients)} patients for user {user_id}")
    for p in owned_patients[:5]:
        logger.info(f"  Patient: '{p['full_name']}' (id: {p['patient_id']})")
    
    for i, visit_data in enumerate(data):
        try:
            # Get patient reference - try multiple fields
            patient_name_from_data = visit_data.get("patient_name", "").strip() if visit_data.get("patient_name") else ""
            patient_id_from_data = visit_data.get("patient_id", "").strip() if visit_data.get("patient_id") else ""
            patient_display_id = visit_data.get("patient_display_id", "").strip() if visit_data.get("patient_display_id") else ""
            # Also check full_name field (in case user uses patient format)
            full_name_from_data = visit_data.get("full_name", "").strip() if visit_data.get("full_name") else ""
            
            logger.info(f"Row {i+1}: patient_name='{patient_name_from_data}', patient_id='{patient_id_from_data}', full_name='{full_name_from_data}'")
            
            # Try to find patient by various methods
            patient = None
            patient_display_name = "Unknown Patient"
            
            # Method 1: Match by patient_id (P-XXXX format)
            if patient_id_from_data:
                patient = patient_id_map.get(patient_id_from_data)
                if patient:
                    logger.info(f"  Matched by patient_id: {patient_id_from_data}")
            
            # Method 2: Match by patient_display_id
            if not patient and patient_display_id:
                patient = patient_id_map.get(patient_display_id)
                if patient:
                    logger.info(f"  Matched by patient_display_id: {patient_display_id}")
            
            # Method 3: Match by internal UUID
            if not patient and patient_id_from_data:
                patient = patient_internal_id_map.get(patient_id_from_data)
                if patient:
                    logger.info("  Matched by internal UUID")
            
            # Method 4: Match by patient_name (case-insensitive, trimmed)
            if not patient and patient_name_from_data:
                search_key = patient_name_from_data.strip().lower()
                patient = patient_name_map.get(search_key)
                if patient:
                    logger.info(f"  Matched by patient_name: {patient_name_from_data}")
                else:
                    available_names = list(patient_name_map.keys())[:10]
                    logger.warning(f"  No match for patient_name '{search_key}'. Available patients: {available_names}")
            
            # Method 5: Match by full_name field (fallback for patient-format JSON)
            if not patient and full_name_from_data:
                search_key = full_name_from_data.strip().lower()
                patient = patient_name_map.get(search_key)
                if patient:
                    logger.info(f"  Matched by full_name: {full_name_from_data}")
                else:
                    logger.warning(f"  No match for full_name '{search_key}'")
            
            # Determine final patient_id and display name
            if patient:
                resolved_patient_id = patient["id"]
                patient_display_name = patient["full_name"]
            else:
                # No match found - use provided reference or generate one
                resolved_patient_id = patient_id_from_data or patient_name_from_data or full_name_from_data or f"UNLINKED-{str(uuid.uuid4())[:8]}"
                patient_display_name = patient_name_from_data or full_name_from_data or resolved_patient_id
                # Show available patient names in warning
                available_names = [p["full_name"] for p in owned_patients[:5]]
                result["warnings"].append(f"Row {i+1}: Patient '{patient_display_name}' not found. Your patients: {available_names}")
            
            # Generate new ID
            new_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            
            # Handle vitals if present
            vitals = None
            if visit_data.get("vitals"):
                vitals = visit_data["vitals"]
            
            # Build visit document
            new_visit = {
                "id": new_id,
                "patient_id": resolved_patient_id,
                "patient_name_imported": patient_display_name,  # Store original name for reference
                "vitals": vitals,
                "soap_subjective": visit_data.get("soap_subjective"),
                "soap_objective": visit_data.get("soap_objective"),
                "soap_assessment": visit_data.get("soap_assessment"),
                "soap_plan": visit_data.get("soap_plan"),
                "diagnosis_codes": visit_data.get("diagnosis_codes", []),
                "follow_up_date": visit_data.get("follow_up_date"),
                "patient_instructions": visit_data.get("patient_instructions"),
                "warning_signs": visit_data.get("warning_signs"),
                "created_by": user_id,
                "created_by_name": current_user["full_name"],
                "owner_id": user_id,
                "created_at": visit_data.get("created_at", now),
                "updated_at": now
            }
            
            await db.visits.insert_one(new_visit)
            result["success"] += 1
            result["imported_ids"].append({"id": new_id, "patient_name": patient_display_name, "matched": patient is not None})
            
        except Exception as e:
            result["errors"].append(f"Row {i+1}: {str(e)}")
            result["failed"] += 1
    
    return result

# ============== RESTORE BACKUP ==============
class RestoreRequest(BaseModel):
    patients: Optional[List[dict]] = None
    visits: Optional[List[dict]] = None
    mode: str = "merge"  # "merge" or "replace"
    restore_type: str = "both"  # "patients", "visits", or "both"

@api_router.post("/restore")
async def restore_backup(
    request: RestoreRequest,
    current_user: dict = Depends(get_current_user)
):
    """Restore backup data. Supports merge (add new, skip duplicates) and replace (wipe & reimport) modes."""
    if current_user["role"] not in ["doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Only doctors and admins can restore backups")

    user_id = current_user["id"]
    result = {
        "patients_restored": 0, "patients_skipped": 0, "patients_failed": 0,
        "visits_restored": 0, "visits_skipped": 0, "visits_failed": 0,
        "patients_deleted": 0, "visits_deleted": 0,
        "errors": [], "warnings": []
    }

    # --- RESTORE PATIENTS ---
    if request.restore_type in ["patients", "both"] and request.patients:
        if request.mode == "replace":
            # Delete all existing patients and their related data
            owned_patients = await db.patients.find({"owner_id": user_id}, {"_id": 0, "id": 1}).to_list(length=None)
            owned_ids = [p["id"] for p in owned_patients]
            del_patients = await db.patients.delete_many({"owner_id": user_id})
            result["patients_deleted"] = del_patients.deleted_count
            if owned_ids:
                del_visits = await db.visits.delete_many({"patient_id": {"$in": owned_ids}})
                result["visits_deleted"] = del_visits.deleted_count
                await db.prescriptions.delete_many({"patient_id": {"$in": owned_ids}})
                await db.certificates.delete_many({"patient_id": {"$in": owned_ids}})
                await db.lab_requests.delete_many({"patient_id": {"$in": owned_ids}})
                await db.appointments.delete_many({"owner_id": user_id})

        # Build existing name set for merge dedup
        existing_names = set()
        if request.mode == "merge":
            existing = await db.patients.find({"owner_id": user_id}, {"_id": 0, "full_name": 1, "birthdate": 1}).to_list(length=None)
            existing_names = {(p["full_name"].strip().lower(), p.get("birthdate", "")) for p in existing}

        for i, p in enumerate(request.patients):
            try:
                if not p.get("full_name") or not p.get("birthdate") or not p.get("sex"):
                    result["errors"].append(f"Patient row {i+1}: Missing required field (full_name, birthdate, or sex)")
                    result["patients_failed"] += 1
                    continue

                key = (p["full_name"].strip().lower(), p.get("birthdate", ""))
                if request.mode == "merge" and key in existing_names:
                    result["patients_skipped"] += 1
                    continue

                new_id = str(uuid.uuid4())
                patient_id = f"P-{str(uuid.uuid4())[:8].upper()}"
                now = datetime.now(timezone.utc).isoformat()
                new_patient = {
                    "id": new_id,
                    "patient_id": patient_id,
                    "full_name": p["full_name"],
                    "birthdate": p["birthdate"],
                    "sex": p["sex"],
                    "address": p.get("address"),
                    "mobile": p.get("mobile"),
                    "email": p.get("email"),
                    "emergency_contact_name": p.get("emergency_contact_name"),
                    "emergency_contact_phone": p.get("emergency_contact_phone"),
                    "allergies": p.get("allergies", []),
                    "chronic_conditions": p.get("chronic_conditions", []),
                    "owner_id": user_id,
                    "created_by": user_id,
                    "created_at": p.get("created_at", now),
                    "updated_at": now
                }
                await db.patients.insert_one(new_patient)
                existing_names.add(key)
                result["patients_restored"] += 1
            except Exception as e:
                result["errors"].append(f"Patient row {i+1}: {str(e)}")
                result["patients_failed"] += 1

    # --- RESTORE VISITS ---
    if request.restore_type in ["visits", "both"] and request.visits:
        # Build patient lookup map from current DB state
        owned_patients = await db.patients.find({"owner_id": user_id}, {"_id": 0, "id": 1, "patient_id": 1, "full_name": 1}).to_list(length=None)
        name_map = {p["full_name"].strip().lower(): p for p in owned_patients}
        pid_map = {p["patient_id"]: p for p in owned_patients}
        id_map = {p["id"]: p for p in owned_patients}

        if request.mode == "replace" and request.restore_type == "visits":
            owned_ids = [p["id"] for p in owned_patients]
            if owned_ids:
                del_visits = await db.visits.delete_many({"patient_id": {"$in": owned_ids}})
                result["visits_deleted"] = del_visits.deleted_count

        for i, v in enumerate(request.visits):
            try:
                # Resolve patient
                patient = None
                pname = (v.get("patient_name") or v.get("full_name") or "").strip()
                pid = (v.get("patient_id") or "").strip()

                if pid:
                    patient = pid_map.get(pid) or id_map.get(pid)
                if not patient and pname:
                    patient = name_map.get(pname.lower())

                if not patient:
                    result["warnings"].append(f"Visit row {i+1}: Patient '{pname or pid}' not found, skipped")
                    result["visits_skipped"] += 1
                    continue

                new_id = str(uuid.uuid4())
                now = datetime.now(timezone.utc).isoformat()
                new_visit = {
                    "id": new_id,
                    "patient_id": patient["id"],
                    "patient_name_imported": patient["full_name"],
                    "vitals": v.get("vitals"),
                    "soap_subjective": v.get("soap_subjective"),
                    "soap_objective": v.get("soap_objective"),
                    "soap_assessment": v.get("soap_assessment"),
                    "soap_plan": v.get("soap_plan"),
                    "diagnosis_codes": v.get("diagnosis_codes", []),
                    "follow_up_date": v.get("follow_up_date"),
                    "patient_instructions": v.get("patient_instructions"),
                    "warning_signs": v.get("warning_signs"),
                    "created_by": user_id,
                    "created_by_name": current_user["full_name"],
                    "owner_id": user_id,
                    "created_at": v.get("created_at", now),
                    "updated_at": now
                }
                await db.visits.insert_one(new_visit)
                result["visits_restored"] += 1
            except Exception as e:
                result["errors"].append(f"Visit row {i+1}: {str(e)}")
                result["visits_failed"] += 1

    return result

# ============== DICTATION MODULE ==============

DICTATION_UPLOADS = ROOT_DIR / 'dictation_audio'
DICTATION_UPLOADS.mkdir(exist_ok=True)

class DictationSessionCreate(BaseModel):
    patient_id: str
    visit_id: Optional[str] = None
    dictation_mode: str = "full_consultation"
    language: str = "en"

class DictationSessionUpdate(BaseModel):
    status: Optional[str] = None
    raw_transcript: Optional[str] = None
    cleaned_transcript: Optional[str] = None
    ai_structured_json: Optional[Dict[str, Any]] = None
    review_flags_json: Optional[List[str]] = None
    physician_reviewed: Optional[bool] = None
    inserted_sections_json: Optional[Dict[str, Any]] = None
    duration_seconds: Optional[float] = None

@api_router.post("/dictation/sessions")
async def create_dictation_session(
    data: DictationSessionCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Only doctors can create dictation sessions")
    now = datetime.now(timezone.utc).isoformat()
    session = {
        "id": str(uuid.uuid4()),
        "patient_id": data.patient_id,
        "visit_id": data.visit_id,
        "provider_id": current_user["id"],
        "provider_name": current_user["full_name"],
        "dictation_mode": data.dictation_mode,
        "language": data.language,
        "status": "recording",
        "raw_transcript": None,
        "cleaned_transcript": None,
        "ai_structured_json": None,
        "review_flags_json": [],
        "physician_reviewed": False,
        "physician_reviewed_at": None,
        "inserted_sections_json": {},
        "duration_seconds": 0,
        "created_at": now,
        "updated_at": now
    }
    await db.dictation_sessions.insert_one(session)
    # Audit log
    await db.dictation_audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "dictation_session_id": session["id"],
        "action_type": "recording_started",
        "action_by": current_user["id"],
        "action_timestamp": now,
        "notes": f"Mode: {data.dictation_mode}"
    })
    session.pop("_id", None)
    return session

@api_router.get("/dictation/sessions")
async def list_dictation_sessions(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"provider_id": current_user["id"]}
    if patient_id:
        query["patient_id"] = patient_id
    sessions = await db.dictation_sessions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return sessions

@api_router.get("/dictation/sessions/{session_id}")
async def get_dictation_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.dictation_sessions.find_one({"id": session_id, "provider_id": current_user["id"]}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@api_router.put("/dictation/sessions/{session_id}")
async def update_dictation_session(
    session_id: str,
    data: DictationSessionUpdate,
    current_user: dict = Depends(get_current_user)
):
    session = await db.dictation_sessions.find_one({"id": session_id, "provider_id": current_user["id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if data.physician_reviewed:
        updates["physician_reviewed_at"] = updates["updated_at"]
    await db.dictation_sessions.update_one({"id": session_id}, {"$set": updates})
    # Audit
    action = "session_updated"
    if data.status:
        action = f"recording_{data.status}"
    if data.physician_reviewed:
        action = "physician_reviewed"
    await db.dictation_audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "dictation_session_id": session_id,
        "action_type": action,
        "action_by": current_user["id"],
        "action_timestamp": updates["updated_at"],
        "notes": None
    })
    updated = await db.dictation_sessions.find_one({"id": session_id}, {"_id": 0})
    return updated

@api_router.post("/dictation/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    session_id: str = Form(""),
    language: str = Form("en"),
    prompt: str = Form(""),
    current_user: dict = Depends(get_current_user)
):
    """Transcribe audio using OpenAI Whisper"""
    if current_user["role"] not in ["doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Only doctors can use transcription")

    # Get user's OpenAI key from settings, fall back to global env key
    user_settings = await db.settings.find_one({"owner_id": current_user["id"]}, {"_id": 0})
    user_openai_key = user_settings.get("openai_api_key") if user_settings else None
    openai_key = user_openai_key or OPENAI_API_KEY

    if not openai_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured. Go to Settings > Dictation to add your key.")

    try:
        import openai as openai_sdk

        # Save audio temporarily
        audio_bytes = await audio.read()
        temp_path = DICTATION_UPLOADS / f"{uuid.uuid4()}.webm"
        async with aiofiles.open(temp_path, 'wb') as f:
            await f.write(audio_bytes)

        client = openai_sdk.AsyncOpenAI(api_key=openai_key)
        with open(temp_path, "rb") as audio_file:
            response = await client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-1",
                response_format="verbose_json",
                language=language if language else None,
                prompt=prompt if prompt else "Medical clinic consultation dictation. Doctor speaking about patient symptoms, diagnosis, medications, and treatment plan.",
                temperature=0.0
            )

        transcript = response.text if hasattr(response, 'text') else (response.get('text', str(response)) if isinstance(response, dict) else str(response))
        confidence = 1.0
        segments = []
        raw_segments = response.segments if hasattr(response, 'segments') else (response.get('segments', []) if isinstance(response, dict) else [])
        if raw_segments:
            for s in raw_segments:
                if isinstance(s, dict):
                    segments.append({"start": s.get("start", 0), "end": s.get("end", 0), "text": s.get("text", "")})
                else:
                    segments.append({"start": getattr(s, 'start', 0), "end": getattr(s, 'end', 0), "text": getattr(s, 'text', '')})
            confidence = 0.95

        # Update session if provided
        if session_id:
            now = datetime.now(timezone.utc).isoformat()
            existing = await db.dictation_sessions.find_one({"id": session_id})
            old_transcript = existing.get("raw_transcript", "") if existing else ""
            new_transcript = (old_transcript + " " + transcript).strip() if old_transcript else transcript
            await db.dictation_sessions.update_one(
                {"id": session_id},
                {"$set": {"raw_transcript": new_transcript, "status": "transcribed", "updated_at": now}}
            )
            await db.dictation_audit_logs.insert_one({
                "id": str(uuid.uuid4()),
                "dictation_session_id": session_id,
                "action_type": "transcript_generated",
                "action_by": current_user["id"],
                "action_timestamp": now,
                "notes": f"Length: {len(transcript)} chars"
            })

        # Cleanup temp file
        try:
            temp_path.unlink()
        except Exception:
            pass

        return {
            "transcript": transcript,
            "confidence": confidence,
            "segments": segments,
            "language": language
        }
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        err_str = str(e)
        if "401" in err_str or "invalid_api_key" in err_str:
            raise HTTPException(status_code=401, detail="Invalid OpenAI API key. Please check your key in Settings > Voice Dictation.")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {err_str}")

@api_router.post("/dictation/structure")
async def structure_transcript(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """AI-structure a clinical transcript into SOAP, Rx, Orders, etc."""
    if current_user["role"] not in ["doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Only doctors can use AI structuring")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")

    transcript = data.get("transcript", "")
    mode = data.get("mode", "full_consultation")
    patient_context = data.get("patient_context", {})
    session_id = data.get("session_id", "")

    if not transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        system_message = """You are a clinical documentation assistant for a physician using a private clinic EMR.
Convert raw doctor dictation into structured medical documentation.

Rules:
- Do not invent data. If information is missing, leave the field blank or empty.
- Preserve important negatives (e.g., "no chest pain", "no dyspnea").
- Keep wording concise and clinically useful.
- Separate Subjective, Objective, Assessment, and Plan correctly.
- Extract prescriptions when mentioned with drug, dose, frequency, duration.
- Extract orders (labs, imaging) when mentioned.
- Extract patient instructions and follow-up details when mentioned.
- Suggest ICD-10 codes only if directly supported by the dictation.
- If uncertain about any medication name, dosage, or finding, add it to uncertainties and review_flags.
- Flag ambiguous or incomplete medication instructions.

Return ONLY valid JSON (no markdown, no code fences) in this exact structure:
{
  "subjective": {"chief_complaint": "", "hpi": "", "ros": []},
  "objective": {"vitals": {"bp": "", "hr": "", "rr": "", "temp": "", "spo2": "", "weight": "", "height": ""}, "physical_exam": "", "diagnostics": []},
  "assessment": [],
  "plan": [],
  "prescriptions": [{"drug": "", "generic_name": "", "brand_name": "", "strength": "", "dose": "", "route": "oral", "frequency": "", "duration": "", "quantity": "", "prn": false, "indication": "", "notes": "", "confidence": "high"}],
  "orders": [{"type": "lab", "name": "", "details": "", "priority": "routine", "confidence": "high"}],
  "patient_instructions": [],
  "follow_up": "",
  "icd10_suggestions": [{"code": "", "label": "", "basis": ""}],
  "uncertainties": [],
  "review_flags": []
}"""

        mode_prompts = {
            "full_consultation": "Process this full consultation dictation. Extract all clinical information into the structured format.",
            "subjective": "Focus on extracting Subjective information (chief complaint, HPI, ROS). Leave other sections empty.",
            "objective": "Focus on extracting Objective findings (vitals, physical exam, diagnostics). Leave other sections empty.",
            "assessment": "Focus on extracting Assessment (diagnoses, impressions). Leave other sections empty.",
            "plan": "Focus on extracting Plan (treatment, medications, follow-up). Leave other sections empty.",
            "prescription": "Focus on extracting medication prescriptions into the prescriptions array. Leave other clinical sections empty.",
            "orders": "Focus on extracting lab and imaging orders into the orders array. Leave other clinical sections empty.",
            "instructions": "Focus on extracting patient instructions and follow-up advice. Leave other sections empty."
        }

        prompt = mode_prompts.get(mode, mode_prompts["full_consultation"])
        prompt += f"\n\nRaw Dictation:\n{transcript}"

        if patient_context:
            ctx_parts = []
            if patient_context.get("name"):
                ctx_parts.append(f"Name: {patient_context['name']}")
            if patient_context.get("age"):
                ctx_parts.append(f"Age: {patient_context['age']}")
            if patient_context.get("sex"):
                ctx_parts.append(f"Sex: {patient_context['sex']}")
            if patient_context.get("allergies"):
                ctx_parts.append(f"Allergies: {', '.join(patient_context['allergies'])}")
            if patient_context.get("chronic_conditions"):
                ctx_parts.append(f"Conditions: {', '.join(patient_context['chronic_conditions'])}")
            if ctx_parts:
                prompt += "\n\nPatient Context:\n" + "\n".join(ctx_parts)

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"dictation-{current_user['id']}-{datetime.now().timestamp()}",
            system_message=system_message
        ).with_model("openai", "gpt-5.2")

        response = await chat.send_message(UserMessage(text=prompt))

        # Parse JSON from response
        import json as json_lib_internal
        response_text = response.strip()
        # Remove markdown code fences if present
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1] if "\n" in response_text else response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()

        structured = json_lib_internal.loads(response_text)

        # Update session
        if session_id:
            now = datetime.now(timezone.utc).isoformat()
            await db.dictation_sessions.update_one(
                {"id": session_id},
                {"$set": {
                    "ai_structured_json": structured,
                    "review_flags_json": structured.get("review_flags", []),
                    "status": "ai_processed",
                    "updated_at": now
                }}
            )
            await db.dictation_audit_logs.insert_one({
                "id": str(uuid.uuid4()),
                "dictation_session_id": session_id,
                "action_type": "ai_processed",
                "action_by": current_user["id"],
                "action_timestamp": now,
                "notes": f"Mode: {mode}"
            })

        return {"structured": structured, "mode": mode}

    except json.JSONDecodeError:
        logger.error(f"AI returned non-JSON: {response_text[:200]}")
        return {"structured": None, "raw_response": response_text, "error": "AI returned non-JSON. Review the raw response.", "mode": mode}
    except Exception as e:
        logger.error(f"Structure error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI structuring failed: {str(e)}")

@api_router.post("/dictation/audit")
async def log_dictation_audit(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Log a dictation audit event"""
    now = datetime.now(timezone.utc).isoformat()
    log_entry = {
        "id": str(uuid.uuid4()),
        "dictation_session_id": data.get("session_id", ""),
        "action_type": data.get("action_type", "unknown"),
        "action_by": current_user["id"],
        "action_timestamp": now,
        "notes": data.get("notes")
    }
    await db.dictation_audit_logs.insert_one(log_entry)
    log_entry.pop("_id", None)
    return log_entry

@api_router.get("/dictation/audit/{session_id}")
async def get_dictation_audit(session_id: str, current_user: dict = Depends(get_current_user)):
    logs = await db.dictation_audit_logs.find(
        {"dictation_session_id": session_id}, {"_id": 0}
    ).sort("action_timestamp", 1).to_list(500)
    return logs

# ============== DASHBOARD STATS ==============
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(
    local_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Use client's local date if provided, otherwise fall back to server date
    today = local_date if local_date else date.today().isoformat()
    user_id = current_user["id"]
    
    # Data isolation: only count user's own data
    total_patients = await db.patients.count_documents({"owner_id": user_id})
    today_appointments = await db.appointments.count_documents({"date": today, "owner_id": user_id})
    waiting_count = await db.appointments.count_documents({"date": today, "status": "waiting", "owner_id": user_id})
    in_consultation = await db.appointments.count_documents({"date": today, "status": "in_consultation", "owner_id": user_id})
    done_count = await db.appointments.count_documents({"date": today, "status": "done", "owner_id": user_id})
    
    # This week's visits - only for owned patients
    owned_patients = await db.patients.find({"owner_id": user_id}, {"id": 1}).to_list(length=None)
    owned_patient_ids = [p["id"] for p in owned_patients]
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    week_visits = await db.visits.count_documents({
        "patient_id": {"$in": owned_patient_ids},
        "created_at": {"$gte": week_start}
    })
    
    return {
        "total_patients": total_patients,
        "today_appointments": today_appointments,
        "waiting": waiting_count,
        "in_consultation": in_consultation,
        "done": done_count,
        "week_visits": week_visits
    }

# ============== ROOT ==============
@api_router.get("/")
async def root():
    return {"message": "Private Clinic EMR API", "version": "1.0.0"}

# Include router and middleware
app.include_router(api_router)

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    # Prevent browsers/proxies from serving stale API data (e.g. SOAP notes)
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Initialize object storage session
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Object storage init failed: {e}")
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.patients.create_index("patient_id", unique=True)
    await db.patients.create_index("owner_id")  # Index for data isolation
    await db.patients.create_index([("full_name", "text"), ("mobile", "text")])
    await db.appointments.create_index([("date", 1), ("time", 1)])
    await db.appointments.create_index("owner_id")  # Index for data isolation
    await db.visits.create_index([("patient_id", 1), ("created_at", -1)])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
