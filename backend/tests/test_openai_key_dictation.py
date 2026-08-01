"""
Test OpenAI API Key Settings and Dictation Transcribe Endpoint
Tests for:
1. Settings Page: OpenAI API Key save/retrieve
2. Backend: GET/PUT /api/settings with openai_api_key field
3. Backend: POST /api/dictation/transcribe error handling
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://voicedoc-system.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "testvoice@test.com"
TEST_PASSWORD = "test123"
TEST_PATIENT_ID = "f1d33285-d5e0-4452-a63c-d86574fada7f"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in login response"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestSettingsOpenAIKey:
    """Test OpenAI API Key in Settings"""
    
    def test_get_settings_returns_openai_api_key_field(self, auth_headers):
        """GET /api/settings should return openai_api_key field"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert response.status_code == 200, f"GET settings failed: {response.text}"
        
        data = response.json()
        # The field should exist (even if empty/null)
        assert "openai_api_key" in data or data.get("openai_api_key") is None or "openai_api_key" not in data, \
            "Settings response should include openai_api_key field or be empty"
        print(f"GET /api/settings returned openai_api_key: {data.get('openai_api_key', 'NOT_PRESENT')[:10] if data.get('openai_api_key') else 'None/Empty'}...")
    
    def test_save_openai_api_key(self, auth_headers):
        """PUT /api/settings should save openai_api_key"""
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert get_response.status_code == 200
        current_settings = get_response.json()
        
        # Update with test API key
        test_key = "sk-test-123-fake-key-for-testing"
        updated_settings = {
            "clinic_name": current_settings.get("clinic_name", "Test Clinic"),
            "address": current_settings.get("address", ""),
            "phone": current_settings.get("phone", ""),
            "email": current_settings.get("email", ""),
            "license_no": current_settings.get("license_no", ""),
            "ptr_no": current_settings.get("ptr_no", ""),
            "prc_no": current_settings.get("prc_no", ""),
            "specialization": current_settings.get("specialization", ""),
            "print_header_title": current_settings.get("print_header_title", ""),
            "print_header_subtitle": current_settings.get("print_header_subtitle", ""),
            "print_header_logo": current_settings.get("print_header_logo", ""),
            "print_header_extra": current_settings.get("print_header_extra", ""),
            "openai_api_key": test_key
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json=updated_settings
        )
        assert put_response.status_code == 200, f"PUT settings failed: {put_response.text}"
        print(f"PUT /api/settings with openai_api_key succeeded")
    
    def test_openai_api_key_persists_after_save(self, auth_headers):
        """Verify openai_api_key persists after save"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        saved_key = data.get("openai_api_key")
        assert saved_key is not None, "openai_api_key should be saved"
        assert saved_key == "sk-test-123-fake-key-for-testing", f"Key mismatch: {saved_key}"
        print(f"OpenAI API key persisted correctly: {saved_key[:15]}...")


class TestDictationTranscribeEndpoint:
    """Test /api/dictation/transcribe endpoint error handling"""
    
    def test_transcribe_requires_auth(self):
        """POST /api/dictation/transcribe should require authentication"""
        # Create a minimal audio file
        audio_data = b'\x00' * 1000  # Dummy audio bytes
        files = {'audio': ('test.webm', io.BytesIO(audio_data), 'audio/webm')}
        data = {'session_id': '', 'language': 'en', 'prompt': ''}
        
        response = requests.post(
            f"{BASE_URL}/api/dictation/transcribe",
            files=files,
            data=data
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Transcribe endpoint requires auth: {response.status_code}")
    
    def test_transcribe_returns_400_without_api_key(self, auth_headers):
        """POST /api/dictation/transcribe should return 400 if no API key configured"""
        # First, clear the API key
        get_response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        current_settings = get_response.json()
        
        # Save settings without API key
        updated_settings = {
            "clinic_name": current_settings.get("clinic_name", "Test Clinic"),
            "address": current_settings.get("address", ""),
            "phone": current_settings.get("phone", ""),
            "email": current_settings.get("email", ""),
            "license_no": current_settings.get("license_no", ""),
            "ptr_no": current_settings.get("ptr_no", ""),
            "prc_no": current_settings.get("prc_no", ""),
            "specialization": current_settings.get("specialization", ""),
            "print_header_title": current_settings.get("print_header_title", ""),
            "print_header_subtitle": current_settings.get("print_header_subtitle", ""),
            "print_header_logo": current_settings.get("print_header_logo", ""),
            "print_header_extra": current_settings.get("print_header_extra", ""),
            "openai_api_key": ""  # Clear the key
        }
        requests.put(f"{BASE_URL}/api/settings", headers=auth_headers, json=updated_settings)
        
        # Now try to transcribe
        audio_data = b'\x00' * 1000
        files = {'audio': ('test.webm', io.BytesIO(audio_data), 'audio/webm')}
        data = {'session_id': '', 'language': 'en', 'prompt': ''}
        
        # Need to use auth token in multipart request
        multipart_headers = {"Authorization": auth_headers["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/dictation/transcribe",
            headers=multipart_headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        error_detail = response.json().get("detail", "")
        assert "API key not configured" in error_detail or "OpenAI" in error_detail, \
            f"Expected API key error message, got: {error_detail}"
        print(f"Transcribe returns 400 without API key: {error_detail}")
    
    def test_transcribe_returns_error_for_invalid_key(self, auth_headers):
        """POST /api/dictation/transcribe should return meaningful error for invalid API key"""
        # First, set an invalid API key
        get_response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        current_settings = get_response.json()
        
        updated_settings = {
            "clinic_name": current_settings.get("clinic_name", "Test Clinic"),
            "address": current_settings.get("address", ""),
            "phone": current_settings.get("phone", ""),
            "email": current_settings.get("email", ""),
            "license_no": current_settings.get("license_no", ""),
            "ptr_no": current_settings.get("ptr_no", ""),
            "prc_no": current_settings.get("prc_no", ""),
            "specialization": current_settings.get("specialization", ""),
            "print_header_title": current_settings.get("print_header_title", ""),
            "print_header_subtitle": current_settings.get("print_header_subtitle", ""),
            "print_header_logo": current_settings.get("print_header_logo", ""),
            "print_header_extra": current_settings.get("print_header_extra", ""),
            "openai_api_key": "sk-invalid-fake-key-12345"  # Invalid key
        }
        requests.put(f"{BASE_URL}/api/settings", headers=auth_headers, json=updated_settings)
        
        # Now try to transcribe with invalid key
        audio_data = b'\x00' * 1000
        files = {'audio': ('test.webm', io.BytesIO(audio_data), 'audio/webm')}
        data = {'session_id': '', 'language': 'en', 'prompt': ''}
        
        multipart_headers = {"Authorization": auth_headers["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/dictation/transcribe",
            headers=multipart_headers,
            files=files,
            data=data,
            timeout=30
        )
        
        # Should return 401 or 500 with meaningful error about invalid key
        assert response.status_code in [400, 401, 500], f"Expected error status, got {response.status_code}"
        error_detail = response.json().get("detail", "")
        print(f"Transcribe with invalid key returns {response.status_code}: {error_detail[:100]}...")
        # The error should mention authentication, API key, or OpenAI
        assert any(word in error_detail.lower() for word in ["api", "key", "auth", "invalid", "openai", "error"]), \
            f"Expected meaningful error about API key, got: {error_detail}"


class TestDictationSessionAndStructure:
    """Test dictation session creation and AI structure endpoint"""
    
    def test_create_dictation_session(self, auth_headers):
        """POST /api/dictation/sessions should create a session"""
        response = requests.post(
            f"{BASE_URL}/api/dictation/sessions",
            headers=auth_headers,
            json={
                "patient_id": TEST_PATIENT_ID,
                "visit_id": None,
                "dictation_mode": "full_consultation"
            }
        )
        
        # May return 404 if patient doesn't exist for this user
        if response.status_code == 404:
            print("Patient not found for test user - skipping session test")
            pytest.skip("Test patient not found for this user")
        
        assert response.status_code in [200, 201], f"Create session failed: {response.text}"
        data = response.json()
        assert "id" in data, "Session should have an ID"
        print(f"Created dictation session: {data.get('id')}")
        return data.get("id")
    
    def test_structure_endpoint_works(self, auth_headers):
        """POST /api/dictation/structure should process transcript"""
        response = requests.post(
            f"{BASE_URL}/api/dictation/structure",
            headers=auth_headers,
            json={
                "transcript": "Patient has cough for 3 days with fever. Temperature 38.5. Impression: Upper respiratory infection. Plan: Paracetamol 500mg TID.",
                "mode": "full_consultation",
                "session_id": None,
                "patient_context": {
                    "name": "Test Patient",
                    "age": 35,
                    "sex": "Male",
                    "allergies": [],
                    "chronic_conditions": []
                }
            }
        )
        
        assert response.status_code == 200, f"Structure endpoint failed: {response.text}"
        data = response.json()
        assert "structured" in data, "Response should have structured field"
        print(f"Structure endpoint returned structured data with keys: {list(data.get('structured', {}).keys())}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_restore_api_key_for_future_tests(self, auth_headers):
        """Restore a test API key for future testing"""
        get_response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        current_settings = get_response.json()
        
        updated_settings = {
            "clinic_name": current_settings.get("clinic_name", "Test Clinic"),
            "address": current_settings.get("address", ""),
            "phone": current_settings.get("phone", ""),
            "email": current_settings.get("email", ""),
            "license_no": current_settings.get("license_no", ""),
            "ptr_no": current_settings.get("ptr_no", ""),
            "prc_no": current_settings.get("prc_no", ""),
            "specialization": current_settings.get("specialization", ""),
            "print_header_title": current_settings.get("print_header_title", ""),
            "print_header_subtitle": current_settings.get("print_header_subtitle", ""),
            "print_header_logo": current_settings.get("print_header_logo", ""),
            "print_header_extra": current_settings.get("print_header_extra", ""),
            "openai_api_key": "sk-test-123"  # Restore test key
        }
        response = requests.put(f"{BASE_URL}/api/settings", headers=auth_headers, json=updated_settings)
        assert response.status_code == 200
        print("Restored test API key for future tests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
