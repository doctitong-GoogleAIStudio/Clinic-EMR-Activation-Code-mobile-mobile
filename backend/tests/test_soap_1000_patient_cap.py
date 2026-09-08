"""Regression test for the >1000 patients SOAP retrieval bug.

Bug: several per-patient list endpoints enumerated the doctor's owned patients
with a hard cap of `.to_list(1000)`. Any patient beyond the first 1000 (natural
order) was excluded from the ownership `$in` list, so GET /api/visits and
related endpoints returned an empty list — making saved SOAP appear lost.

Fix: changed those enumerations to `.to_list(length=None)`.

This test seeds 1000 filler patients + 1 TARGET patient (the 1001st) directly
in MongoDB and confirms the target patient's records are returned via the API.
"""
import asyncio
import os
import uuid
import io
from datetime import datetime, timezone

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# Unique run tag so we can clean up
RUN_TAG = f"TEST_1000CAP_{uuid.uuid4().hex[:8]}"
NUM_FILLER = 1000  # target becomes the 1001st

# ---------- Session-wide seeded state ---------- #

@pytest.fixture(scope="module")
def seeded():
    """Register two doctors, seed 1000 filler patients + 1 TARGET patient
    for doctor A. Also seed 1 patient for doctor B for cross-owner isolation."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    # Register doctor A
    email_a = f"{RUN_TAG.lower()}_a@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email_a,
        "full_name": "Dr Cap Alpha",
        "role": "doctor",
        "password": "TestPass123!",
        "specialization": "General",
    })
    assert r.status_code == 200, r.text
    token_a = r.json()["token"]
    user_a = r.json()["user"]

    # Register doctor B
    email_b = f"{RUN_TAG.lower()}_b@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email_b,
        "full_name": "Dr Cap Beta",
        "role": "doctor",
        "password": "TestPass123!",
        "specialization": "General",
    })
    assert r.status_code == 200, r.text
    token_b = r.json()["token"]
    user_b = r.json()["user"]

    # Seed patients directly via Mongo
    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        now = datetime.now(timezone.utc).isoformat()
        filler_docs = []
        for i in range(NUM_FILLER):
            pid = str(uuid.uuid4())
            filler_docs.append({
                "id": pid,
                "patient_id": f"{RUN_TAG}-F{i:04d}",
                "full_name": f"{RUN_TAG} Filler {i:04d}",
                "birthdate": "1990-01-01",
                "sex": "male",
                "address": None,
                "mobile": None,
                "email": None,
                "emergency_contact_name": None,
                "emergency_contact_phone": None,
                "allergies": [],
                "chronic_conditions": [],
                "age": 35,
                "created_at": now,
                "updated_at": now,
                "owner_id": user_a["id"],
                "created_by": user_a["id"],
            })
        await db.patients.insert_many(filler_docs)

        # TARGET patient (inserted LAST → 1001st)
        target_id = str(uuid.uuid4())
        await db.patients.insert_one({
            "id": target_id,
            "patient_id": f"{RUN_TAG}-TARGET",
            "full_name": f"{RUN_TAG} Target Patient",
            "birthdate": "1985-05-15",
            "sex": "female",
            "address": None,
            "mobile": None,
            "email": None,
            "emergency_contact_name": None,
            "emergency_contact_phone": None,
            "allergies": [],
            "chronic_conditions": [],
            "age": 40,
            "created_at": now,
            "updated_at": now,
            "owner_id": user_a["id"],
            "created_by": user_a["id"],
        })

        # Patient for doctor B (isolation test)
        b_patient_id = str(uuid.uuid4())
        await db.patients.insert_one({
            "id": b_patient_id,
            "patient_id": f"{RUN_TAG}-BPAT",
            "full_name": f"{RUN_TAG} B Patient",
            "birthdate": "1980-01-01",
            "sex": "male",
            "address": None, "mobile": None, "email": None,
            "emergency_contact_name": None, "emergency_contact_phone": None,
            "allergies": [], "chronic_conditions": [],
            "age": 45,
            "created_at": now, "updated_at": now,
            "owner_id": user_b["id"],
            "created_by": user_b["id"],
        })

        client.close()
        return target_id, b_patient_id

    target_pid, b_patient_pid = asyncio.get_event_loop().run_until_complete(_seed())

    ctx = {
        "session": s,
        "token_a": token_a, "user_a": user_a,
        "token_b": token_b, "user_b": user_b,
        "target_pid": target_pid,
        "b_patient_pid": b_patient_pid,
        "created_visit_ids": [],
    }

    yield ctx

    # ---------- cleanup ---------- #
    async def _cleanup():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.patients.delete_many({"$or": [
            {"owner_id": user_a["id"]},
            {"owner_id": user_b["id"]},
        ]})
        await db.visits.delete_many({"created_by": {"$in": [user_a["id"], user_b["id"]]}})
        await db.attachments.delete_many({"uploaded_by": {"$in": [user_a["id"], user_b["id"]]}})
        await db.prescriptions.delete_many({"created_by": {"$in": [user_a["id"], user_b["id"]]}})
        await db.certificates.delete_many({"created_by": {"$in": [user_a["id"], user_b["id"]]}})
        await db.lab_requests.delete_many({"created_by": {"$in": [user_a["id"], user_b["id"]]}})
        await db.users.delete_many({"id": {"$in": [user_a["id"], user_b["id"]]}})
        client.close()
    asyncio.get_event_loop().run_until_complete(_cleanup())


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- PRIMARY test: >1000 patients SOAP ---------- #

class TestPrimaryVisitsCap:
    def test_target_patient_visible_via_get_patient(self, seeded):
        """Sanity: the 1001st patient is retrievable via /patients/{id}."""
        r = requests.get(
            f"{API}/patients/{seeded['target_pid']}",
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r.status_code == 200, r.text
        assert r.json()["id"] == seeded["target_pid"]

    def test_create_visit_with_soap_for_1001st_patient(self, seeded):
        payload = {
            "patient_id": seeded["target_pid"],
            "soap_subjective": "Patient reports headache",
            "soap_objective": "BP 120/80, alert",
            "soap_assessment": "Tension headache",
            "soap_plan": "Ibuprofen 400mg PRN",
            "diagnosis_codes": ["R51"],
        }
        r = requests.post(
            f"{API}/visits", json=payload, headers=_auth_headers(seeded["token_a"])
        )
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["patient_id"] == seeded["target_pid"]
        assert v["soap_subjective"] == "Patient reports headache"
        assert v["soap_plan"] == "Ibuprofen 400mg PRN"
        seeded["created_visit_ids"].append(v["id"])

    def test_list_visits_by_patient_id_returns_soap(self, seeded):
        """The bug: this used to return []. After fix, must return the visit."""
        r = requests.get(
            f"{API}/visits?patient_id={seeded['target_pid']}",
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r.status_code == 200, r.text
        visits = r.json()
        assert isinstance(visits, list)
        assert len(visits) >= 1, "BUG REGRESSED: empty visits list for 1001st patient"
        assert any(
            v.get("soap_subjective") == "Patient reports headache" for v in visits
        ), "SOAP fields missing from returned visits"

    def test_get_visit_by_id_returns_soap(self, seeded):
        vid = seeded["created_visit_ids"][0]
        r = requests.get(
            f"{API}/visits/{vid}", headers=_auth_headers(seeded["token_a"])
        )
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["soap_assessment"] == "Tension headache"

    def test_update_visit_soap_persists(self, seeded):
        vid = seeded["created_visit_ids"][0]
        r = requests.put(
            f"{API}/visits/{vid}",
            json={"soap_plan": "Updated: Paracetamol 500mg q6h"},
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r.status_code == 200, r.text
        assert r.json()["soap_plan"] == "Updated: Paracetamol 500mg q6h"

        # verify by GET
        r2 = requests.get(
            f"{API}/visits/{vid}", headers=_auth_headers(seeded["token_a"])
        )
        assert r2.json()["soap_plan"] == "Updated: Paracetamol 500mg q6h"


# ---------- RELATED endpoints (attachments, prescriptions, certs, labs) ---------- #

class TestRelatedEndpointsForCap:
    def test_upload_and_get_attachment_for_1001st_patient(self, seeded):
        vid = seeded["created_visit_ids"][0]
        # multipart upload
        files = {"file": ("note.txt", io.BytesIO(b"hello"), "text/plain")}
        data = {
            "patient_id": seeded["target_pid"],
            "visit_id": vid,
            "tag": "other",
            "notes": "test",
        }
        r = requests.post(
            f"{API}/attachments",
            files=files, data=data,
            headers={"Authorization": f"Bearer {seeded['token_a']}"},
        )
        assert r.status_code == 200, r.text

        # scoped GET
        r2 = requests.get(
            f"{API}/attachments?patient_id={seeded['target_pid']}",
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r2.status_code == 200
        assert len(r2.json()) >= 1, "attachments empty for 1001st patient"

    def test_prescription_for_1001st_patient(self, seeded):
        vid = seeded["created_visit_ids"][0]
        r = requests.post(
            f"{API}/prescriptions",
            json={
                "visit_id": vid,
                "patient_id": seeded["target_pid"],
                "medications": [{"name": "Ibuprofen", "dose": "400mg"}],
            },
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r.status_code == 200, r.text

        r2 = requests.get(
            f"{API}/prescriptions?patient_id={seeded['target_pid']}",
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r2.status_code == 200
        assert len(r2.json()) >= 1

    def test_certificate_for_1001st_patient(self, seeded):
        vid = seeded["created_visit_ids"][0]
        r = requests.post(
            f"{API}/certificates",
            json={
                "visit_id": vid,
                "patient_id": seeded["target_pid"],
                "certificate_type": "medical_certificate",
                "content": {"diagnosis": "Tension headache", "rest_days": 1},
            },
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r.status_code == 200, r.text

        r2 = requests.get(
            f"{API}/certificates?patient_id={seeded['target_pid']}",
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r2.status_code == 200
        assert len(r2.json()) >= 1

    def test_lab_request_for_1001st_patient(self, seeded):
        vid = seeded["created_visit_ids"][0]
        r = requests.post(
            f"{API}/lab-requests",
            json={
                "visit_id": vid,
                "patient_id": seeded["target_pid"],
                "request_type": "lab",
                "tests": [{"name": "CBC", "instructions": ""}],
                "urgency": "routine",
            },
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r.status_code == 200, r.text

        r2 = requests.get(
            f"{API}/lab-requests?patient_id={seeded['target_pid']}",
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r2.status_code == 200
        assert len(r2.json()) >= 1


# ---------- REGRESSION: cross-owner isolation ---------- #

class TestCrossOwnerIsolation:
    def test_doctor_a_cannot_get_doctor_b_patient(self, seeded):
        r = requests.get(
            f"{API}/patients/{seeded['b_patient_pid']}",
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r.status_code == 404

    def test_doctor_a_visits_query_for_b_patient_returns_empty(self, seeded):
        r = requests.get(
            f"{API}/visits?patient_id={seeded['b_patient_pid']}",
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_doctor_a_cannot_create_visit_for_b_patient(self, seeded):
        r = requests.post(
            f"{API}/visits",
            json={
                "patient_id": seeded["b_patient_pid"],
                "soap_subjective": "should be blocked",
            },
            headers=_auth_headers(seeded["token_a"]),
        )
        assert r.status_code == 404
