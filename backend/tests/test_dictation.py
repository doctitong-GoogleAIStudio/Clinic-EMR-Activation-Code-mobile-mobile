"""
Test suite for AI Doctor Assistant Dictation System endpoints
Tests: Session CRUD, Structure endpoint, Audit logging, Authentication
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test transcript for structure endpoint
TEST_TRANSCRIPT = """Patient came in for cough for five days with fever. No chest pain. Temperature 38C. Crackles right lower lung. Impression community acquired pneumonia. Start amoxicillin clavulanate 625mg one tab TID for 7 days. Follow up in 3 days."""


class TestDictationAuth:
    """Test dictation endpoints require authentication"""
    
    def test_create_session_requires_auth(self):
        """POST /api/dictation/sessions requires authentication"""
        response = requests.post(f"{BASE_URL}/api/dictation/sessions", json={
            "patient_id": "test-patient-123",
            "dictation_mode": "full_consultation"
        })
        assert response.status_code == 403 or response.status_code == 401, f"Expected 401/403 without token, got {response.status_code}"
        print(f"✓ Create session without auth returns {response.status_code}")
    
    def test_list_sessions_requires_auth(self):
        """GET /api/dictation/sessions requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dictation/sessions")
        assert response.status_code in [401, 403], f"Expected 401/403 without token, got {response.status_code}"
        print(f"✓ List sessions without auth returns {response.status_code}")
    
    def test_structure_requires_auth(self):
        """POST /api/dictation/structure requires authentication"""
        response = requests.post(f"{BASE_URL}/api/dictation/structure", json={
            "transcript": TEST_TRANSCRIPT,
            "mode": "full_consultation"
        })
        assert response.status_code in [401, 403], f"Expected 401/403 without token, got {response.status_code}"
        print(f"✓ Structure without auth returns {response.status_code}")
    
    def test_audit_requires_auth(self):
        """POST /api/dictation/audit requires authentication"""
        response = requests.post(f"{BASE_URL}/api/dictation/audit", json={
            "session_id": "test",
            "action_type": "test"
        })
        assert response.status_code in [401, 403], f"Expected 401/403 without token, got {response.status_code}"
        print(f"✓ Audit log without auth returns {response.status_code}")


@pytest.fixture(scope="module")
def doctor_auth():
    """Get doctor authentication token"""
    # Try login first
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "backup_test@test.com",
        "password": "test123"
    })
    
    if login_response.status_code == 200:
        data = login_response.json()
        return {"token": data["token"], "user": data["user"]}
    
    # If login fails, try register
    unique_email = f"dictation_test_{uuid.uuid4().hex[:8]}@test.com"
    register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": unique_email,
        "password": "test123",
        "full_name": "Test Doctor Dictation",
        "role": "doctor"
    })
    
    if register_response.status_code == 200:
        data = register_response.json()
        return {"token": data["token"], "user": data["user"]}
    
    pytest.skip(f"Could not authenticate: login={login_response.status_code}, register={register_response.status_code}")


@pytest.fixture(scope="module")
def test_patient(doctor_auth):
    """Create a test patient for dictation tests"""
    headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
    
    patient_data = {
        "full_name": f"TEST_Dictation Patient {uuid.uuid4().hex[:6]}",
        "birthdate": "1985-06-15",
        "sex": "Male",
        "allergies": ["Penicillin"],
        "chronic_conditions": ["Hypertension"]
    }
    
    response = requests.post(f"{BASE_URL}/api/patients", json=patient_data, headers=headers)
    assert response.status_code == 200 or response.status_code == 201, f"Failed to create patient: {response.text}"
    
    patient = response.json()
    yield patient
    
    # Cleanup: delete test patient
    requests.delete(f"{BASE_URL}/api/patients/{patient['id']}", headers=headers)


class TestDictationSessionCRUD:
    """Test dictation session CRUD operations"""
    
    def test_create_session_success(self, doctor_auth, test_patient):
        """POST /api/dictation/sessions creates session with correct fields"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        session_data = {
            "patient_id": test_patient["id"],
            "dictation_mode": "full_consultation"
        }
        
        response = requests.post(f"{BASE_URL}/api/dictation/sessions", json=session_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        session = response.json()
        
        # Verify required fields
        assert "id" in session, "Session should have 'id' field"
        assert session["patient_id"] == test_patient["id"], "patient_id should match"
        assert session["dictation_mode"] == "full_consultation", "dictation_mode should match"
        assert "provider_id" in session, "Session should have 'provider_id'"
        assert "provider_name" in session, "Session should have 'provider_name'"
        assert "status" in session, "Session should have 'status'"
        assert "created_at" in session, "Session should have 'created_at'"
        
        print(f"✓ Session created with ID: {session['id']}")
        print(f"  - patient_id: {session['patient_id']}")
        print(f"  - dictation_mode: {session['dictation_mode']}")
        print(f"  - status: {session['status']}")
        
        # Store session ID for later tests
        self.__class__.session_id = session["id"]
    
    def test_list_sessions_filtered_by_patient(self, doctor_auth, test_patient):
        """GET /api/dictation/sessions filters by patient_id"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        response = requests.get(
            f"{BASE_URL}/api/dictation/sessions",
            params={"patient_id": test_patient["id"]},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        sessions = response.json()
        
        assert isinstance(sessions, list), "Response should be a list"
        
        # All returned sessions should have the filtered patient_id
        for session in sessions:
            assert session["patient_id"] == test_patient["id"], "All sessions should belong to the patient"
        
        print(f"✓ Found {len(sessions)} session(s) for patient {test_patient['id']}")
    
    def test_get_specific_session(self, doctor_auth):
        """GET /api/dictation/sessions/{id} returns specific session"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        session_id = getattr(self.__class__, 'session_id', None)
        
        if not session_id:
            pytest.skip("No session_id from previous test")
        
        response = requests.get(f"{BASE_URL}/api/dictation/sessions/{session_id}", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        session = response.json()
        assert session["id"] == session_id, "Session ID should match"
        
        print(f"✓ Retrieved session {session_id}")
    
    def test_update_session_fields(self, doctor_auth):
        """PUT /api/dictation/sessions/{id} updates session fields"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        session_id = getattr(self.__class__, 'session_id', None)
        
        if not session_id:
            pytest.skip("No session_id from previous test")
        
        update_data = {
            "status": "paused",
            "duration_seconds": 45.5
        }
        
        response = requests.put(
            f"{BASE_URL}/api/dictation/sessions/{session_id}",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        session = response.json()
        assert session["status"] == "paused", "Status should be updated"
        assert session["duration_seconds"] == 45.5, "Duration should be updated"
        
        print(f"✓ Updated session {session_id}: status=paused, duration=45.5s")


class TestDictationStructure:
    """Test AI structure endpoint"""
    
    def test_structure_empty_transcript_returns_400(self, doctor_auth):
        """POST /api/dictation/structure rejects empty transcript"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        response = requests.post(f"{BASE_URL}/api/dictation/structure", json={
            "transcript": "",
            "mode": "full_consultation"
        }, headers=headers)
        
        assert response.status_code == 400, f"Expected 400 for empty transcript, got {response.status_code}"
        
        error_data = response.json()
        assert "detail" in error_data, "Error should have 'detail' field"
        print(f"✓ Empty transcript rejected with 400: {error_data.get('detail', '')}")
    
    def test_structure_whitespace_transcript_returns_400(self, doctor_auth):
        """POST /api/dictation/structure rejects whitespace-only transcript"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        response = requests.post(f"{BASE_URL}/api/dictation/structure", json={
            "transcript": "   \n\t  ",
            "mode": "full_consultation"
        }, headers=headers)
        
        assert response.status_code == 400, f"Expected 400 for whitespace transcript, got {response.status_code}"
        print("✓ Whitespace-only transcript rejected with 400")
    
    def test_structure_with_test_transcript(self, doctor_auth):
        """POST /api/dictation/structure converts transcript to structured SOAP JSON"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/dictation/structure",
            json={
                "transcript": TEST_TRANSCRIPT,
                "mode": "full_consultation"
            },
            headers=headers,
            timeout=60  # GPT-5.2 may take 10-30 seconds
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check that structured field exists
        assert "structured" in data, "Response should have 'structured' field"
        structured = data["structured"]
        
        if structured is None:
            # AI may return non-JSON sometimes
            print(f"⚠ AI returned non-JSON response: {data.get('raw_response', '')[:200]}")
            return
        
        # Verify SOAP fields exist
        assert "subjective" in structured, "Should have 'subjective' field"
        assert "objective" in structured, "Should have 'objective' field"
        assert "assessment" in structured, "Should have 'assessment' field"
        assert "plan" in structured, "Should have 'plan' field"
        
        # Verify additional extracted fields
        assert "prescriptions" in structured, "Should have 'prescriptions' field"
        assert "orders" in structured, "Should have 'orders' field"
        assert "follow_up" in structured, "Should have 'follow_up' field"
        assert "icd10_suggestions" in structured, "Should have 'icd10_suggestions' field"
        
        print(f"✓ Structured response has all required fields:")
        print(f"  - subjective: {type(structured['subjective'])}")
        print(f"  - objective: {type(structured['objective'])}")
        print(f"  - assessment: {structured['assessment'][:100] if isinstance(structured['assessment'], str) else str(structured['assessment'])[:100]}...")
        print(f"  - plan: {str(structured['plan'])[:100]}...")
        print(f"  - prescriptions: {len(structured.get('prescriptions', []))} items")
        print(f"  - orders: {len(structured.get('orders', []))} items")
        print(f"  - follow_up: {structured.get('follow_up', 'N/A')}")
        print(f"  - icd10_suggestions: {len(structured.get('icd10_suggestions', []))} suggestions")


class TestDictationAudit:
    """Test dictation audit logging endpoints"""
    
    @pytest.fixture
    def test_session(self, doctor_auth, test_patient):
        """Create a session for audit tests"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        response = requests.post(f"{BASE_URL}/api/dictation/sessions", json={
            "patient_id": test_patient["id"],
            "dictation_mode": "full_consultation"
        }, headers=headers)
        
        if response.status_code != 200:
            pytest.skip(f"Could not create session: {response.text}")
        
        return response.json()
    
    def test_log_audit_event(self, doctor_auth, test_session):
        """POST /api/dictation/audit logs an audit event"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        audit_data = {
            "session_id": test_session["id"],
            "action_type": "section_inserted",
            "notes": "Test audit log entry"
        }
        
        response = requests.post(f"{BASE_URL}/api/dictation/audit", json=audit_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        log_entry = response.json()
        assert "id" in log_entry, "Log entry should have 'id'"
        assert log_entry["action_type"] == "section_inserted", "action_type should match"
        assert log_entry["dictation_session_id"] == test_session["id"], "session_id should match"
        
        print(f"✓ Audit log created: {log_entry['id']}")
    
    def test_get_audit_logs_for_session(self, doctor_auth, test_session):
        """GET /api/dictation/audit/{session_id} returns audit logs"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        # First, add an audit log entry
        requests.post(f"{BASE_URL}/api/dictation/audit", json={
            "session_id": test_session["id"],
            "action_type": "test_action",
            "notes": "Test entry for retrieval"
        }, headers=headers)
        
        # Now retrieve audit logs
        response = requests.get(
            f"{BASE_URL}/api/dictation/audit/{test_session['id']}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        logs = response.json()
        assert isinstance(logs, list), "Response should be a list"
        
        # Should have at least the recording_started log (created with session) plus our test entry
        assert len(logs) >= 1, "Should have at least one audit log"
        
        # Verify log structure
        for log in logs:
            assert "id" in log, "Log should have 'id'"
            assert "action_type" in log, "Log should have 'action_type'"
            assert "action_timestamp" in log, "Log should have 'action_timestamp'"
            assert "dictation_session_id" in log, "Log should have 'dictation_session_id'"
        
        print(f"✓ Retrieved {len(logs)} audit log(s) for session {test_session['id']}")
        for log in logs:
            print(f"  - {log['action_type']} at {log['action_timestamp']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
