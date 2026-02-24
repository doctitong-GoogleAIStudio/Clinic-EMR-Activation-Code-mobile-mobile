import requests
import sys
import json
from datetime import datetime, date, timedelta

class ClinicEMRAPITester:
    def __init__(self, base_url="https://visit-notes-1.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_patient_id = None
        self.created_visit_id = None
        self.created_appointment_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.text else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "/api/",
            200
        )
        return success

    def test_login(self):
        """Test login with default admin credentials"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/api/auth/login",
            200,
            data={"email": "admin@clinic.com", "password": "admin123"}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response.get('user', {}).get('id')
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_get_me(self):
        """Test get current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "/api/auth/me",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "/api/dashboard/stats",
            200
        )
        if success and 'total_patients' in response:
            print(f"   Stats: {response['total_patients']} patients, {response['today_appointments']} appointments")
        return success

    def test_create_patient(self):
        """Test patient creation"""
        patient_data = {
            "full_name": "Test Patient EMR",
            "birthdate": "1990-01-15",
            "sex": "male",
            "mobile": "09123456789",
            "email": "test.patient@example.com",
            "address": "123 Test Street, Test City",
            "allergies": ["Penicillin"],
            "chronic_conditions": ["Hypertension"]
        }
        
        success, response = self.run_test(
            "Create Patient",
            "POST",
            "/api/patients",
            200,
            data=patient_data
        )
        
        if success and 'id' in response:
            self.created_patient_id = response['id']
            print(f"   Created patient ID: {self.created_patient_id}")
            print(f"   Patient ID: {response.get('patient_id', 'N/A')}")
            return True
        return False

    def test_get_patients(self):
        """Test get all patients"""
        success, response = self.run_test(
            "Get All Patients",
            "GET",
            "/api/patients",
            200
        )
        if success:
            print(f"   Found {len(response)} patients")
        return success

    def test_search_patients(self):
        """Test patient search"""
        success, response = self.run_test(
            "Search Patients",
            "GET",
            "/api/patients?search=Test",
            200
        )
        if success:
            print(f"   Search returned {len(response)} results")
        return success

    def test_get_patient_by_id(self):
        """Test get specific patient"""
        if not self.created_patient_id:
            print("❌ No patient ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Patient by ID",
            "GET",
            f"/api/patients/{self.created_patient_id}",
            200
        )
        return success

    def test_update_patient(self):
        """Test update patient"""
        if not self.created_patient_id:
            print("❌ No patient ID available for testing")
            return False
            
        update_data = {
            "mobile": "09987654321",
            "address": "Updated Address"
        }
        
        success, response = self.run_test(
            "Update Patient",
            "PUT",
            f"/api/patients/{self.created_patient_id}",
            200,
            data=update_data
        )
        return success

    def test_create_appointment(self):
        """Test appointment creation"""
        if not self.created_patient_id:
            print("❌ No patient ID available for testing")
            return False
            
        today = date.today().isoformat()
        appointment_data = {
            "patient_id": self.created_patient_id,
            "patient_name": "Test Patient EMR",
            "date": today,
            "time": "14:30",
            "reason": "Test Consultation",
            "status": "waiting"
        }
        
        success, response = self.run_test(
            "Create Appointment",
            "POST",
            "/api/appointments",
            201,
            data=appointment_data
        )
        
        if success and 'id' in response:
            self.created_appointment_id = response['id']
            print(f"   Created appointment ID: {self.created_appointment_id}")
            return True
        return False

    def test_get_appointments(self):
        """Test get appointments"""
        success, response = self.run_test(
            "Get All Appointments",
            "GET",
            "/api/appointments",
            200
        )
        if success:
            print(f"   Found {len(response)} appointments")
        return success

    def test_get_today_appointments(self):
        """Test get today's appointments"""
        success, response = self.run_test(
            "Get Today Appointments",
            "GET",
            "/api/appointments/today",
            200
        )
        if success:
            print(f"   Today's appointments: {len(response)}")
        return success

    def test_get_queue(self):
        """Test get queue"""
        success, response = self.run_test(
            "Get Queue",
            "GET",
            "/api/queue/today",
            200
        )
        if success:
            print(f"   Queue length: {len(response)}")
        return success

    def test_update_appointment_status(self):
        """Test update appointment status"""
        if not self.created_appointment_id:
            print("❌ No appointment ID available for testing")
            return False
            
        success, response = self.run_test(
            "Update Appointment Status",
            "PUT",
            f"/api/appointments/{self.created_appointment_id}",
            200,
            data={"status": "in_consultation"}
        )
        return success

    def test_create_visit(self):
        """Test visit creation"""
        if not self.created_patient_id:
            print("❌ No patient ID available for testing")
            return False
            
        visit_data = {
            "patient_id": self.created_patient_id,
            "vitals": {
                "bp_systolic": 120,
                "bp_diastolic": 80,
                "heart_rate": 72,
                "temperature": 36.5,
                "weight": 70,
                "height": 170
            },
            "soap_subjective": "Patient complains of mild headache for 2 days",
            "soap_objective": "Alert, oriented. Vital signs stable. No acute distress.",
            "soap_assessment": "Tension headache",
            "soap_plan": "Paracetamol 500mg every 6 hours PRN. Rest and hydration.",
            "patient_instructions": "Take medication as prescribed. Rest well.",
            "warning_signs": "Return if headache worsens or fever develops."
        }
        
        success, response = self.run_test(
            "Create Visit",
            "POST",
            "/api/visits",
            201,
            data=visit_data
        )
        
        if success and 'id' in response:
            self.created_visit_id = response['id']
            print(f"   Created visit ID: {self.created_visit_id}")
            return True
        return False

    def test_get_visits(self):
        """Test get visits"""
        success, response = self.run_test(
            "Get All Visits",
            "GET",
            "/api/visits",
            200
        )
        if success:
            print(f"   Found {len(response)} visits")
        return success

    def test_get_patient_visits(self):
        """Test get patient visits"""
        if not self.created_patient_id:
            print("❌ No patient ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Patient Visits",
            "GET",
            f"/api/visits?patient_id={self.created_patient_id}",
            200
        )
        if success:
            print(f"   Patient visits: {len(response)}")
        return success

    def test_get_visit_by_id(self):
        """Test get specific visit"""
        if not self.created_visit_id:
            print("❌ No visit ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Visit by ID",
            "GET",
            f"/api/visits/{self.created_visit_id}",
            200
        )
        return success

    def test_clinic_settings(self):
        """Test clinic settings"""
        success, response = self.run_test(
            "Get Clinic Settings",
            "GET",
            "/api/settings",
            200
        )
        return success

    def test_update_settings(self):
        """Test update clinic settings"""
        settings_data = {
            "clinic_name": "Test Private Clinic EMR",
            "address": "Test Address",
            "phone": "123-456-7890",
            "email": "test@clinic.com",
            "license_no": "TEST123"
        }
        
        success, response = self.run_test(
            "Update Clinic Settings",
            "PUT",
            "/api/settings",
            200,
            data=settings_data
        )
        return success

    def test_ai_assist(self):
        """Test AI assistance feature"""
        ai_data = {
            "text": "Patient has fever and cough for 3 days",
            "request_type": "diagnosis_suggest"
        }
        
        success, response = self.run_test(
            "AI Assist - Diagnosis Suggest",
            "POST",
            "/api/ai/assist",
            200,
            data=ai_data
        )
        
        if success and 'result' in response:
            print(f"   AI response received (length: {len(response['result'])})")
        return success

    def test_get_users(self):
        """Test get all users (admin only)"""
        success, response = self.run_test(
            "Get All Users",
            "GET",
            "/api/users",
            200
        )
        if success:
            print(f"   Found {len(response)} users")
        return success

    def test_audit_logs(self):
        """Test audit logs (admin only)"""
        success, response = self.run_test(
            "Get Audit Logs",
            "GET",
            "/api/audit-logs",
            200
        )
        if success:
            print(f"   Found {len(response)} audit entries")
        return success

    def test_export_patients(self):
        """Test patient export"""
        success, response = self.run_test(
            "Export Patients",
            "GET",
            "/api/export/patients",
            200
        )
        if success and 'data' in response:
            print(f"   Exported {len(response['data'])} patient records")
        return success

    def test_export_visits(self):
        """Test visit export"""
        success, response = self.run_test(
            "Export Visits",
            "GET",
            "/api/export/visits",
            200
        )
        if success and 'data' in response:
            print(f"   Exported {len(response['data'])} visit records")
        return success

def main():
    """Main test execution"""
    print("🏥 Private Clinic EMR API Testing")
    print("=" * 50)
    
    tester = ClinicEMRAPITester()
    
    # Test sequence following workflow
    test_sequence = [
        # Basic connectivity
        ("Root API", tester.test_root_endpoint),
        
        # Authentication
        ("Login", tester.test_login),
        ("Get Me", tester.test_get_me),
        
        # Dashboard
        ("Dashboard Stats", tester.test_dashboard_stats),
        
        # Patient Management
        ("Create Patient", tester.test_create_patient),
        ("Get All Patients", tester.test_get_patients),
        ("Search Patients", tester.test_search_patients),
        ("Get Patient by ID", tester.test_get_patient_by_id),
        ("Update Patient", tester.test_update_patient),
        
        # Appointment Management
        ("Create Appointment", tester.test_create_appointment),
        ("Get All Appointments", tester.test_get_appointments),
        ("Get Today Appointments", tester.test_get_today_appointments),
        ("Get Queue", tester.test_get_queue),
        ("Update Appointment Status", tester.test_update_appointment_status),
        
        # Visit Management
        ("Create Visit", tester.test_create_visit),
        ("Get All Visits", tester.test_get_visits),
        ("Get Patient Visits", tester.test_get_patient_visits),
        ("Get Visit by ID", tester.test_get_visit_by_id),
        
        # Settings & Admin
        ("Get Settings", tester.test_clinic_settings),
        ("Update Settings", tester.test_update_settings),
        ("Get Users", tester.test_get_users),
        ("Audit Logs", tester.test_audit_logs),
        
        # Export
        ("Export Patients", tester.test_export_patients),
        ("Export Visits", tester.test_export_visits),
        
        # AI Features
        ("AI Assist", tester.test_ai_assist),
    ]
    
    # Run tests
    for test_name, test_func in test_sequence:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with error: {str(e)}")
            tester.tests_run += 1
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())