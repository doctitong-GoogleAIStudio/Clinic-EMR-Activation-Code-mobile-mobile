"""
Test SOAP persistence in visits and Cache-Control no-store headers on /api responses.
Covers iteration_20 bug: SOAP notes appearing blank after refresh.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def auth_headers():
    email = f"TEST_soap_{uuid.uuid4().hex[:8]}@example.com"
    reg = requests.post(f"{API}/auth/register", json={
        "email": email,
        "password": "TestPass123!",
        "name": "Dr SOAP Tester",
        "full_name": "Dr SOAP Tester",
        "role": "doctor"
    })
    assert reg.status_code in (200, 201), f"register failed: {reg.status_code} {reg.text}"
    token = reg.json().get("access_token") or reg.json().get("token")
    if not token:
        login = requests.post(f"{API}/auth/login", json={"email": email, "password": "TestPass123!"})
        assert login.status_code == 200, login.text
        token = login.json().get("access_token") or login.json().get("token")
    assert token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def patient_id(auth_headers):
    r = requests.post(f"{API}/patients", headers=auth_headers, json={
        "full_name": "TEST SOAP Patient",
        "birthdate": "1980-01-15",
        "sex": "male",
        "phone": "5551112222",
    })
    assert r.status_code in (200, 201), r.text
    data = r.json()
    return data.get("id") or data.get("_id") or data.get("patient_id")


# --- Cache-Control header tests ---

def test_root_api_has_no_store():
    r = requests.get(f"{API}/")
    cc = r.headers.get("Cache-Control", "").lower()
    assert "no-store" in cc or "no-cache" in cc, f"Cache-Control missing: {r.headers}"


def test_get_visit_has_no_store(auth_headers, patient_id):
    # Create visit first
    payload = {
        "patient_id": patient_id,
        "chief_complaint": "cache header test",
        "soap_subjective": "S text",
        "soap_objective": "O text",
        "soap_assessment": "A text",
        "soap_plan": "P text",
    }
    c = requests.post(f"{API}/visits", headers=auth_headers, json=payload)
    assert c.status_code in (200, 201), c.text
    vid = c.json().get("id")
    r = requests.get(f"{API}/visits/{vid}", headers=auth_headers)
    assert r.status_code == 200
    cc = r.headers.get("Cache-Control", "").lower()
    assert "no-store" in cc, f"GET /api/visits/{vid} missing no-store, got: {r.headers.get('Cache-Control')}"


# --- SOAP persistence: create + get + update ---

def test_soap_create_get_update_lifecycle(auth_headers, patient_id):
    # CREATE
    payload = {
        "patient_id": patient_id,
        "chief_complaint": "headache",
        "vitals": {"bp_systolic": 120, "bp_diastolic": 80, "heart_rate": 72, "temperature": 36.8},
        "soap_subjective": "Patient reports throbbing headache for 3 days",
        "soap_objective": "BP 120/80, alert, oriented",
        "soap_assessment": "Tension headache",
        "soap_plan": "Ibuprofen 400mg PRN, hydration, follow-up in 1 week",
    }
    c = requests.post(f"{API}/visits", headers=auth_headers, json=payload)
    assert c.status_code in (200, 201), c.text
    created = c.json()
    vid = created["id"]
    assert created["soap_subjective"] == payload["soap_subjective"]
    assert created["soap_assessment"] == payload["soap_assessment"]

    # GET to verify persistence
    g = requests.get(f"{API}/visits/{vid}", headers=auth_headers)
    assert g.status_code == 200
    got = g.json()
    for k in ("soap_subjective", "soap_objective", "soap_assessment", "soap_plan"):
        assert got[k] == payload[k], f"{k} not persisted: {got.get(k)!r} vs {payload[k]!r}"

    # UPDATE
    upd = {
        "soap_subjective": "UPDATED: patient improved",
        "soap_assessment": "UPDATED: resolving tension headache",
    }
    u = requests.put(f"{API}/visits/{vid}", headers=auth_headers, json=upd)
    assert u.status_code == 200, u.text

    # GET again — verify update persisted
    g2 = requests.get(f"{API}/visits/{vid}", headers=auth_headers)
    assert g2.status_code == 200
    got2 = g2.json()
    assert got2["soap_subjective"] == upd["soap_subjective"]
    assert got2["soap_assessment"] == upd["soap_assessment"]
    # Unchanged fields intact
    assert got2["soap_objective"] == payload["soap_objective"]
    assert got2["soap_plan"] == payload["soap_plan"]
