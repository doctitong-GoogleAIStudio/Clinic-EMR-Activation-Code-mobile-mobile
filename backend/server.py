from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[QueueStatus] = None

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

class AIRequest(BaseModel):
    text: str
    request_type: str  # soap_convert, diagnosis_suggest, patient_instructions

class AuditLog(BaseModel):
    id: str
    user_id: str
    user_name: str
    action: str
    entity_type: str
    entity_id: str
    details: Optional[str] = None
    timestamp: str

# ============== HELPER FUNCTIONS ==============
def calculate_age(birthdate_str: str) -> int:
    try:
        birthdate = datetime.strptime(birthdate_str, "%Y-%m-%d").date()
        today = date.today()
        age = today.year - birthdate.year - ((today.month, today.day) < (birthdate.month, birthdate.day))
        return age
    except:
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

# ============== AUTH ROUTES ==============
@api_router.post("/auth/register", response_model=UserResponse)
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
    del user_dict["password"]
    user_dict.pop("_id", None)
    return user_dict

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

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.post("/users/create-receptionist")
async def create_receptionist(user: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Only doctors or admins can create receptionist accounts")
    
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user.model_dump()
    user_dict["id"] = str(uuid4())
    user_dict["role"] = "receptionist"
    user_dict["password"] = hash_password(user_dict["password"])
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    user_dict["created_by"] = current_user["id"]
    
    await db.users.insert_one(user_dict)
    user_dict.pop("_id", None)
    user_dict.pop("password", None)
    await log_audit(current_user["id"], current_user["full_name"], "create", "receptionist", user_dict["id"], user_dict["full_name"])
    
    return {"message": "Receptionist account created", "id": user_dict["id"], "full_name": user_dict["full_name"]}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin" and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    if "password" in updates:
        updates["password"] = hash_password(updates["password"])
    
    await db.users.update_one({"id": user_id}, {"$set": updates})
    return {"message": "User updated"}

# ============== PATIENT ROUTES ==============
@api_router.post("/patients", response_model=PatientResponse)
async def create_patient(patient: PatientCreate, current_user: dict = Depends(get_current_user)):
    patient_dict = patient.model_dump()
    patient_dict["id"] = str(uuid.uuid4())
    patient_dict["patient_id"] = generate_patient_id()
    patient_dict["age"] = calculate_age(patient.birthdate)
    patient_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    patient_dict["updated_at"] = patient_dict["created_at"]
    patient_dict["owner_id"] = current_user["id"]  # Data isolation: track owner
    
    await db.patients.insert_one(patient_dict)
    await log_audit(current_user["id"], current_user["full_name"], "create", "patient", patient_dict["id"], patient.full_name)
    
    patient_dict.pop("_id", None)
    return patient_dict

@api_router.get("/patients", response_model=List[PatientResponse])
async def get_patients(
    search: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    # Receptionist sees all patients; others only their own
    query = {} if current_user["role"] == "receptionist" else {"owner_id": current_user["id"]}
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
    if current_user["role"] == "receptionist":
        patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    else:
        patient = await db.patients.find_one({"id": patient_id, "owner_id": current_user["id"]}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient["age"] = calculate_age(patient.get("birthdate", ""))
    return patient

@api_router.put("/patients/{patient_id}", response_model=PatientResponse)
async def update_patient(patient_id: str, updates: PatientUpdate, current_user: dict = Depends(get_current_user)):
    # Data isolation: verify ownership
    patient = await db.patients.find_one({"id": patient_id, "owner_id": current_user["id"]})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if "birthdate" in update_dict:
        update_dict["age"] = calculate_age(update_dict["birthdate"])
    
    await db.patients.update_one({"id": patient_id, "owner_id": current_user["id"]}, {"$set": update_dict})
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
    """Receptionist can access all patients; others only their own."""
    if current_user["role"] == "receptionist":
        patient = await db.patients.find_one({"id": patient_id})
        return patient is not None
    return await verify_patient_ownership(patient_id, current_user["id"])

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
    owned_patients = await db.patients.find({"owner_id": current_user["id"]}, {"id": 1}).to_list(1000)
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
    
    apt_dict = appointment.model_dump()
    apt_dict["id"] = str(uuid.uuid4())
    apt_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    apt_dict["owner_id"] = current_user["id"]
    
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
    # Receptionist sees all appointments; others only their own
    query = {} if current_user["role"] == "receptionist" else {"owner_id": current_user["id"]}
    if date:
        query["date"] = date
    if status:
        query["status"] = status.value
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort([("date", 1), ("time", 1)]).limit(limit).to_list(limit)
    return appointments

@api_router.get("/appointments/today", response_model=List[AppointmentResponse])
async def get_today_appointments(current_user: dict = Depends(get_current_user)):
    today = date.today().isoformat()
    if current_user["role"] == "receptionist":
        appointments = await db.appointments.find({"date": today}, {"_id": 0}).sort("time", 1).to_list(100)
    else:
        appointments = await db.appointments.find({"date": today, "owner_id": current_user["id"]}, {"_id": 0}).sort("time", 1).to_list(100)
    return appointments

@api_router.get("/queue/today", response_model=List[AppointmentResponse])
async def get_today_queue(current_user: dict = Depends(get_current_user)):
    today = date.today().isoformat()
    # Data isolation: only show own queue
    appointments = await db.appointments.find(
        {"date": today, "status": {"$in": ["waiting", "in_consultation"]}, "owner_id": current_user["id"]},
        {"_id": 0}
    ).sort("time", 1).to_list(100)
    return appointments

@api_router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(appointment_id: str, updates: AppointmentUpdate, current_user: dict = Depends(get_current_user)):
    # Data isolation: verify ownership
    apt = await db.appointments.find_one({"id": appointment_id, "owner_id": current_user["id"]})
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    update_dict = {k: v.value if isinstance(v, Enum) else v for k, v in updates.model_dump().items() if v is not None}
    
    await db.appointments.update_one({"id": appointment_id, "owner_id": current_user["id"]}, {"$set": update_dict})
    
    apt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    return apt

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, current_user: dict = Depends(get_current_user)):
    # Data isolation: only delete own appointments
    result = await db.appointments.delete_one({"id": appointment_id, "owner_id": current_user["id"]})
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
    
    content = await file.read()
    file_data = base64.b64encode(content).decode('utf-8')
    
    attachment = {
        "id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "visit_id": visit_id,
        "filename": file.filename,
        "file_data": file_data,
        "content_type": file.content_type,
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
    # Data isolation: receptionist can access all; others only their own
    if patient_id and current_user["role"] != "receptionist" and not await verify_patient_ownership(patient_id, current_user["id"]):
        return []
    
    query = {}
    if patient_id:
        query["patient_id"] = patient_id
    if visit_id:
        query["visit_id"] = visit_id
    
    # If no patient_id specified, scope to accessible patients
    if not patient_id:
        if current_user["role"] == "receptionist":
            pass  # No filter - see all
        else:
            owned_patients = await db.patients.find({"owner_id": current_user["id"]}, {"id": 1}).to_list(1000)
            owned_patient_ids = [p["id"] for p in owned_patients]
            query["patient_id"] = {"$in": owned_patient_ids}
    
    # Exclude file_data from list queries for performance
    attachments = await db.attachments.find(query, {"_id": 0, "file_data": 0}).sort("uploaded_at", -1).to_list(100)
    return attachments

@api_router.get("/attachments/{attachment_id}")
async def get_attachment(attachment_id: str, current_user: dict = Depends(get_current_user)):
    """Get single attachment with file data for viewing/downloading"""
    attachment = await db.attachments.find_one({"id": attachment_id}, {"_id": 0})
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Data isolation: verify patient ownership
    if not await verify_patient_ownership(attachment["patient_id"], current_user["id"]):
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    return attachment

class AttachmentUpdate(BaseModel):
    filename: Optional[str] = None
    tag: Optional[str] = None
    notes: Optional[str] = None

@api_router.put("/attachments/{attachment_id}")
async def update_attachment(attachment_id: str, updates: AttachmentUpdate, current_user: dict = Depends(get_current_user)):
    attachment = await db.attachments.find_one({"id": attachment_id})
    if not attachment or not await verify_patient_ownership(attachment["patient_id"], current_user["id"]):
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
    if not attachment or not await verify_patient_ownership(attachment["patient_id"], current_user["id"]):
        raise HTTPException(status_code=404, detail="Attachment not found")
    
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
        owned_patients = await db.patients.find({"owner_id": current_user["id"]}, {"id": 1}).to_list(1000)
        owned_patient_ids = [p["id"] for p in owned_patients]
        query["patient_id"] = {"$in": owned_patient_ids}
    
    prescriptions = await db.prescriptions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return prescriptions

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
        owned_patients = await db.patients.find({"owner_id": current_user["id"]}, {"id": 1}).to_list(1000)
        owned_patient_ids = [p["id"] for p in owned_patients]
        query["patient_id"] = {"$in": owned_patient_ids}
    
    certificates = await db.certificates.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return certificates
    return certificates

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
    return settings

@api_router.put("/settings")
async def update_settings(settings: ClinicSettings, current_user: dict = Depends(get_current_user)):
    await db.settings.update_one(
        {"owner_id": current_user["id"]},
        {"$set": {**settings.model_dump(), "owner_id": current_user["id"]}},
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
Use simple words, avoid medical jargon."""
        }
        
        system_message = system_prompts.get(request.request_type, system_prompts["patient_instructions"])
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"emr-ai-{current_user['id']}-{datetime.now().timestamp()}",
            system_message=system_message
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=request.text)
        response = await chat.send_message(user_message)
        
        return {"result": response, "type": request.request_type}
    
    except Exception as e:
        logger.error(f"AI assist error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

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
    limit: int = Query(default=1000, le=5000),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    # Data isolation: only export own patients
    query = {"owner_id": current_user["id"]}
    total_count = await db.patients.count_documents(query)
    patients = await db.patients.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return {"data": patients, "count": len(patients), "total": total_count, "skip": skip, "limit": limit}

@api_router.get("/export/visits")
async def export_visits(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=1000, le=5000),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    # Data isolation: only export visits for own patients
    owned_patients = await db.patients.find({"owner_id": current_user["id"]}, {"id": 1}).to_list(1000)
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
    visits = await db.visits.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return {"data": visits, "count": len(visits), "total": total_count, "skip": skip, "limit": limit}

# ============== DASHBOARD STATS ==============
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = date.today().isoformat()
    user_id = current_user["id"]
    
    # Data isolation: only count user's own data
    total_patients = await db.patients.count_documents({"owner_id": user_id})
    today_appointments = await db.appointments.count_documents({"date": today, "owner_id": user_id})
    waiting_count = await db.appointments.count_documents({"date": today, "status": "waiting", "owner_id": user_id})
    in_consultation = await db.appointments.count_documents({"date": today, "status": "in_consultation", "owner_id": user_id})
    done_count = await db.appointments.count_documents({"date": today, "status": "done", "owner_id": user_id})
    
    # This week's visits - only for owned patients
    owned_patients = await db.patients.find({"owner_id": user_id}, {"id": 1}).to_list(1000)
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.patients.create_index("patient_id", unique=True)
    await db.patients.create_index("owner_id")  # Index for data isolation
    await db.patients.create_index([("full_name", "text"), ("mobile", "text")])
    await db.appointments.create_index([("date", 1), ("time", 1)])
    await db.appointments.create_index("owner_id")  # Index for data isolation
    await db.visits.create_index([("patient_id", 1), ("created_at", -1)])
    
    # Create default admin if not exists
    admin = await db.users.find_one({"role": "admin"})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "admin@clinic.com",
            "password": hash_password("admin123"),
            "full_name": "System Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True
        })
        logger.info("Default admin created: admin@clinic.com / admin123")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
