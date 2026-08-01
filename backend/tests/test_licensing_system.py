"""Backend tests for Licensing System (Device-bound activation, Super Admin portal)."""
import os
import uuid
import base64
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://voicedoc-system.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_ADMIN_EMAIL = "superadmin@ddhapps.com"
SUPER_ADMIN_PASSWORD = "DDH_SuperAdmin_2026!"


def _mk_device_id():
    h = uuid.uuid4().hex.upper()
    return f"DDH-{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/license/admin/login", json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("role") == "super_admin"
    assert data.get("token")
    return data["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Public key ----------
def test_public_key_endpoint():
    r = requests.get(f"{API}/license/public-key")
    assert r.status_code == 200
    data = r.json()
    assert "public_key" in data
    # Should be base64-encoded 32-byte key
    key_bytes = base64.b64decode(data["public_key"])
    assert len(key_bytes) == 32


# ---------- Super admin auth ----------
def test_super_admin_login_success(admin_token):
    assert isinstance(admin_token, str)
    assert len(admin_token) > 20


def test_super_admin_login_invalid():
    r = requests.post(f"{API}/license/admin/login", json={"email": SUPER_ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_admin_endpoints_require_auth():
    r = requests.get(f"{API}/license/admin/stats")
    assert r.status_code in (401, 403)
    r = requests.get(f"{API}/license/admin/licenses")
    assert r.status_code in (401, 403)


# ---------- Stats ----------
def test_license_stats(admin_headers):
    r = requests.get(f"{API}/license/admin/stats", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    for key in ("total", "active", "pending", "revoked", "expired", "by_type"):
        assert key in data
    assert set(data["by_type"].keys()) >= {"lifetime", "yearly", "trial", "hospital"}


# ---------- Lifetime generation + activation flow ----------
@pytest.fixture(scope="module")
def lifetime_license(admin_headers):
    device_id = _mk_device_id()
    payload = {"device_id": device_id, "customer_name": "TEST_Lifetime", "license_type": "lifetime"}
    r = requests.post(f"{API}/license/admin/generate", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["device_id"] == device_id
    assert data["activation_code"].startswith("DDH-")
    assert data.get("offline_key")
    return {"device_id": device_id, **data}


def test_generate_lifetime(lifetime_license):
    assert lifetime_license["license_type"] == "lifetime"
    parts = lifetime_license["activation_code"].split("-")
    assert len(parts) == 5 and parts[0] == "DDH"


def test_activate_lifetime(lifetime_license):
    r = requests.post(f"{API}/license/activate", json={
        "device_id": lifetime_license["device_id"],
        "activation_code": lifetime_license["activation_code"]
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] in ("activated", "already_active")
    assert data["license"]["device_id"] == lifetime_license["device_id"]
    assert data["check"]["is_valid"] is True


def test_activate_invalid_code(lifetime_license):
    r = requests.post(f"{API}/license/activate", json={
        "device_id": lifetime_license["device_id"],
        "activation_code": "DDH-XXXX-XXXX-XXXX-XXXX"
    })
    assert r.status_code == 400
    assert "Invalid activation code" in r.json().get("detail", "")


def test_device_binding_wrong_device(lifetime_license, admin_headers):
    # Generate a code for one device
    other_device = _mk_device_id()
    r = requests.post(f"{API}/license/admin/generate", json={
        "device_id": other_device, "customer_name": "TEST_Binding", "license_type": "lifetime"
    }, headers=admin_headers)
    assert r.status_code == 200
    code_for_other = r.json()["activation_code"]
    # Try activating with wrong device_id
    r = requests.post(f"{API}/license/activate", json={
        "device_id": _mk_device_id(),
        "activation_code": code_for_other
    })
    assert r.status_code == 400


# ---------- Different license types ----------
@pytest.mark.parametrize("ltype", ["yearly", "trial", "hospital"])
def test_generate_other_license_types(admin_headers, ltype):
    device_id = _mk_device_id()
    body = {"device_id": device_id, "customer_name": f"TEST_{ltype}", "license_type": ltype}
    if ltype == "trial":
        body["trial_days"] = 14
    r = requests.post(f"{API}/license/admin/generate", json=body, headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["license_type"] == ltype
    if ltype in ("yearly", "trial"):
        assert data["expires_at"] is not None
    else:
        assert data["expires_at"] is None


# ---------- Revoke + Reactivate ----------
def test_revoke_and_reactivate(admin_headers):
    device_id = _mk_device_id()
    r = requests.post(f"{API}/license/admin/generate", json={
        "device_id": device_id, "customer_name": "TEST_Revoke", "license_type": "lifetime"
    }, headers=admin_headers)
    lic_id = r.json()["license_id"]
    # Activate first
    requests.post(f"{API}/license/activate", json={"device_id": device_id, "activation_code": r.json()["activation_code"]})
    # Revoke
    rr = requests.put(f"{API}/license/admin/revoke/{lic_id}", headers=admin_headers)
    assert rr.status_code == 200
    # Verify status
    gr = requests.get(f"{API}/license/admin/licenses/{lic_id}", headers=admin_headers)
    assert gr.json()["status"] == "revoked"
    # Reactivate
    ra = requests.put(f"{API}/license/admin/reactivate/{lic_id}", headers=admin_headers)
    assert ra.status_code == 200
    gr2 = requests.get(f"{API}/license/admin/licenses/{lic_id}", headers=admin_headers)
    assert gr2.json()["status"] == "active"


# ---------- Transfer ----------
def test_transfer_license(admin_headers):
    device_id = _mk_device_id()
    new_device = _mk_device_id()
    r = requests.post(f"{API}/license/admin/generate", json={
        "device_id": device_id, "customer_name": "TEST_Transfer", "license_type": "lifetime"
    }, headers=admin_headers)
    lic_id = r.json()["license_id"]
    rt = requests.put(f"{API}/license/admin/transfer/{lic_id}", json={"new_device_id": new_device}, headers=admin_headers)
    assert rt.status_code == 200
    data = rt.json()
    assert data["new_device_id"] == new_device
    # Verify persisted
    gr = requests.get(f"{API}/license/admin/licenses/{lic_id}", headers=admin_headers)
    assert gr.json()["device_id"] == new_device
    assert gr.json()["status"] == "pending"


# ---------- Extend ----------
def test_extend_license(admin_headers):
    device_id = _mk_device_id()
    r = requests.post(f"{API}/license/admin/generate", json={
        "device_id": device_id, "customer_name": "TEST_Extend", "license_type": "yearly"
    }, headers=admin_headers)
    lic_id = r.json()["license_id"]
    original_exp = r.json()["expires_at"]
    re = requests.put(f"{API}/license/admin/extend/{lic_id}", json={"additional_days": 30}, headers=admin_headers)
    assert re.status_code == 200, re.text
    assert re.json()["new_expires_at"] != original_exp


# ---------- Delete ----------
def test_delete_license(admin_headers):
    device_id = _mk_device_id()
    r = requests.post(f"{API}/license/admin/generate", json={
        "device_id": device_id, "customer_name": "TEST_Delete", "license_type": "lifetime"
    }, headers=admin_headers)
    lic_id = r.json()["license_id"]
    rd = requests.delete(f"{API}/license/admin/licenses/{lic_id}", headers=admin_headers)
    assert rd.status_code == 200
    # Verify gone
    gr = requests.get(f"{API}/license/admin/licenses/{lic_id}", headers=admin_headers)
    assert gr.status_code == 404


# ---------- Audit log ----------
def test_audit_logs(admin_headers):
    r = requests.get(f"{API}/license/admin/audit", headers=admin_headers)
    assert r.status_code == 200
    logs = r.json().get("logs", [])
    assert isinstance(logs, list)
    # Should include actions like generated, activated, revoked
    actions = {log["action"] for log in logs}
    assert actions & {"generated", "activated", "revoked", "transferred", "extended", "deleted"}


# ---------- List licenses ----------
def test_list_licenses(admin_headers):
    r = requests.get(f"{API}/license/admin/licenses", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert "licenses" in data
    assert isinstance(data["licenses"], list)


# ---------- Offline activation ----------
def test_offline_activation(admin_headers):
    device_id = _mk_device_id()
    r = requests.post(f"{API}/license/admin/generate", json={
        "device_id": device_id, "customer_name": "TEST_Offline", "license_type": "lifetime"
    }, headers=admin_headers)
    offline_key = r.json()["offline_key"]
    ro = requests.post(f"{API}/license/activate-offline",
                      data={"device_id": device_id, "offline_key": offline_key})
    assert ro.status_code == 200, ro.text
    assert ro.json()["status"] == "activated"


# ---------- Cleanup: delete TEST_ licenses ----------
def test_cleanup_test_licenses(admin_headers):
    r = requests.get(f"{API}/license/admin/licenses", headers=admin_headers)
    for lic in r.json().get("licenses", []):
        if lic.get("customer_name", "").startswith("TEST_"):
            requests.delete(f"{API}/license/admin/licenses/{lic['id']}", headers=admin_headers)
