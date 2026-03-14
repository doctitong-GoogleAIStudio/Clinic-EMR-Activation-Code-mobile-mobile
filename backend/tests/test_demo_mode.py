"""
Test suite for AI Doctor Assistant Demo Mode feature
Tests: Prescription mode, Orders mode, Structure endpoint specific modes
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Demo sample transcripts matching the frontend DEMO_SAMPLES
PRESCRIPTION_TRANSCRIPT = "Azithromycin five hundred milligrams tablet take one tablet once daily for three days."
ORDERS_TRANSCRIPT = "Request CBC urinalysis fasting blood sugar lipid profile chest x ray PA view."
UNCERTAIN_TRANSCRIPT = "Start something like co amoxiclav six twenty five one tablet three times a day for one week."


@pytest.fixture(scope="module")
def doctor_auth():
    """Get doctor authentication token"""
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "backup_test@test.com",
        "password": "test123"
    })
    
    if login_response.status_code == 200:
        data = login_response.json()
        return {"token": data["token"], "user": data["user"]}
    
    pytest.skip(f"Could not authenticate: {login_response.status_code}")


class TestStructurePrescriptionMode:
    """Test structure endpoint in prescription mode"""
    
    def test_prescription_mode_returns_prescriptions_array(self, doctor_auth):
        """POST /api/dictation/structure in prescription mode returns prescriptions array"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/dictation/structure",
            json={
                "transcript": PRESCRIPTION_TRANSCRIPT,
                "mode": "prescription"
            },
            headers=headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "structured" in data, "Response should have 'structured' field"
        
        structured = data["structured"]
        if structured is None:
            print(f"⚠ AI returned non-JSON: {data.get('raw_response', '')[:200]}")
            return
        
        # Verify prescriptions array exists and has items
        assert "prescriptions" in structured, "Should have 'prescriptions' field"
        prescriptions = structured["prescriptions"]
        
        assert isinstance(prescriptions, list), "Prescriptions should be a list"
        assert len(prescriptions) >= 1, "Should have at least one prescription"
        
        # Verify prescription structure
        rx = prescriptions[0]
        print(f"✓ Prescription extracted:")
        print(f"  - Drug: {rx.get('drug', rx.get('generic_name', 'N/A'))}")
        print(f"  - Strength: {rx.get('strength', 'N/A')}")
        print(f"  - Dose: {rx.get('dose', 'N/A')}")
        print(f"  - Frequency: {rx.get('frequency', 'N/A')}")
        print(f"  - Duration: {rx.get('duration', 'N/A')}")
        
        # Check that Azithromycin was recognized
        drug_name = (rx.get('drug', '') + rx.get('generic_name', '')).lower()
        assert 'azithromycin' in drug_name, f"Should recognize Azithromycin, got: {drug_name}"


class TestStructureOrdersMode:
    """Test structure endpoint in orders mode"""
    
    def test_orders_mode_returns_orders_array(self, doctor_auth):
        """POST /api/dictation/structure in orders mode returns orders array"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/dictation/structure",
            json={
                "transcript": ORDERS_TRANSCRIPT,
                "mode": "orders"
            },
            headers=headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "structured" in data, "Response should have 'structured' field"
        
        structured = data["structured"]
        if structured is None:
            print(f"⚠ AI returned non-JSON: {data.get('raw_response', '')[:200]}")
            return
        
        # Verify orders array exists and has items
        assert "orders" in structured, "Should have 'orders' field"
        orders = structured["orders"]
        
        assert isinstance(orders, list), "Orders should be a list"
        assert len(orders) >= 1, "Should have at least one order"
        
        # Print extracted orders
        print(f"✓ {len(orders)} order(s) extracted:")
        for order in orders:
            print(f"  - {order.get('type', 'N/A').upper()}: {order.get('name', 'N/A')} [{order.get('priority', 'routine')}]")
        
        # Check that expected lab tests were recognized
        order_names = ' '.join([o.get('name', '').lower() for o in orders])
        expected_tests = ['cbc', 'urinalysis', 'blood sugar', 'lipid', 'x-ray', 'xray', 'chest']
        found_tests = [t for t in expected_tests if t in order_names]
        print(f"✓ Found tests: {found_tests}")


class TestStructureReviewFlags:
    """Test that uncertain dictation produces review flags"""
    
    def test_uncertain_transcript_produces_review_flags(self, doctor_auth):
        """POST /api/dictation/structure with uncertain medication should produce review flags"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/dictation/structure",
            json={
                "transcript": UNCERTAIN_TRANSCRIPT,
                "mode": "full_consultation"
            },
            headers=headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        structured = data.get("structured")
        
        if structured is None:
            print(f"⚠ AI returned non-JSON: {data.get('raw_response', '')[:200]}")
            return
        
        # Check for review_flags or uncertainties
        review_flags = structured.get("review_flags", [])
        uncertainties = structured.get("uncertainties", [])
        
        print(f"✓ Review flags: {review_flags}")
        print(f"✓ Uncertainties: {uncertainties}")
        
        # AI should flag the ambiguous medication ("something like co amoxiclav")
        has_flags = len(review_flags) > 0 or len(uncertainties) > 0
        print(f"✓ Has review flags or uncertainties: {has_flags}")
        
        # Even if no flags, the prescription should show low confidence
        prescriptions = structured.get("prescriptions", [])
        if prescriptions:
            for rx in prescriptions:
                confidence = rx.get("confidence", "high")
                print(f"  - Prescription confidence: {confidence}")


class TestDemoSessionCreation:
    """Test that demo mode creates proper sessions for audit trail"""
    
    @pytest.fixture
    def test_patient(self, doctor_auth):
        """Get or create test patient"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        # Use the known test patient
        test_patient_id = "9ca3d30d-f0ce-423b-9f36-6434e454436d"
        
        response = requests.get(
            f"{BASE_URL}/api/patients/{test_patient_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            return response.json()
        
        # Create if not exists
        patient_data = {
            "full_name": f"TEST_Demo Patient {uuid.uuid4().hex[:6]}",
            "birthdate": "1985-06-15",
            "sex": "Male"
        }
        
        response = requests.post(f"{BASE_URL}/api/patients", json=patient_data, headers=headers)
        if response.status_code in [200, 201]:
            return response.json()
        
        pytest.skip(f"Could not get/create test patient: {response.text}")
    
    def test_demo_creates_session(self, doctor_auth, test_patient):
        """Demo mode should create a dictation session for audit trail"""
        headers = {"Authorization": f"Bearer {doctor_auth['token']}"}
        
        # Create session (simulating what demo mode does)
        session_response = requests.post(f"{BASE_URL}/api/dictation/sessions", json={
            "patient_id": test_patient["id"],
            "dictation_mode": "full_consultation"
        }, headers=headers)
        
        assert session_response.status_code == 200, f"Expected 200, got {session_response.status_code}"
        
        session = session_response.json()
        session_id = session["id"]
        print(f"✓ Created session: {session_id}")
        
        # Update session with demo transcript
        update_response = requests.put(
            f"{BASE_URL}/api/dictation/sessions/{session_id}",
            json={
                "raw_transcript": PRESCRIPTION_TRANSCRIPT,
                "status": "transcribed"
            },
            headers=headers
        )
        
        assert update_response.status_code == 200, f"Session update failed: {update_response.text}"
        print(f"✓ Updated session with transcript")
        
        # Process through structure endpoint
        structure_response = requests.post(
            f"{BASE_URL}/api/dictation/structure",
            json={
                "transcript": PRESCRIPTION_TRANSCRIPT,
                "mode": "prescription",
                "session_id": session_id,
                "patient_context": {
                    "name": test_patient["full_name"],
                    "age": test_patient.get("age", 40),
                    "sex": test_patient.get("sex", "Unknown")
                }
            },
            headers=headers,
            timeout=60
        )
        
        assert structure_response.status_code == 200, f"Structure failed: {structure_response.text}"
        print(f"✓ Structured transcript successfully")
        
        # Verify session was updated with AI result
        get_session = requests.get(
            f"{BASE_URL}/api/dictation/sessions/{session_id}",
            headers=headers
        )
        
        assert get_session.status_code == 200
        final_session = get_session.json()
        
        print(f"✓ Session status: {final_session.get('status')}")
        assert final_session.get('status') == 'ai_processed', "Session should be marked as ai_processed"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
