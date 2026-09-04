"""Backend test: unlimited export/backup for patients & visits + data isolation."""
import os
import uuid
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://voicedoc-system.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _register(email_prefix="doc"):
    email = f"TEST_{email_prefix}_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "full_name": "Test Doc",
        "email": email,
        "password": "Testpass123!",
        "role": "doctor",
    })
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in {data}"
    return token, email


def _headers(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _create_patient(tok, name):
    r = requests.post(f"{API}/patients", headers=_headers(tok), json={
        "full_name": name,
        "sex": "male",
        "birthdate": "1990-01-01",
    })
    assert r.status_code in (200, 201), f"create patient failed: {r.status_code} {r.text}"
    return r.json()


def _create_visit(tok, patient_id):
    r = requests.post(f"{API}/visits", headers=_headers(tok), json={
        "patient_id": patient_id,
        "chief_complaint": "Headache",
    })
    assert r.status_code in (200, 201), f"create visit failed: {r.status_code} {r.text}"
    return r.json()


class TestExportUnlimited:
    def test_export_patients_returns_all_no_cap(self):
        tok, _ = _register("exp")
        N = 12
        for i in range(N):
            _create_patient(tok, f"TEST_Pat_{i}_{uuid.uuid4().hex[:4]}")

        r = requests.get(f"{API}/export/patients", headers=_headers(tok))
        assert r.status_code == 200, r.text
        data = r.json()
        # shape
        assert set(data.keys()) >= {"data", "count", "total"}
        assert "skip" not in data and "limit" not in data
        assert isinstance(data["data"], list)
        assert data["count"] == data["total"] == N
        assert len(data["data"]) == N

    def test_export_visits_returns_all_no_cap(self):
        tok, _ = _register("expv")
        pat = _create_patient(tok, "TEST_VisitOwner")
        pid = pat["id"]
        N = 8
        for _ in range(N):
            _create_visit(tok, pid)

        r = requests.get(f"{API}/export/visits", headers=_headers(tok))
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data.keys()) >= {"data", "count", "total"}
        assert "skip" not in data and "limit" not in data
        assert data["count"] == data["total"] == N
        assert len(data["data"]) == N
        # enrichment fields
        assert "patient_name" in data["data"][0]

    def test_export_data_isolation(self):
        tok_a, _ = _register("iso_a")
        tok_b, _ = _register("iso_b")
        _create_patient(tok_a, "TEST_A_only_1")
        _create_patient(tok_a, "TEST_A_only_2")
        _create_patient(tok_b, "TEST_B_only_1")

        ra = requests.get(f"{API}/export/patients", headers=_headers(tok_a)).json()
        rb = requests.get(f"{API}/export/patients", headers=_headers(tok_b)).json()
        assert ra["total"] == 2
        assert rb["total"] == 1
        names_a = {p["full_name"] for p in ra["data"]}
        names_b = {p["full_name"] for p in rb["data"]}
        assert names_a.isdisjoint(names_b)
