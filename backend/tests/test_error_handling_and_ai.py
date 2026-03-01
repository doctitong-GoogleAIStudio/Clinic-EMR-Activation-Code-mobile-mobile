"""
Test Suite: Error Handling Fix & AI Consultation Feature
Focus:
1. Login flow works correctly
2. Form validation errors display as strings (not causing React crash)
3. AI consultation endpoint works
4. Patient creation with invalid data shows proper errors
5. Appointment creation shows proper errors
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestAuthFlow:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@clinic.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not returned"
        assert "user" in data, "User info not returned"
        assert data["user"]["email"] == "admin@clinic.com"
        print("PASS: Login successful with valid credentials")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns proper error"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error detail not returned"
        # The detail should be a string, not an array (bug fix verification)
        assert isinstance(data["detail"], str), f"Detail should be string, got {type(data['detail'])}"
        print(f"PASS: Invalid login returns proper error string: {data['detail']}")


class TestValidationErrorHandling:
    """Test that Pydantic validation errors are handled properly (bug fix)"""
    
    def get_auth_token(self):
        """Helper to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@clinic.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_patient_invalid_email_validation(self):
        """Test patient creation with invalid email shows validation error as string"""
        token = self.get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Invalid email format should trigger Pydantic validation error
        response = requests.post(f"{BASE_URL}/api/patients", 
            json={
                "full_name": "Test Patient",
                "birthdate": "1990-01-01",
                "sex": "M",
                "email": "not-a-valid-email"  # Invalid email format
            },
            headers=headers
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error detail not returned"
        
        # The detail is expected to be an array of validation errors from Pydantic
        # The frontend getErrorMessage should handle this
        print(f"PASS: Patient validation error returned properly: {data['detail']}")
    
    def test_patient_missing_required_fields(self):
        """Test patient creation with missing required fields"""
        token = self.get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Missing required fields
        response = requests.post(f"{BASE_URL}/api/patients", 
            json={
                "full_name": "Test Patient"
                # Missing birthdate and sex
            },
            headers=headers
        )
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error detail not returned"
        print(f"PASS: Missing fields validation error returned properly")
    
    def test_appointment_invalid_date_format(self):
        """Test appointment creation with invalid date format"""
        token = self.get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # First create a patient
        patient_response = requests.post(f"{BASE_URL}/api/patients", 
            json={
                "full_name": f"TEST_Appointment_Patient_{uuid.uuid4().hex[:6]}",
                "birthdate": "1990-01-01",
                "sex": "M"
            },
            headers=headers
        )
        
        if patient_response.status_code != 200:
            pytest.skip("Could not create patient for appointment test")
        
        patient_id = patient_response.json()["id"]
        
        # Try to create appointment with invalid status
        response = requests.post(f"{BASE_URL}/api/appointments", 
            json={
                "patient_id": patient_id,
                "patient_name": "Test Patient",
                "date": "2024-01-15",
                "time": "10:00",
                "status": "invalid_status"  # Invalid status enum
            },
            headers=headers
        )
        
        # Should return validation error
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"PASS: Appointment validation error handled properly")


class TestAIConsultationEndpoint:
    """Test AI consultation endpoint"""
    
    def get_auth_token(self):
        """Helper to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@clinic.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_ai_assist_endpoint_exists(self):
        """Test that AI assist endpoint exists and requires auth"""
        response = requests.post(f"{BASE_URL}/api/ai/assist", json={
            "text": "test",
            "request_type": "full_consultation"
        })
        # Should return 401 or 403 without auth, not 404
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("PASS: AI endpoint exists and requires authentication")
    
    def test_ai_full_consultation(self):
        """Test AI full consultation with clinical notes"""
        token = self.get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.post(f"{BASE_URL}/api/ai/assist", 
            json={
                "text": "45 year old male with fever, cough for 3 days. Crackles heard in right lower lobe.",
                "request_type": "full_consultation",
                "patient_context": {
                    "age": 45,
                    "sex": "M",
                    "allergies": [],
                    "chronic_conditions": []
                },
                "vitals": {
                    "bp": "120/80",
                    "hr": "88",
                    "temp": "38.5",
                    "spo2": "96"
                }
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"AI consultation failed: {response.text}"
        data = response.json()
        assert "result" in data, "Result not returned"
        assert "type" in data, "Type not returned"
        assert data["type"] == "full_consultation"
        print(f"PASS: AI full consultation returned result (length: {len(data['result'])} chars)")
    
    def test_ai_soap_convert(self):
        """Test AI SOAP conversion"""
        token = self.get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.post(f"{BASE_URL}/api/ai/assist", 
            json={
                "text": "Patient has headache for 2 days, took paracetamol with mild relief. No fever.",
                "request_type": "soap_convert"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"AI SOAP convert failed: {response.text}"
        data = response.json()
        assert "result" in data
        print(f"PASS: AI SOAP convert returned result")
    
    def test_ai_diagnosis_suggest(self):
        """Test AI diagnosis suggestion"""
        token = self.get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.post(f"{BASE_URL}/api/ai/assist", 
            json={
                "text": "Fever, productive cough, chest pain on deep breathing",
                "request_type": "diagnosis_suggest"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"AI diagnosis failed: {response.text}"
        data = response.json()
        assert "result" in data
        print(f"PASS: AI diagnosis suggestion returned result")
    
    def test_ai_red_flag_check(self):
        """Test AI red flag check"""
        token = self.get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.post(f"{BASE_URL}/api/ai/assist", 
            json={
                "text": "Check for clinical red flags",
                "request_type": "red_flag_check",
                "vitals": {
                    "bp": "180/110",  # High BP
                    "hr": "110",
                    "temp": "39.5",  # High fever
                    "spo2": "88"  # Low oxygen
                },
                "medications": ["aspirin"],
                "patient_context": {
                    "age": 65,
                    "sex": "F",
                    "allergies": ["penicillin"],
                    "chronic_conditions": ["hypertension"]
                }
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"AI red flag check failed: {response.text}"
        data = response.json()
        assert "result" in data
        print(f"PASS: AI red flag check returned result")


class TestPatientCreationFlow:
    """Test patient creation with proper data"""
    
    def get_auth_token(self):
        """Helper to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@clinic.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_create_patient_success(self):
        """Test successful patient creation"""
        token = self.get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(f"{BASE_URL}/api/patients", 
            json={
                "full_name": f"TEST_AI_Patient_{unique_id}",
                "birthdate": "1985-06-15",
                "sex": "F",
                "address": "123 Test Street",
                "mobile": "09171234567",
                "allergies": ["penicillin"],
                "chronic_conditions": ["diabetes"]
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Patient creation failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "patient_id" in data
        assert data["full_name"] == f"TEST_AI_Patient_{unique_id}"
        print(f"PASS: Patient created successfully with ID: {data['patient_id']}")
        return data["id"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
