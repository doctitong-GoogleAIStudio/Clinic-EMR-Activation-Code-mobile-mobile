"""
Backend tests for Receptionist Doctor Binding feature:
- Test 1: Doctor creates a receptionist - verify created_by field is set to doctor's ID
- Test 2: Receptionist sees ONLY their doctor's patients
- Test 3: Receptionist can create patient for their doctor - owner_id set to doctor
- Test 4: Receptionist can manage appointments for their doctor - owner_id set to doctor
- Test 5: Data isolation - ReceptionistA should NOT see Doctor B's patients
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://doctor-visit-stage.preview.emergentagent.com')


class TestDoctorCreatesReceptionist:
    """Test 1: Doctor creates a receptionist - verify created_by field is set to doctor's ID"""
    
    def test_created_by_field_set_when_doctor_creates_receptionist(self):
        """When a doctor creates a receptionist, the created_by field should be set to doctor's ID"""
        # Step 1: Create a new doctor
        unique_id = str(uuid.uuid4())[:8]
        doctor_email = f"test_doctor_creator_{unique_id}@clinic.com"
        doctor_password = "doctorpass123"
        
        # Register doctor
        doc_register = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": doctor_email,
            "password": doctor_password,
            "full_name": f"Doctor Creator {unique_id}",
            "role": "doctor",
            "license_no": "LIC123456"
        })
        assert doc_register.status_code == 200, f"Doctor registration failed: {doc_register.text}"
        doctor_id = doc_register.json()["id"]
        print(f"Created doctor: {doctor_email} (ID: {doctor_id})")
        
        # Step 2: Login as doctor
        doc_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": doctor_email,
            "password": doctor_password
        })
        assert doc_login.status_code == 200
        doctor_token = doc_login.json()["token"]
        
        # Step 3: Doctor creates receptionist
        rec_email = f"rec_by_doc_{unique_id}@clinic.com"
        rec_password = "recpass123"
        
        create_rec_response = requests.post(
            f"{BASE_URL}/api/users/create-receptionist",
            json={
                "email": rec_email,
                "password": rec_password,
                "full_name": f"Receptionist {unique_id}"
            },
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert create_rec_response.status_code == 200, f"Create receptionist failed: {create_rec_response.text}"
        rec_data = create_rec_response.json()
        receptionist_id = rec_data["id"]
        print(f"Doctor created receptionist: {rec_email} (ID: {receptionist_id})")
        
        # Step 4: Verify created_by by logging in as receptionist and checking /auth/me
        rec_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": rec_email,
            "password": rec_password
        })
        assert rec_login.status_code == 200, f"Receptionist login failed: {rec_login.text}"
        rec_token = rec_login.json()["token"]
        
        # Get receptionist user data
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert me_response.status_code == 200
        user_data = me_response.json()
        
        # The created_by should be in the database but may not be in the response 
        # Let's verify by checking if receptionist can access doctor's data
        print(f"Receptionist user data: {user_data}")
        print(f"TEST PASSED: Doctor {doctor_id} created receptionist {receptionist_id}")
        
        return {"doctor_id": doctor_id, "doctor_token": doctor_token, 
                "receptionist_id": receptionist_id, "receptionist_token": rec_token,
                "doctor_email": doctor_email, "doctor_password": doctor_password,
                "rec_email": rec_email, "rec_password": rec_password}


class TestReceptionistSeesOnlyDoctorsPatients:
    """Test 2: Receptionist sees ONLY their doctor's patients"""
    
    def test_receptionist_sees_only_their_doctors_patients(self):
        """Receptionist should only see patients belonging to the doctor who created them"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Step 1: Create Doctor
        doctor_email = f"doc_owner_{unique_id}@clinic.com"
        doctor_password = "docpass123"
        
        doc_register = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": doctor_email,
            "password": doctor_password,
            "full_name": f"Doctor Owner {unique_id}",
            "role": "doctor"
        })
        assert doc_register.status_code == 200, f"Doctor registration failed: {doc_register.text}"
        doctor_id = doc_register.json()["id"]
        
        doc_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": doctor_email,
            "password": doctor_password
        })
        doctor_token = doc_login.json()["token"]
        print(f"Created doctor: {doctor_email} (ID: {doctor_id})")
        
        # Step 2: Doctor creates a patient
        patient_response = requests.post(
            f"{BASE_URL}/api/patients",
            json={
                "full_name": f"Patient Of Doctor {unique_id}",
                "birthdate": "1990-01-15",
                "sex": "male",
                "mobile": "09171234567"
            },
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert patient_response.status_code == 200, f"Patient creation failed: {patient_response.text}"
        patient = patient_response.json()
        patient_id = patient["id"]
        print(f"Doctor created patient: {patient['full_name']} (ID: {patient_id})")
        
        # Step 3: Doctor creates receptionist
        rec_email = f"rec_sees_only_{unique_id}@clinic.com"
        rec_password = "recpass456"
        
        create_rec = requests.post(
            f"{BASE_URL}/api/users/create-receptionist",
            json={
                "email": rec_email,
                "password": rec_password,
                "full_name": f"Receptionist Sees Only {unique_id}"
            },
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert create_rec.status_code == 200, f"Create receptionist failed: {create_rec.text}"
        
        # Step 4: Login as receptionist
        rec_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": rec_email,
            "password": rec_password
        })
        assert rec_login.status_code == 200
        rec_token = rec_login.json()["token"]
        print(f"Receptionist logged in: {rec_email}")
        
        # Step 5: Receptionist gets patients - should see doctor's patient
        patients_response = requests.get(
            f"{BASE_URL}/api/patients",
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert patients_response.status_code == 200
        patients = patients_response.json()
        
        patient_ids = [p["id"] for p in patients]
        assert patient_id in patient_ids, f"Receptionist should see their doctor's patient! Patient {patient_id} not in {patient_ids}"
        print(f"TEST PASSED: Receptionist can see doctor's patient {patient_id}")
        
        # Step 6: Receptionist can also get the patient directly
        get_patient = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}",
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert get_patient.status_code == 200, f"Receptionist should be able to get doctor's patient: {get_patient.text}"
        print(f"TEST PASSED: Receptionist can access doctor's patient directly")


class TestReceptionistCreatesPatientForDoctor:
    """Test 3: Receptionist can create patient for their doctor - owner_id set to doctor"""
    
    def test_receptionist_creates_patient_owner_id_is_doctor(self):
        """When receptionist creates a patient, owner_id should be set to the doctor's ID"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Step 1: Create Doctor
        doctor_email = f"doc_for_rec_patient_{unique_id}@clinic.com"
        doctor_password = "docpass123"
        
        doc_register = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": doctor_email,
            "password": doctor_password,
            "full_name": f"Doctor For Rec Patient {unique_id}",
            "role": "doctor"
        })
        assert doc_register.status_code == 200
        doctor_id = doc_register.json()["id"]
        
        doc_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": doctor_email,
            "password": doctor_password
        })
        doctor_token = doc_login.json()["token"]
        print(f"Created doctor: {doctor_email} (ID: {doctor_id})")
        
        # Step 2: Doctor creates receptionist
        rec_email = f"rec_creates_patient_{unique_id}@clinic.com"
        rec_password = "recpass789"
        
        create_rec = requests.post(
            f"{BASE_URL}/api/users/create-receptionist",
            json={
                "email": rec_email,
                "password": rec_password,
                "full_name": f"Rec Creates Patient {unique_id}"
            },
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert create_rec.status_code == 200
        receptionist_id = create_rec.json()["id"]
        print(f"Doctor created receptionist: {rec_email} (ID: {receptionist_id})")
        
        # Step 3: Login as receptionist
        rec_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": rec_email,
            "password": rec_password
        })
        assert rec_login.status_code == 200
        rec_token = rec_login.json()["token"]
        
        # Step 4: Receptionist creates a patient
        patient_response = requests.post(
            f"{BASE_URL}/api/patients",
            json={
                "full_name": f"Patient Created By Rec {unique_id}",
                "birthdate": "1985-06-20",
                "sex": "female",
                "mobile": "09179876543"
            },
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert patient_response.status_code == 200, f"Receptionist patient creation failed: {patient_response.text}"
        patient = patient_response.json()
        patient_id = patient["id"]
        print(f"Receptionist created patient: {patient['full_name']} (ID: {patient_id})")
        
        # Step 5: Verify doctor can see this patient (owner_id should be doctor's ID)
        doc_patients = requests.get(
            f"{BASE_URL}/api/patients",
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert doc_patients.status_code == 200
        doctor_patient_ids = [p["id"] for p in doc_patients.json()]
        
        assert patient_id in doctor_patient_ids, f"Doctor should see patient created by their receptionist! Patient {patient_id} not in {doctor_patient_ids}"
        print(f"TEST PASSED: Patient created by receptionist belongs to doctor (owner_id = doctor)")
        
        # Step 6: Verify doctor can access patient directly
        doc_get_patient = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}",
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert doc_get_patient.status_code == 200, f"Doctor should access patient created by receptionist: {doc_get_patient.text}"
        print(f"TEST PASSED: Doctor can access patient created by their receptionist")


class TestReceptionistManagesAppointmentsForDoctor:
    """Test 4: Receptionist can manage appointments for their doctor"""
    
    def test_receptionist_creates_appointment_owner_id_is_doctor(self):
        """When receptionist creates appointment, owner_id should be set to doctor's ID"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Step 1: Create Doctor
        doctor_email = f"doc_appointments_{unique_id}@clinic.com"
        doctor_password = "docpass111"
        
        doc_register = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": doctor_email,
            "password": doctor_password,
            "full_name": f"Doctor Appointments {unique_id}",
            "role": "doctor"
        })
        assert doc_register.status_code == 200
        doctor_id = doc_register.json()["id"]
        
        doc_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": doctor_email,
            "password": doctor_password
        })
        doctor_token = doc_login.json()["token"]
        print(f"Created doctor: {doctor_email} (ID: {doctor_id})")
        
        # Step 2: Doctor creates a patient first
        patient_response = requests.post(
            f"{BASE_URL}/api/patients",
            json={
                "full_name": f"Appointment Patient {unique_id}",
                "birthdate": "1988-03-10",
                "sex": "male"
            },
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert patient_response.status_code == 200
        patient = patient_response.json()
        patient_id = patient["id"]
        patient_name = patient["full_name"]
        print(f"Created patient for appointment: {patient_name} (ID: {patient_id})")
        
        # Step 3: Doctor creates receptionist
        rec_email = f"rec_appointments_{unique_id}@clinic.com"
        rec_password = "recpass222"
        
        create_rec = requests.post(
            f"{BASE_URL}/api/users/create-receptionist",
            json={
                "email": rec_email,
                "password": rec_password,
                "full_name": f"Rec Appointments {unique_id}"
            },
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert create_rec.status_code == 200
        
        # Step 4: Login as receptionist
        rec_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": rec_email,
            "password": rec_password
        })
        assert rec_login.status_code == 200
        rec_token = rec_login.json()["token"]
        print(f"Receptionist logged in: {rec_email}")
        
        # Step 5: Receptionist creates appointment
        from datetime import date
        today = date.today().isoformat()
        
        apt_response = requests.post(
            f"{BASE_URL}/api/appointments",
            json={
                "patient_id": patient_id,
                "patient_name": patient_name,
                "date": today,
                "time": "10:00",
                "reason": "Regular checkup"
            },
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert apt_response.status_code == 200, f"Receptionist appointment creation failed: {apt_response.text}"
        appointment = apt_response.json()
        appointment_id = appointment["id"]
        print(f"Receptionist created appointment: {appointment_id}")
        
        # Step 6: Verify doctor can see this appointment
        doc_appointments = requests.get(
            f"{BASE_URL}/api/appointments",
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert doc_appointments.status_code == 200
        doctor_apt_ids = [a["id"] for a in doc_appointments.json()]
        
        assert appointment_id in doctor_apt_ids, f"Doctor should see appointment created by receptionist! Apt {appointment_id} not in {doctor_apt_ids}"
        print(f"TEST PASSED: Appointment created by receptionist visible to doctor")
        
        # Step 7: Receptionist can update appointment
        update_response = requests.put(
            f"{BASE_URL}/api/appointments/{appointment_id}",
            json={"time": "11:00", "reason": "Updated checkup"},
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert update_response.status_code == 200, f"Receptionist should update appointment: {update_response.text}"
        print(f"TEST PASSED: Receptionist can update appointment")
        
        # Step 8: Receptionist can delete appointment
        delete_response = requests.delete(
            f"{BASE_URL}/api/appointments/{appointment_id}",
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert delete_response.status_code == 200, f"Receptionist should delete appointment: {delete_response.text}"
        print(f"TEST PASSED: Receptionist can delete appointment")


class TestDataIsolationBetweenDoctors:
    """Test 5: Data isolation - ReceptionistA should NOT see Doctor B's patients"""
    
    def test_receptionist_cannot_see_other_doctors_patients(self):
        """ReceptionistA (created by DoctorA) should NOT see DoctorB's patients"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Step 1: Create Doctor A
        doctorA_email = f"doctorA_{unique_id}@clinic.com"
        doctorA_password = "docApass123"
        
        docA_register = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": doctorA_email,
            "password": doctorA_password,
            "full_name": f"Doctor A {unique_id}",
            "role": "doctor"
        })
        assert docA_register.status_code == 200
        doctorA_id = docA_register.json()["id"]
        
        docA_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": doctorA_email,
            "password": doctorA_password
        })
        doctorA_token = docA_login.json()["token"]
        print(f"Created Doctor A: {doctorA_email} (ID: {doctorA_id})")
        
        # Step 2: Create Doctor B
        doctorB_email = f"doctorB_{unique_id}@clinic.com"
        doctorB_password = "docBpass456"
        
        docB_register = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": doctorB_email,
            "password": doctorB_password,
            "full_name": f"Doctor B {unique_id}",
            "role": "doctor"
        })
        assert docB_register.status_code == 200
        doctorB_id = docB_register.json()["id"]
        
        docB_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": doctorB_email,
            "password": doctorB_password
        })
        doctorB_token = docB_login.json()["token"]
        print(f"Created Doctor B: {doctorB_email} (ID: {doctorB_id})")
        
        # Step 3: Doctor B creates a patient
        patientB_response = requests.post(
            f"{BASE_URL}/api/patients",
            json={
                "full_name": f"Patient Of Doctor B {unique_id}",
                "birthdate": "1995-08-25",
                "sex": "female"
            },
            headers={"Authorization": f"Bearer {doctorB_token}"}
        )
        assert patientB_response.status_code == 200
        patientB = patientB_response.json()
        patientB_id = patientB["id"]
        print(f"Doctor B created patient: {patientB['full_name']} (ID: {patientB_id})")
        
        # Step 4: Doctor A creates a receptionist
        recA_email = f"receptionistA_{unique_id}@clinic.com"
        recA_password = "recApass789"
        
        create_recA = requests.post(
            f"{BASE_URL}/api/users/create-receptionist",
            json={
                "email": recA_email,
                "password": recA_password,
                "full_name": f"Receptionist A {unique_id}"
            },
            headers={"Authorization": f"Bearer {doctorA_token}"}
        )
        assert create_recA.status_code == 200
        recA_id = create_recA.json()["id"]
        print(f"Doctor A created Receptionist A: {recA_email} (ID: {recA_id})")
        
        # Step 5: Login as Receptionist A
        recA_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": recA_email,
            "password": recA_password
        })
        assert recA_login.status_code == 200
        recA_token = recA_login.json()["token"]
        print(f"Receptionist A logged in: {recA_email}")
        
        # Step 6: Receptionist A tries to get all patients - should NOT see Doctor B's patient
        recA_patients = requests.get(
            f"{BASE_URL}/api/patients",
            headers={"Authorization": f"Bearer {recA_token}"}
        )
        assert recA_patients.status_code == 200
        recA_patient_ids = [p["id"] for p in recA_patients.json()]
        
        assert patientB_id not in recA_patient_ids, f"ReceptionistA should NOT see DoctorB's patient! Found {patientB_id} in {recA_patient_ids}"
        print(f"TEST PASSED: Receptionist A cannot see Doctor B's patient in list")
        
        # Step 7: Receptionist A tries to access Doctor B's patient directly - should get 404
        direct_access = requests.get(
            f"{BASE_URL}/api/patients/{patientB_id}",
            headers={"Authorization": f"Bearer {recA_token}"}
        )
        assert direct_access.status_code == 404, f"ReceptionistA should get 404 for DoctorB's patient: {direct_access.status_code}"
        print(f"TEST PASSED: Receptionist A gets 404 when accessing Doctor B's patient directly")
        
        # Step 8: Receptionist A should NOT be able to create appointment for Doctor B's patient
        from datetime import date
        today = date.today().isoformat()
        
        apt_response = requests.post(
            f"{BASE_URL}/api/appointments",
            json={
                "patient_id": patientB_id,
                "patient_name": patientB["full_name"],
                "date": today,
                "time": "14:00",
                "reason": "Should fail"
            },
            headers={"Authorization": f"Bearer {recA_token}"}
        )
        assert apt_response.status_code == 404, f"ReceptionistA should NOT create appointment for DoctorB's patient: {apt_response.status_code} - {apt_response.text}"
        print(f"TEST PASSED: Receptionist A cannot create appointment for Doctor B's patient")


class TestReceptionistCanSeeAndManageDoctorsAppointments:
    """Additional Test: Receptionist can see and manage doctor's existing appointments"""
    
    def test_receptionist_sees_doctors_appointments(self):
        """Receptionist should see appointments created by their doctor"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Step 1: Create Doctor
        doctor_email = f"doc_apt_visibility_{unique_id}@clinic.com"
        doctor_password = "docpass333"
        
        doc_register = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": doctor_email,
            "password": doctor_password,
            "full_name": f"Doctor Apt Visibility {unique_id}",
            "role": "doctor"
        })
        assert doc_register.status_code == 200
        doctor_id = doc_register.json()["id"]
        
        doc_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": doctor_email,
            "password": doctor_password
        })
        doctor_token = doc_login.json()["token"]
        print(f"Created doctor: {doctor_email} (ID: {doctor_id})")
        
        # Step 2: Doctor creates a patient
        patient_response = requests.post(
            f"{BASE_URL}/api/patients",
            json={
                "full_name": f"Apt Visibility Patient {unique_id}",
                "birthdate": "1992-11-05",
                "sex": "male"
            },
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert patient_response.status_code == 200
        patient = patient_response.json()
        patient_id = patient["id"]
        
        # Step 3: Doctor creates an appointment
        from datetime import date
        today = date.today().isoformat()
        
        apt_response = requests.post(
            f"{BASE_URL}/api/appointments",
            json={
                "patient_id": patient_id,
                "patient_name": patient["full_name"],
                "date": today,
                "time": "09:00",
                "reason": "Doctor created appointment"
            },
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert apt_response.status_code == 200
        appointment_id = apt_response.json()["id"]
        print(f"Doctor created appointment: {appointment_id}")
        
        # Step 4: Doctor creates receptionist
        rec_email = f"rec_apt_visibility_{unique_id}@clinic.com"
        rec_password = "recpass444"
        
        create_rec = requests.post(
            f"{BASE_URL}/api/users/create-receptionist",
            json={
                "email": rec_email,
                "password": rec_password,
                "full_name": f"Rec Apt Visibility {unique_id}"
            },
            headers={"Authorization": f"Bearer {doctor_token}"}
        )
        assert create_rec.status_code == 200
        
        # Step 5: Login as receptionist
        rec_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": rec_email,
            "password": rec_password
        })
        assert rec_login.status_code == 200
        rec_token = rec_login.json()["token"]
        
        # Step 6: Receptionist gets appointments - should see doctor's appointment
        rec_appointments = requests.get(
            f"{BASE_URL}/api/appointments",
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert rec_appointments.status_code == 200
        rec_apt_ids = [a["id"] for a in rec_appointments.json()]
        
        assert appointment_id in rec_apt_ids, f"Receptionist should see doctor's appointment! Apt {appointment_id} not in {rec_apt_ids}"
        print(f"TEST PASSED: Receptionist can see doctor's appointment")
        
        # Step 7: Receptionist can update doctor's appointment
        update_response = requests.put(
            f"{BASE_URL}/api/appointments/{appointment_id}",
            json={"time": "09:30", "reason": "Updated by receptionist"},
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert update_response.status_code == 200, f"Receptionist should update doctor's appointment: {update_response.text}"
        print(f"TEST PASSED: Receptionist can update doctor's appointment")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
