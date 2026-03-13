"""
Test suite for Restore Backup API feature
Tests: POST /api/restore with merge/replace modes and restore_type options
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials - will be created fresh for test isolation
TEST_USER_EMAIL = f"restore_test_{uuid.uuid4().hex[:8]}@test.com"
TEST_USER_PASSWORD = "test123"
TEST_USER_NAME = "Restore Test Doctor"


class TestRestoreBackupAPI:
    """Test suite for POST /api/restore endpoint"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def test_user(self, api_client):
        """Register a fresh test user for isolation"""
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "full_name": TEST_USER_NAME,
            "role": "doctor"
        })
        assert response.status_code == 200, f"Failed to register test user: {response.text}"
        data = response.json()
        return {"token": data["token"], "user": data["user"]}
    
    @pytest.fixture(scope="class")
    def auth_headers(self, test_user):
        """Auth headers for authenticated requests"""
        return {"Authorization": f"Bearer {test_user['token']}"}
    
    # --- Test restore with merge mode (patients only) ---
    def test_restore_merge_patients_only(self, api_client, auth_headers):
        """Test: POST /api/restore with mode='merge' and restore_type='patients' should add new patients, skip duplicates"""
        # First restore - 2 patients
        payload = {
            "patients": [
                {"full_name": "Test Patient Alpha", "birthdate": "1990-01-15", "sex": "Male", "mobile": "09171111111"},
                {"full_name": "Test Patient Beta", "birthdate": "1985-06-20", "sex": "Female", "mobile": "09172222222"}
            ],
            "visits": None,
            "mode": "merge",
            "restore_type": "patients"
        }
        response = api_client.post(f"{BASE_URL}/api/restore", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Restore failed: {response.text}"
        result = response.json()
        
        # Verify patients were restored
        assert result["patients_restored"] == 2, f"Expected 2 patients restored, got {result['patients_restored']}"
        assert result["patients_skipped"] == 0, "Should not skip any on first restore"
        assert result["patients_failed"] == 0, "No failures expected"
        print(f"✅ First restore: {result['patients_restored']} patients restored")
        
        # Second restore - same patients (should skip due to dedup by name+birthdate)
        response2 = api_client.post(f"{BASE_URL}/api/restore", json=payload, headers=auth_headers)
        assert response2.status_code == 200
        result2 = response2.json()
        
        assert result2["patients_restored"] == 0, "Should not restore duplicates in merge mode"
        assert result2["patients_skipped"] == 2, f"Expected 2 skipped, got {result2['patients_skipped']}"
        print(f"✅ Second restore (merge): {result2['patients_skipped']} patients skipped as duplicates")
    
    # --- Test restore with replace mode (patients only) ---
    def test_restore_replace_patients_only(self, api_client, auth_headers):
        """Test: POST /api/restore with mode='replace' and restore_type='patients' should delete existing then import"""
        # First, restore some patients
        payload = {
            "patients": [
                {"full_name": "Replace Test A", "birthdate": "1980-03-10", "sex": "Male"},
                {"full_name": "Replace Test B", "birthdate": "1975-12-25", "sex": "Female"}
            ],
            "visits": None,
            "mode": "merge",
            "restore_type": "patients"
        }
        response = api_client.post(f"{BASE_URL}/api/restore", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        # Now replace with different set
        replace_payload = {
            "patients": [
                {"full_name": "New Replace Patient", "birthdate": "2000-01-01", "sex": "Male"}
            ],
            "visits": None,
            "mode": "replace",
            "restore_type": "patients"
        }
        response2 = api_client.post(f"{BASE_URL}/api/restore", json=replace_payload, headers=auth_headers)
        assert response2.status_code == 200
        result = response2.json()
        
        assert result["patients_deleted"] > 0, "Should delete existing patients in replace mode"
        assert result["patients_restored"] == 1, f"Expected 1 patient restored, got {result['patients_restored']}"
        print(f"✅ Replace mode: Deleted {result['patients_deleted']} patients, restored {result['patients_restored']}")
    
    # --- Test restore with both patients and visits ---
    def test_restore_merge_both(self, api_client, auth_headers):
        """Test: POST /api/restore with mode='merge' and restore_type='both' should restore both patients and visits"""
        payload = {
            "patients": [
                {"full_name": "Visit Test Patient", "birthdate": "1995-05-15", "sex": "Male", "mobile": "09173333333"}
            ],
            "visits": [
                {
                    "patient_name": "Visit Test Patient",
                    "soap_subjective": "Chief complaint: Headache x 2 days",
                    "soap_objective": "BP 120/80, HR 72",
                    "soap_assessment": "Tension headache",
                    "soap_plan": "Paracetamol PRN"
                }
            ],
            "mode": "merge",
            "restore_type": "both"
        }
        response = api_client.post(f"{BASE_URL}/api/restore", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Restore failed: {response.text}"
        result = response.json()
        
        assert result["patients_restored"] >= 1 or result["patients_skipped"] >= 1, "Patient should be restored or skipped"
        assert result["visits_restored"] == 1, f"Expected 1 visit restored, got {result['visits_restored']}"
        assert len(result["errors"]) == 0, f"Unexpected errors: {result['errors']}"
        print(f"✅ Both mode: {result['patients_restored']} patients, {result['visits_restored']} visits restored")
    
    # --- Test restore visits only with replace mode ---
    def test_restore_replace_visits_only(self, api_client, auth_headers):
        """Test: POST /api/restore with mode='replace' and restore_type='visits' should delete existing visits then import"""
        # First ensure patient exists
        patient_payload = {
            "patients": [{"full_name": "Visits Replace Patient", "birthdate": "1992-08-08", "sex": "Female"}],
            "visits": None,
            "mode": "merge",
            "restore_type": "patients"
        }
        api_client.post(f"{BASE_URL}/api/restore", json=patient_payload, headers=auth_headers)
        
        # Restore initial visit
        visit_payload = {
            "patients": None,
            "visits": [{"patient_name": "Visits Replace Patient", "soap_subjective": "First visit"}],
            "mode": "merge",
            "restore_type": "visits"
        }
        api_client.post(f"{BASE_URL}/api/restore", json=visit_payload, headers=auth_headers)
        
        # Now replace visits
        replace_payload = {
            "patients": None,
            "visits": [{"patient_name": "Visits Replace Patient", "soap_subjective": "Replacement visit"}],
            "mode": "replace",
            "restore_type": "visits"
        }
        response = api_client.post(f"{BASE_URL}/api/restore", json=replace_payload, headers=auth_headers)
        assert response.status_code == 200
        result = response.json()
        
        # Should have deleted visits and restored new
        assert result["visits_deleted"] >= 1, f"Should delete visits, deleted: {result['visits_deleted']}"
        assert result["visits_restored"] == 1, f"Expected 1 visit restored, got {result['visits_restored']}"
        print(f"✅ Replace visits: Deleted {result['visits_deleted']}, restored {result['visits_restored']}")
    
    # --- Test missing required fields error ---
    def test_restore_missing_required_fields(self, api_client, auth_headers):
        """Test: POST /api/restore returns proper error for missing required fields in patient data"""
        payload = {
            "patients": [
                {"full_name": "Incomplete Patient"}  # Missing birthdate and sex
            ],
            "visits": None,
            "mode": "merge",
            "restore_type": "patients"
        }
        response = api_client.post(f"{BASE_URL}/api/restore", json=payload, headers=auth_headers)
        assert response.status_code == 200
        result = response.json()
        
        assert result["patients_failed"] == 1, f"Expected 1 failed, got {result['patients_failed']}"
        assert len(result["errors"]) == 1, "Should have error message"
        assert "Missing required field" in result["errors"][0]
        print(f"✅ Missing fields error: {result['errors'][0]}")
    
    # --- Test visits skipped when patient not found ---
    def test_restore_visit_patient_not_found(self, api_client, auth_headers):
        """Test: Visits for non-existent patients should be skipped with warning"""
        payload = {
            "patients": None,
            "visits": [
                {"patient_name": "Non Existent Patient XYZ 12345", "soap_subjective": "Test"}
            ],
            "mode": "merge",
            "restore_type": "visits"
        }
        response = api_client.post(f"{BASE_URL}/api/restore", json=payload, headers=auth_headers)
        assert response.status_code == 200
        result = response.json()
        
        assert result["visits_skipped"] == 1, f"Expected 1 skipped, got {result['visits_skipped']}"
        assert len(result["warnings"]) == 1, "Should have warning"
        assert "not found" in result["warnings"][0].lower()
        print(f"✅ Visit skipped warning: {result['warnings'][0]}")
    
    # --- Test receptionist cannot restore ---
    def test_restore_rejects_receptionist(self, api_client, test_user, auth_headers):
        """Test: POST /api/restore rejects non-doctor/admin users"""
        # Create a receptionist
        rec_email = f"receptionist_{uuid.uuid4().hex[:8]}@test.com"
        create_response = api_client.post(
            f"{BASE_URL}/api/users/create-receptionist",
            json={"full_name": "Test Receptionist", "email": rec_email, "password": "test123"},
            headers=auth_headers
        )
        assert create_response.status_code == 200, f"Failed to create receptionist: {create_response.text}"
        
        # Login as receptionist
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": rec_email,
            "password": "test123"
        })
        assert login_response.status_code == 200
        rec_token = login_response.json()["token"]
        
        # Try restore as receptionist - should fail
        payload = {
            "patients": [{"full_name": "Test", "birthdate": "2000-01-01", "sex": "Male"}],
            "visits": None,
            "mode": "merge",
            "restore_type": "patients"
        }
        response = api_client.post(
            f"{BASE_URL}/api/restore",
            json=payload,
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for receptionist, got {response.status_code}"
        print("✅ Receptionist correctly rejected from restore")
    
    # --- Test restore requires authentication ---
    def test_restore_requires_auth(self, api_client):
        """Test: POST /api/restore requires authentication"""
        payload = {
            "patients": [{"full_name": "Test", "birthdate": "2000-01-01", "sex": "Male"}],
            "mode": "merge",
            "restore_type": "patients"
        }
        response = api_client.post(f"{BASE_URL}/api/restore", json=payload)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✅ Unauthenticated restore correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
