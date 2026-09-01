"""
Tests for the attachment edit/rename feature (PUT /api/attachments/{id})
This test file covers the new edit functionality for Labs & Imaging attachments.
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAttachmentEdit:
    """Tests for PUT /api/attachments/{id} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token, create test patient and attachment"""
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@clinic.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create test patient
        patient_response = requests.post(f"{BASE_URL}/api/patients", json={
            "full_name": "TEST_Edit Attachment Patient",
            "birthdate": "1990-01-15",
            "sex": "male"
        }, headers=self.headers)
        assert patient_response.status_code == 200, f"Patient creation failed: {patient_response.text}"
        self.patient_id = patient_response.json()["id"]
        
        # Create test attachment (upload a file)
        files = {
            'file': ('TEST_original_filename.png', io.BytesIO(b'test image content'), 'image/png')
        }
        data = {
            'patient_id': self.patient_id,
            'tag': 'lab',
            'notes': 'Original notes'
        }
        upload_response = requests.post(
            f"{BASE_URL}/api/attachments",
            files=files,
            data=data,
            headers=self.headers
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        self.attachment_id = upload_response.json()["id"]
        
        yield
        
        # Cleanup
        try:
            requests.delete(f"{BASE_URL}/api/attachments/{self.attachment_id}", headers=self.headers)
            requests.delete(f"{BASE_URL}/api/patients/{self.patient_id}", headers=self.headers)
        except Exception:
            pass
    
    def test_edit_filename_success(self):
        """Test renaming a file (changing filename)"""
        update_response = requests.put(
            f"{BASE_URL}/api/attachments/{self.attachment_id}",
            json={"filename": "TEST_renamed_file.png"},
            headers=self.headers
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated_data = update_response.json()
        assert updated_data["filename"] == "TEST_renamed_file.png", "Filename was not updated"
        
        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/attachments/{self.attachment_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["filename"] == "TEST_renamed_file.png"
        print("PASS: Filename successfully renamed")
    
    def test_edit_tag_success(self):
        """Test changing the tag (lab -> x-ray)"""
        update_response = requests.put(
            f"{BASE_URL}/api/attachments/{self.attachment_id}",
            json={"tag": "x-ray"},
            headers=self.headers
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated_data = update_response.json()
        assert updated_data["tag"] == "x-ray", "Tag was not updated"
        
        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/attachments/{self.attachment_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["tag"] == "x-ray"
        print("PASS: Tag successfully changed")
    
    def test_edit_notes_success(self):
        """Test editing notes"""
        update_response = requests.put(
            f"{BASE_URL}/api/attachments/{self.attachment_id}",
            json={"notes": "Updated notes content"},
            headers=self.headers
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated_data = update_response.json()
        assert updated_data["notes"] == "Updated notes content", "Notes were not updated"
        
        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/attachments/{self.attachment_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["notes"] == "Updated notes content"
        print("PASS: Notes successfully edited")
    
    def test_edit_all_fields_at_once(self):
        """Test updating filename, tag, and notes all at once"""
        update_response = requests.put(
            f"{BASE_URL}/api/attachments/{self.attachment_id}",
            json={
                "filename": "TEST_all_fields_updated.png",
                "tag": "ultrasound",
                "notes": "All fields updated at once"
            },
            headers=self.headers
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated_data = update_response.json()
        assert updated_data["filename"] == "TEST_all_fields_updated.png"
        assert updated_data["tag"] == "ultrasound"
        assert updated_data["notes"] == "All fields updated at once"
        
        # Verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/attachments/{self.attachment_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["filename"] == "TEST_all_fields_updated.png"
        assert data["tag"] == "ultrasound"
        assert data["notes"] == "All fields updated at once"
        print("PASS: All fields updated successfully at once")
    
    def test_edit_with_empty_request_fails(self):
        """Test that empty update request returns 400"""
        update_response = requests.put(
            f"{BASE_URL}/api/attachments/{self.attachment_id}",
            json={},
            headers=self.headers
        )
        assert update_response.status_code == 400, f"Expected 400 for empty update: {update_response.text}"
        print("PASS: Empty update request rejected with 400")
    
    def test_edit_nonexistent_attachment_fails(self):
        """Test that updating non-existent attachment returns 404"""
        update_response = requests.put(
            f"{BASE_URL}/api/attachments/nonexistent-id-12345",
            json={"filename": "test.png"},
            headers=self.headers
        )
        assert update_response.status_code == 404, f"Expected 404: {update_response.text}"
        print("PASS: Non-existent attachment returns 404")
    
    def test_edit_without_auth_fails(self):
        """Test that updating without authentication returns 401/403"""
        update_response = requests.put(
            f"{BASE_URL}/api/attachments/{self.attachment_id}",
            json={"filename": "unauthorized.png"}
        )
        # Should return 401 Unauthorized or 403 Forbidden
        assert update_response.status_code in [401, 403], f"Expected 401/403: {update_response.text}"
        print("PASS: Unauthorized update rejected")


class TestAttachmentDataIsolation:
    """Test that users cannot edit another user's attachments"""
    
    def test_cannot_edit_other_users_attachment(self):
        """Test data isolation - cannot edit another user's attachment"""
        # First user creates patient and attachment
        login1 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@clinic.com",
            "password": "admin123"
        })
        assert login1.status_code == 200
        token1 = login1.json()["token"]
        headers1 = {"Authorization": f"Bearer {token1}"}
        
        # Create patient and attachment
        patient1 = requests.post(f"{BASE_URL}/api/patients", json={
            "full_name": "TEST_User1 Patient",
            "birthdate": "1985-05-20",
            "sex": "female"
        }, headers=headers1)
        patient1_id = patient1.json()["id"]
        
        files = {
            'file': ('TEST_user1_file.png', io.BytesIO(b'user1 content'), 'image/png')
        }
        data = {
            'patient_id': patient1_id,
            'tag': 'ecg',
            'notes': 'User1 notes'
        }
        upload = requests.post(f"{BASE_URL}/api/attachments", files=files, data=data, headers=headers1)
        attachment_id = upload.json()["id"]
        
        # Register second user
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "test_isolation_user@clinic.com",
            "password": "test123",
            "full_name": "Test Isolation User",
            "role": "doctor"
        })
        
        # Login as second user
        login2 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test_isolation_user@clinic.com",
            "password": "test123"
        })
        
        if login2.status_code == 200:
            token2 = login2.json()["token"]
            headers2 = {"Authorization": f"Bearer {token2}"}
            
            # Try to edit user1's attachment as user2
            update_response = requests.put(
                f"{BASE_URL}/api/attachments/{attachment_id}",
                json={"filename": "hacked_file.png"},
                headers=headers2
            )
            # Should return 404 (attachment not found for this user)
            assert update_response.status_code == 404, f"Data isolation failed! Got: {update_response.status_code}"
            print("PASS: Data isolation working - cannot edit other user's attachment")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/attachments/{attachment_id}", headers=headers1)
        requests.delete(f"{BASE_URL}/api/patients/{patient1_id}", headers=headers1)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
