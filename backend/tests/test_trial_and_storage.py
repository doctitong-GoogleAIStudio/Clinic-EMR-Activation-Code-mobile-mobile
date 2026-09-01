"""
Regression + functional tests for:
 1. Self-service 7-day trial (POST /api/license/start-trial, POST /api/license/check)
 2. Object-storage attachment migration (upload, download, list, update, delete)
"""
import os
import io
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://voicedoc-system.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ------------------------ Fixtures ------------------------

@pytest.fixture(scope="module")
def api_session():
    s = requests.Session()
    return s


@pytest.fixture(scope="module")
def doctor_account(api_session):
    """Register a fresh doctor account and return {token, user, email, password}."""
    email = f"TEST_doc_{uuid.uuid4().hex[:8]}@example.com"
    password = "testpass123"
    r = api_session.post(f"{API}/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "TEST Doctor Trial Regression",
        "role": "doctor"
    })
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in register response: {data}"
    return {"token": token, "email": email, "password": password, "user": data.get("user", {})}


@pytest.fixture(scope="module")
def auth_headers(doctor_account):
    return {"Authorization": f"Bearer {doctor_account['token']}"}


# ------------------------ Trial tests ------------------------

class TestTrialSystem:
    def test_start_trial_fresh_device(self, api_session):
        device_id = f"TEST_dev_{uuid.uuid4().hex}"
        payload = {
            "device_id": device_id,
            "customer_name": "TEST Trial User",
            "customer_email": f"TEST_trial_{uuid.uuid4().hex[:6]}@example.com",
            "password": "trialpass123"
        }
        r = api_session.post(f"{API}/license/start-trial", json=payload)
        assert r.status_code == 200, f"start-trial failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("success") is True
        lic = data.get("license") or {}
        chk = data.get("check") or {}
        assert lic.get("device_id") == device_id
        assert lic.get("license_type") == "trial"
        assert lic.get("customer_email") == payload["customer_email"]
        assert lic.get("expires_at"), "expires_at missing"
        assert chk.get("is_valid") is True, f"trial should be valid, got: {chk}"
        # store for chain
        pytest.trial_device_id = device_id
        pytest.trial_expires_at = lic["expires_at"]

    def test_start_trial_repeat_returns_existing_valid(self, api_session):
        device_id = getattr(pytest, "trial_device_id", None)
        assert device_id, "prev test did not set device id"
        payload = {
            "device_id": device_id,
            "customer_name": "TEST Trial User2",
            "customer_email": "TEST_other@example.com",
            "password": "anotherpass"
        }
        r = api_session.post(f"{API}/license/start-trial", json=payload)
        assert r.status_code == 200, f"repeat start-trial failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["check"]["is_valid"] is True
        # Should return existing device's data (device_id unchanged; expires_at same as first)
        assert data["license"]["device_id"] == device_id
        assert data["license"]["expires_at"] == pytest.trial_expires_at

    def test_license_check_via_form(self, api_session):
        device_id = getattr(pytest, "trial_device_id", None)
        assert device_id
        # /api/license/check expects form field device_id
        r = api_session.post(f"{API}/license/check", data={"device_id": device_id})
        assert r.status_code == 200, f"check failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("exists") is True
        assert data.get("is_valid") is True
        assert data.get("status") == "active"

    def test_license_check_unknown_device(self, api_session):
        device_id = f"TEST_unknown_{uuid.uuid4().hex}"
        r = api_session.post(f"{API}/license/check", data={"device_id": device_id})
        assert r.status_code == 200
        data = r.json()
        assert data.get("exists") is False


# ------------------------ Attachment / Object Storage tests ------------------------

class TestAttachmentStorage:
    def test_upload_returns_storage_path(self, api_session, auth_headers):
        # Create a patient
        r = api_session.post(f"{API}/patients", headers=auth_headers, json={
            "full_name": "TEST Patient Storage",
            "birthdate": "1990-01-01",
            "sex": "male",
            "phone": "1234567890"
        })
        assert r.status_code in (200, 201), f"create patient failed: {r.text}"
        patient_id = r.json()["id"]
        pytest.att_patient_id = patient_id

        file_bytes = b"Hello object storage! " + uuid.uuid4().hex.encode()
        pytest.att_expected_bytes = file_bytes

        files = {"file": ("test.txt", io.BytesIO(file_bytes), "text/plain")}
        data = {"patient_id": patient_id, "tag": "other", "notes": "regression"}
        r = api_session.post(f"{API}/attachments", headers=auth_headers, files=files, data=data)
        assert r.status_code in (200, 201), f"upload failed: {r.status_code} {r.text}"
        att = r.json()
        assert att.get("id")
        assert att.get("storage_path"), f"storage_path missing: {att}"
        assert att["storage_path"].startswith("private-clinic-emr/attachments/"), (
            f"unexpected storage_path prefix: {att['storage_path']}"
        )
        assert att.get("file_size") == len(file_bytes)
        pytest.att_id = att["id"]

    def test_download_returns_exact_bytes(self, api_session, auth_headers):
        att_id = pytest.att_id
        r = api_session.get(f"{API}/attachments/{att_id}/file", headers=auth_headers)
        assert r.status_code == 200, f"download failed: {r.status_code} {r.text[:200]}"
        assert r.content == pytest.att_expected_bytes, "downloaded bytes mismatch"

    def test_list_attachments(self, api_session, auth_headers):
        r = api_session.get(f"{API}/attachments", headers=auth_headers,
                            params={"patient_id": pytest.att_patient_id})
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(a["id"] == pytest.att_id for a in items), "uploaded attachment not in list"

    def test_update_attachment_metadata(self, api_session, auth_headers):
        r = api_session.put(f"{API}/attachments/{pytest.att_id}", headers=auth_headers, json={
            "tag": "lab_report",
            "notes": "updated notes"
        })
        assert r.status_code == 200, f"update failed: {r.status_code} {r.text}"
        # Verify via GET
        g = api_session.get(f"{API}/attachments/{pytest.att_id}", headers=auth_headers)
        assert g.status_code == 200
        data = g.json()
        assert data.get("tag") == "lab_report"
        assert data.get("notes") == "updated notes"

    def test_delete_attachment(self, api_session, auth_headers):
        r = api_session.delete(f"{API}/attachments/{pytest.att_id}", headers=auth_headers)
        assert r.status_code in (200, 204), f"delete failed: {r.status_code} {r.text}"
        # verify gone
        g = api_session.get(f"{API}/attachments/{pytest.att_id}", headers=auth_headers)
        assert g.status_code == 404
