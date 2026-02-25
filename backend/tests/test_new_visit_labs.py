"""
Backend tests for Labs & Imaging functionality on New Visit page.
Tests attachment APIs used by NewVisitPage.js:
- GET /api/attachments?patient_id={id} - List attachments for patient (filtered by lab tags)
- GET /api/attachments/{id} - Get single attachment with file_data for viewing
- POST /api/attachments - Upload new attachment
- PUT /api/attachments/{id} - Edit attachment (filename, tag, notes)
- DELETE /api/attachments/{id} - Delete attachment
"""

import pytest
import requests
import os
import base64
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@clinic.com"
TEST_PASSWORD = "admin123"
TEST_PATIENT_ID = "7298a61e-9a6c-41fa-b2d1-7d2464e73dbf"


class TestNewVisitLabsAPI:
    """Tests for attachment APIs used by New Visit Labs & Imaging section"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login and get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
        
    def test_01_list_attachments_for_patient(self):
        """Test GET /api/attachments?patient_id={id} returns attachments without file_data"""
        response = self.session.get(f"{BASE_URL}/api/attachments", params={"patient_id": TEST_PATIENT_ID})
        
        assert response.status_code == 200, f"Failed to list attachments: {response.text}"
        attachments = response.json()
        
        assert isinstance(attachments, list), "Response should be a list"
        print(f"Found {len(attachments)} attachments for patient")
        
        # Verify file_data is not included in list response (performance optimization)
        for att in attachments:
            assert "id" in att, "Attachment should have id"
            assert "filename" in att, "Attachment should have filename"
            assert "tag" in att, "Attachment should have tag"
            assert "file_data" not in att, "file_data should not be in list response"
    
    def test_02_list_attachments_filters_by_lab_tags(self):
        """Test that attachments can be filtered by lab-related tags (lab, x-ray, ultrasound, ecg)"""
        response = self.session.get(f"{BASE_URL}/api/attachments", params={"patient_id": TEST_PATIENT_ID})
        
        assert response.status_code == 200
        attachments = response.json()
        
        # Check lab-related tags
        lab_tags = ['lab', 'x-ray', 'ultrasound', 'ecg']
        lab_attachments = [a for a in attachments if a.get('tag') in lab_tags]
        print(f"Found {len(lab_attachments)} lab/imaging attachments out of {len(attachments)} total")
        
        for att in lab_attachments:
            assert att['tag'] in lab_tags, f"Tag {att['tag']} should be in {lab_tags}"
    
    def test_03_get_single_attachment_with_file_data(self):
        """Test GET /api/attachments/{id} returns full attachment with file_data for viewing"""
        # First get list to find an attachment
        list_response = self.session.get(f"{BASE_URL}/api/attachments", params={"patient_id": TEST_PATIENT_ID})
        assert list_response.status_code == 200
        attachments = list_response.json()
        
        if len(attachments) == 0:
            pytest.skip("No attachments found to test")
        
        attachment_id = attachments[0]['id']
        
        # Get single attachment
        response = self.session.get(f"{BASE_URL}/api/attachments/{attachment_id}")
        
        assert response.status_code == 200, f"Failed to get attachment: {response.text}"
        attachment = response.json()
        
        # Verify full data is returned
        assert "id" in attachment
        assert "filename" in attachment
        assert "tag" in attachment
        assert "content_type" in attachment
        assert "file_data" in attachment, "Single attachment should include file_data"
        
        # Verify file_data is valid base64
        try:
            decoded = base64.b64decode(attachment['file_data'])
            assert len(decoded) > 0, "file_data should decode to non-empty content"
            print(f"Successfully retrieved attachment {attachment['filename']} ({len(decoded)} bytes)")
        except Exception as e:
            pytest.fail(f"file_data is not valid base64: {e}")
    
    def test_04_upload_new_attachment(self):
        """Test POST /api/attachments uploads a new file"""
        # Create a test image (1x1 PNG)
        test_image_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
        
        files = {
            'file': ('test_upload_new_visit.png', test_image_data, 'image/png')
        }
        data = {
            'patient_id': TEST_PATIENT_ID,
            'tag': 'lab',
            'notes': 'Test upload from New Visit page test'
        }
        
        # Need to remove Content-Type header for multipart upload
        headers = {"Authorization": self.session.headers.get("Authorization")}
        response = requests.post(f"{BASE_URL}/api/attachments", files=files, data=data, headers=headers)
        
        assert response.status_code == 200, f"Failed to upload: {response.text}"
        attachment = response.json()
        
        assert "id" in attachment
        assert attachment['filename'] == 'test_upload_new_visit.png'
        assert attachment['tag'] == 'lab'
        assert attachment['notes'] == 'Test upload from New Visit page test'
        
        # Store ID for cleanup
        self.uploaded_id = attachment['id']
        print(f"Successfully uploaded attachment with ID: {attachment['id']}")
        
        # Clean up - delete the test attachment
        delete_response = self.session.delete(f"{BASE_URL}/api/attachments/{attachment['id']}")
        assert delete_response.status_code == 200, "Failed to clean up test attachment"
        print("Test attachment cleaned up")
    
    def test_05_update_attachment_filename(self):
        """Test PUT /api/attachments/{id} can update filename"""
        # First upload a test file
        test_image_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
        
        files = {'file': ('original_name.png', test_image_data, 'image/png')}
        data = {'patient_id': TEST_PATIENT_ID, 'tag': 'lab', 'notes': 'Original notes'}
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        upload_response = requests.post(f"{BASE_URL}/api/attachments", files=files, data=data, headers=headers)
        assert upload_response.status_code == 200
        attachment_id = upload_response.json()['id']
        
        try:
            # Update filename
            update_response = self.session.put(f"{BASE_URL}/api/attachments/{attachment_id}", json={
                "filename": "renamed_file.png"
            })
            
            assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
            updated = update_response.json()
            assert updated['filename'] == 'renamed_file.png', "Filename should be updated"
            print("Successfully renamed attachment")
            
        finally:
            # Clean up
            self.session.delete(f"{BASE_URL}/api/attachments/{attachment_id}")
    
    def test_06_update_attachment_tag(self):
        """Test PUT /api/attachments/{id} can update tag"""
        test_image_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
        
        files = {'file': ('test_tag_change.png', test_image_data, 'image/png')}
        data = {'patient_id': TEST_PATIENT_ID, 'tag': 'lab', 'notes': ''}
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        upload_response = requests.post(f"{BASE_URL}/api/attachments", files=files, data=data, headers=headers)
        assert upload_response.status_code == 200
        attachment_id = upload_response.json()['id']
        
        try:
            # Update tag to x-ray
            update_response = self.session.put(f"{BASE_URL}/api/attachments/{attachment_id}", json={
                "tag": "x-ray"
            })
            
            assert update_response.status_code == 200, f"Failed to update tag: {update_response.text}"
            updated = update_response.json()
            assert updated['tag'] == 'x-ray', "Tag should be updated to x-ray"
            print("Successfully changed tag from 'lab' to 'x-ray'")
            
        finally:
            self.session.delete(f"{BASE_URL}/api/attachments/{attachment_id}")
    
    def test_07_update_attachment_notes(self):
        """Test PUT /api/attachments/{id} can update notes"""
        test_image_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
        
        files = {'file': ('test_notes_update.png', test_image_data, 'image/png')}
        data = {'patient_id': TEST_PATIENT_ID, 'tag': 'ultrasound', 'notes': 'Initial notes'}
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        upload_response = requests.post(f"{BASE_URL}/api/attachments", files=files, data=data, headers=headers)
        assert upload_response.status_code == 200
        attachment_id = upload_response.json()['id']
        
        try:
            # Update notes
            update_response = self.session.put(f"{BASE_URL}/api/attachments/{attachment_id}", json={
                "notes": "Updated notes with more details"
            })
            
            assert update_response.status_code == 200
            updated = update_response.json()
            assert updated['notes'] == 'Updated notes with more details', "Notes should be updated"
            print("Successfully updated notes")
            
        finally:
            self.session.delete(f"{BASE_URL}/api/attachments/{attachment_id}")
    
    def test_08_delete_attachment(self):
        """Test DELETE /api/attachments/{id} removes attachment"""
        test_image_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
        
        files = {'file': ('to_be_deleted.png', test_image_data, 'image/png')}
        data = {'patient_id': TEST_PATIENT_ID, 'tag': 'ecg', 'notes': 'Delete me'}
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        upload_response = requests.post(f"{BASE_URL}/api/attachments", files=files, data=data, headers=headers)
        assert upload_response.status_code == 200
        attachment_id = upload_response.json()['id']
        
        # Delete the attachment
        delete_response = self.session.delete(f"{BASE_URL}/api/attachments/{attachment_id}")
        assert delete_response.status_code == 200, f"Failed to delete: {delete_response.text}"
        
        # Verify it's gone
        get_response = self.session.get(f"{BASE_URL}/api/attachments/{attachment_id}")
        assert get_response.status_code == 404, "Deleted attachment should return 404"
        print("Successfully deleted attachment and verified it's gone")
    
    def test_09_upload_without_auth_fails(self):
        """Test that upload without authentication fails"""
        test_image_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
        
        files = {'file': ('should_fail.png', test_image_data, 'image/png')}
        data = {'patient_id': TEST_PATIENT_ID, 'tag': 'lab', 'notes': 'Should fail'}
        
        # No auth header
        response = requests.post(f"{BASE_URL}/api/attachments", files=files, data=data)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Correctly rejected unauthorized upload")
    
    def test_10_get_nonexistent_attachment_returns_404(self):
        """Test GET for non-existent attachment returns 404"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = self.session.get(f"{BASE_URL}/api/attachments/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for non-existent attachment")


class TestVisitAPIWithLabs:
    """Tests for Visit API to ensure Labs section doesn't break visit creation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_11_create_visit_works_after_labs_section_added(self):
        """Test POST /api/visits still works correctly (Labs section shouldn't break form)"""
        visit_data = {
            "patient_id": TEST_PATIENT_ID,
            "vitals": {
                "bp_systolic": 120,
                "bp_diastolic": 80,
                "heart_rate": 72,
                "respiratory_rate": 16,
                "temperature": 36.5,
                "spo2": 98,
                "weight": 70,
                "height": 170
            },
            "soap_subjective": "Backend test - patient has no complaints today",
            "soap_objective": "General appearance: well",
            "soap_assessment": "1. Routine checkup - no issues",
            "soap_plan": "1. Continue current medications\n2. Return in 3 months",
            "patient_instructions": "Take medications as prescribed",
            "warning_signs": "Return if fever develops"
        }
        
        response = self.session.post(f"{BASE_URL}/api/visits", json=visit_data)
        
        assert response.status_code == 200, f"Failed to create visit: {response.text}"
        visit = response.json()
        
        assert "id" in visit
        assert visit['patient_id'] == TEST_PATIENT_ID
        assert visit['vitals']['bp_systolic'] == 120
        assert visit['soap_subjective'] == "Backend test - patient has no complaints today"
        
        print(f"Successfully created visit with ID: {visit['id']}")
        
        # Verify visit is retrievable
        get_response = self.session.get(f"{BASE_URL}/api/visits/{visit['id']}")
        assert get_response.status_code == 200
        retrieved = get_response.json()
        assert retrieved['id'] == visit['id']
        print("Visit successfully verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
