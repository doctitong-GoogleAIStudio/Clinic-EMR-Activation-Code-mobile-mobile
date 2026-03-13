"""
Test Export/Backup APIs
- GET /api/export/patients - returns paginated patient data
- GET /api/export/visits - returns paginated visit data
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestExportAPIs:
    """Test export endpoints for data backup functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user with patient and visit data"""
        self.test_id = str(uuid.uuid4())[:8]
        self.test_email = f"export_test_{self.test_id}@test.com"
        self.test_password = "test123"
        
        # Register a new test doctor
        register_resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": self.test_email,
                "password": self.test_password,
                "full_name": f"Export Test Doctor {self.test_id}",
                "role": "doctor"
            }
        )
        
        if register_resp.status_code == 200:
            self.token = register_resp.json().get("token")
        else:
            # User may exist, try login
            login_resp = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": self.test_email, "password": self.test_password}
            )
            assert login_resp.status_code == 200, f"Failed to login: {login_resp.text}"
            self.token = login_resp.json().get("token")
        
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_export_patients_returns_paginated_response(self):
        """Test that /api/export/patients returns paginated response structure"""
        response = requests.get(
            f"{BASE_URL}/api/export/patients",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify paginated structure
        assert "data" in data, "Response missing 'data' field"
        assert "count" in data, "Response missing 'count' field"
        assert "total" in data, "Response missing 'total' field"
        assert "skip" in data, "Response missing 'skip' field"
        assert "limit" in data, "Response missing 'limit' field"
        
        assert isinstance(data["data"], list), "'data' should be a list"
        assert isinstance(data["count"], int), "'count' should be an integer"
        assert isinstance(data["total"], int), "'total' should be an integer"
        
        print(f"Export patients returned: count={data['count']}, total={data['total']}")
    
    def test_export_visits_returns_paginated_response(self):
        """Test that /api/export/visits returns paginated response structure"""
        response = requests.get(
            f"{BASE_URL}/api/export/visits",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify paginated structure
        assert "data" in data, "Response missing 'data' field"
        assert "count" in data, "Response missing 'count' field"
        assert "total" in data, "Response missing 'total' field"
        
        assert isinstance(data["data"], list), "'data' should be a list"
        
        print(f"Export visits returned: count={data['count']}, total={data['total']}")
    
    def test_export_patients_requires_auth(self):
        """Test that /api/export/patients requires authentication"""
        response = requests.get(f"{BASE_URL}/api/export/patients")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_export_visits_requires_auth(self):
        """Test that /api/export/visits requires authentication"""
        response = requests.get(f"{BASE_URL}/api/export/visits")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_export_with_data(self):
        """Test export returns actual data when user has patients"""
        # Create a test patient
        patient_resp = requests.post(
            f"{BASE_URL}/api/patients",
            headers=self.headers,
            json={
                "full_name": f"TEST_Export_Patient_{self.test_id}",
                "birthdate": "1990-05-15",
                "sex": "male",
                "mobile": "09123456789"
            }
        )
        assert patient_resp.status_code == 200, f"Failed to create patient: {patient_resp.text}"
        patient_id = patient_resp.json()["id"]
        
        # Export patients should now return at least one
        export_resp = requests.get(
            f"{BASE_URL}/api/export/patients",
            headers=self.headers
        )
        assert export_resp.status_code == 200
        
        data = export_resp.json()
        assert data["count"] >= 1, "Expected at least 1 patient in export"
        assert data["total"] >= 1, "Expected total >= 1"
        
        # Verify patient data structure
        patients = data["data"]
        assert len(patients) >= 1
        
        found_test_patient = any(p.get("full_name", "").startswith("TEST_Export_Patient") for p in patients)
        assert found_test_patient, "Test patient not found in export"
        
        print(f"Export with data: found {data['count']} patients")
        
        # Cleanup: delete the test patient
        requests.delete(f"{BASE_URL}/api/patients/{patient_id}", headers=self.headers)
    
    def test_export_visits_date_filtering(self):
        """Test that /api/export/visits accepts date filters"""
        response = requests.get(
            f"{BASE_URL}/api/export/visits",
            headers=self.headers,
            params={
                "date_from": "2024-01-01",
                "date_to": "2026-12-31"
            }
        )
        
        assert response.status_code == 200, f"Expected 200 with date filters, got {response.status_code}"
        
        data = response.json()
        assert "data" in data
        print(f"Export visits with date filter: count={data['count']}")


class TestBackupWithExistingUser:
    """Test backup functionality with the provided test account"""
    
    def test_backup_test_user_login(self):
        """Test that backup_test@test.com can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "backup_test@test.com", "password": "test123"}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response missing token"
        assert "user" in data, "Response missing user"
        
        print(f"backup_test@test.com login successful")
    
    def test_backup_test_user_export_patients(self):
        """Test export patients with backup_test@test.com"""
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "backup_test@test.com", "password": "test123"}
        )
        token = login_resp.json().get("token")
        
        response = requests.get(
            f"{BASE_URL}/api/export/patients",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "data" in data
        assert "count" in data
        assert "total" in data
        
        print(f"backup_test user export: {data['count']} patients")
    
    def test_backup_test_user_export_visits(self):
        """Test export visits with backup_test@test.com"""
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "backup_test@test.com", "password": "test123"}
        )
        token = login_resp.json().get("token")
        
        response = requests.get(
            f"{BASE_URL}/api/export/visits",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "data" in data
        assert "count" in data
        
        print(f"backup_test user export visits: {data['count']} visits")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
