"""
Backend tests for Labs & Imaging feature
Tests attachment upload, retrieval, and deletion with proper data isolation
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@clinic.com"
ADMIN_PASSWORD = "admin123"

# Test patient ID
TEST_PATIENT_ID = "7298a61e-9a6c-41fa-b2d1-7d2464e73dbf"


class TestAuthenticationAndBasics:
    """Basic authentication and API health tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        return data["token"]
    
    def test_api_health(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"API Health: {data}")
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"Login successful for: {data['user']['email']}")
    
    def test_get_me(self, auth_token):
        """Test get current user"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        print(f"Current user: {data['email']}")


class TestPatient:
    """Patient management tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_patient_by_id(self, auth_token):
        """Test fetching patient by ID"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/patients/{TEST_PATIENT_ID}", headers=headers)
        # Patient may or may not exist
        if response.status_code == 200:
            data = response.json()
            print(f"Found patient: {data.get('full_name')}")
            assert "full_name" in data
            assert "patient_id" in data
        else:
            print(f"Patient not found (status {response.status_code}) - will create new patient for tests")
    
    def test_get_patients_list(self, auth_token):
        """Test fetching patients list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/patients", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} patients")


class TestLabsImagingAttachments:
    """Tests for Labs & Imaging feature - attachment upload/view/delete"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def test_patient_id(self, auth_token):
        """Get or create test patient"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First try to get existing patients
        response = requests.get(f"{BASE_URL}/api/patients", headers=headers)
        assert response.status_code == 200
        patients = response.json()
        
        if patients:
            patient_id = patients[0]["id"]
            print(f"Using existing patient: {patients[0]['full_name']} (ID: {patient_id})")
            return patient_id
        
        # Create a new patient if none exist
        response = requests.post(f"{BASE_URL}/api/patients", headers=headers, json={
            "full_name": "TEST_Labs_Patient",
            "birthdate": "1990-01-15",
            "sex": "male",
            "mobile": "09171234567"
        })
        assert response.status_code in [200, 201], f"Failed to create patient: {response.text}"
        data = response.json()
        print(f"Created test patient: {data['full_name']} (ID: {data['id']})")
        return data["id"]
    
    def test_get_attachments_empty_or_existing(self, auth_token, test_patient_id):
        """Test fetching attachments for a patient"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/attachments", params={"patient_id": test_patient_id}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} existing attachments")
        return data
    
    def test_upload_lab_attachment(self, auth_token, test_patient_id):
        """Test uploading a lab result attachment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a simple test PNG image (1x1 red pixel)
        png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==")
        
        files = {"file": ("test_lab_result.png", png_data, "image/png")}
        data = {
            "patient_id": test_patient_id,
            "tag": "lab",
            "notes": "Test lab result from automated test"
        }
        
        response = requests.post(f"{BASE_URL}/api/attachments", headers=headers, files=files, data=data)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        attachment = response.json()
        assert "id" in attachment
        assert attachment["tag"] == "lab"
        assert attachment["filename"] == "test_lab_result.png"
        assert attachment["content_type"] == "image/png"
        print(f"Uploaded lab attachment: {attachment['id']}")
        return attachment["id"]
    
    def test_upload_xray_attachment(self, auth_token, test_patient_id):
        """Test uploading an X-Ray attachment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a simple test PNG image
        png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==")
        
        files = {"file": ("test_xray.png", png_data, "image/png")}
        data = {
            "patient_id": test_patient_id,
            "tag": "x-ray",
            "notes": "Test X-Ray from automated test"
        }
        
        response = requests.post(f"{BASE_URL}/api/attachments", headers=headers, files=files, data=data)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        attachment = response.json()
        assert "id" in attachment
        assert attachment["tag"] == "x-ray"
        print(f"Uploaded X-Ray attachment: {attachment['id']}")
        return attachment["id"]
    
    def test_upload_ultrasound_attachment(self, auth_token, test_patient_id):
        """Test uploading an Ultrasound attachment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==")
        
        files = {"file": ("test_ultrasound.png", png_data, "image/png")}
        data = {
            "patient_id": test_patient_id,
            "tag": "ultrasound",
            "notes": "Test Ultrasound from automated test"
        }
        
        response = requests.post(f"{BASE_URL}/api/attachments", headers=headers, files=files, data=data)
        assert response.status_code == 200
        attachment = response.json()
        assert attachment["tag"] == "ultrasound"
        print(f"Uploaded Ultrasound attachment: {attachment['id']}")
        return attachment["id"]
    
    def test_upload_ecg_attachment(self, auth_token, test_patient_id):
        """Test uploading an ECG attachment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==")
        
        files = {"file": ("test_ecg.png", png_data, "image/png")}
        data = {
            "patient_id": test_patient_id,
            "tag": "ecg",
            "notes": "Test ECG from automated test"
        }
        
        response = requests.post(f"{BASE_URL}/api/attachments", headers=headers, files=files, data=data)
        assert response.status_code == 200
        attachment = response.json()
        assert attachment["tag"] == "ecg"
        print(f"Uploaded ECG attachment: {attachment['id']}")
        return attachment["id"]
    
    def test_get_attachment_with_file_data(self, auth_token, test_patient_id):
        """Test fetching a single attachment with file data for preview"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First upload a file
        png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==")
        files = {"file": ("test_preview.png", png_data, "image/png")}
        data = {"patient_id": test_patient_id, "tag": "lab", "notes": "Test for preview"}
        
        upload_response = requests.post(f"{BASE_URL}/api/attachments", headers=headers, files=files, data=data)
        assert upload_response.status_code == 200
        attachment_id = upload_response.json()["id"]
        
        # Now fetch it with file_data
        get_response = requests.get(f"{BASE_URL}/api/attachments/{attachment_id}", headers=headers)
        assert get_response.status_code == 200
        
        attachment = get_response.json()
        assert "file_data" in attachment, "file_data should be present in single attachment fetch"
        assert attachment["content_type"] == "image/png"
        print(f"Retrieved attachment with file_data: {len(attachment['file_data'])} bytes (base64)")
        return attachment_id
    
    def test_delete_attachment(self, auth_token, test_patient_id):
        """Test deleting an attachment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First upload a file to delete
        png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==")
        files = {"file": ("test_to_delete.png", png_data, "image/png")}
        data = {"patient_id": test_patient_id, "tag": "other", "notes": "To be deleted"}
        
        upload_response = requests.post(f"{BASE_URL}/api/attachments", headers=headers, files=files, data=data)
        assert upload_response.status_code == 200
        attachment_id = upload_response.json()["id"]
        print(f"Created attachment to delete: {attachment_id}")
        
        # Delete the attachment
        delete_response = requests.delete(f"{BASE_URL}/api/attachments/{attachment_id}", headers=headers)
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"Deleted attachment: {attachment_id}")
        
        # Verify deletion by trying to fetch it
        verify_response = requests.get(f"{BASE_URL}/api/attachments/{attachment_id}", headers=headers)
        assert verify_response.status_code == 404, "Attachment should not exist after deletion"
        print("Verified attachment is deleted (404)")
    
    def test_filter_attachments_by_patient(self, auth_token, test_patient_id):
        """Test filtering attachments by patient_id"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/attachments", params={"patient_id": test_patient_id}, headers=headers)
        assert response.status_code == 200
        
        attachments = response.json()
        assert isinstance(attachments, list)
        
        # All attachments should belong to the same patient
        for att in attachments:
            assert att["patient_id"] == test_patient_id
        
        # Check for lab/imaging tags
        lab_imaging_tags = ["lab", "x-ray", "ultrasound", "ecg"]
        lab_imaging_count = sum(1 for att in attachments if att.get("tag") in lab_imaging_tags)
        print(f"Total attachments: {len(attachments)}, Labs & Imaging: {lab_imaging_count}")


class TestDataIsolation:
    """Tests for data isolation - files uploaded by one user should not be visible to another"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_create_second_user_and_verify_isolation(self, admin_token):
        """Test that a second user cannot see files from the first user"""
        # This test registers a new user and verifies data isolation
        
        # First, create a unique second user
        import uuid
        test_email = f"test_isolation_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "full_name": "Test Isolation User",
            "role": "doctor"
        })
        
        if response.status_code == 400:
            # User might already exist, skip this test
            print("Skipping isolation test - could not create test user")
            return
        
        assert response.status_code == 200, f"Failed to create test user: {response.text}"
        print(f"Created test user: {test_email}")
        
        # Login as the new user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "testpass123"
        })
        assert login_response.status_code == 200
        second_user_token = login_response.json()["token"]
        
        # Try to get patients (should be empty for new user)
        headers = {"Authorization": f"Bearer {second_user_token}"}
        patients_response = requests.get(f"{BASE_URL}/api/patients", headers=headers)
        assert patients_response.status_code == 200
        
        patients = patients_response.json()
        print(f"Second user sees {len(patients)} patients (should be 0 due to data isolation)")
        assert len(patients) == 0, "New user should not see other users' patients"
        
        # Try to get attachments (should be empty)
        attachments_response = requests.get(f"{BASE_URL}/api/attachments", headers=headers)
        assert attachments_response.status_code == 200
        
        attachments = attachments_response.json()
        print(f"Second user sees {len(attachments)} attachments (should be 0)")
        assert len(attachments) == 0, "New user should not see other users' attachments"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
