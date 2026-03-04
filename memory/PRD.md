# Private Clinic EMR - Product Requirements Document

## Original Problem Statement
Build a fast, simple, and profitable **Private Clinic EMR** web application.

## Users & Roles
- **Doctor**: Manage patients, document visits, print forms, AI-assisted notes
- **Receptionist**: Register patients, manage appointments
- **Admin**: Manage users, clinic settings

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Recharts, react-to-print, lucide-react
- **Backend**: FastAPI, Pydantic, Motor (async MongoDB), JWT auth
- **Database**: MongoDB
- **AI**: Emergent LLM Key (GPT-5.2 via emergentintegrations)

## Core Features - Implemented
- [x] Login & public Sign Up (Doctor, Admin only - Receptionist removed from public signup)
- [x] Patient registry (CRUD) with search
- [x] Consultation notes (SOAP format) and vitals tracking
- [x] Calendar-based appointments and walk-in queue
- [x] Printing of Prescriptions (Rx), Medical Certificates, Fit-to-Work, Referral forms
- [x] File uploads for patient attachments with tagging (Lab, X-ray, Ultrasound, ECG)
- [x] **Labs & Imaging tab** - Messenger-style file upload/display (Feb 25, 2026)
- [x] **Lab/Imaging Request Forms** - Printable lab & imaging request forms with tests, urgency, clinical info (Feb 26, 2026)
- [x] **Edit SOAP Notes** - Edit button to modify SOAP notes after visit creation (Feb 27, 2026)
- [x] **Local File Storage** - Files saved to disk instead of MongoDB for better performance (Feb 27, 2026)
- [x] **PWA Support** - Progressive Web App with offline caching, install prompt, app icons (Feb 27, 2026)
- [x] Patient deletion with cascade
- [x] About page with developer credits
- [x] Data isolation (owner_id on all collections) - **VERIFIED Dec 2025**
- [x] Performance: DB indexes and API pagination
- [x] Dashboard with stats
- [x] AI assist (SOAP convert, diagnosis suggest, patient instructions)
- [x] **Private Receptionist Creation** - Doctors/Admins create receptionists from Settings (Dec 2025)
- [x] **Receptionist-Doctor Binding** - Receptionist tied to specific doctor who created them. Sees only their doctor's patients/appointments (Dec 2025)
- [x] **Per-User Clinic Settings** - Each user has their own clinic settings pre-filled from signup
- [x] **AI-Assisted Consultation** - Full AI consultation with SOAP generation, diagnosis suggestions, ICD-10 codes, medication recommendations, and red flag alerts (Mar 1, 2026)
- [x] **Save Draft Feature** - Save and load AI consultation drafts per patient, with timestamps and diagnosis preview. Now persisted in MongoDB (Mar 1, 2026)
- [x] **Compare Drafts Feature** - Side-by-side comparison of saved AI consultations showing clinical notes, SOAP notes, diagnoses, and medications with ability to apply either draft (Mar 1, 2026)
- [x] **Draft History (Database Persistence)** - AI consultation drafts now stored in MongoDB instead of localStorage. Persists across sessions, shows creator name, max 10 drafts per patient (Mar 1, 2026)
- [x] **Error Handling Fix** - All API error handlers now use getErrorMessage utility to prevent React crashes on Pydantic validation errors (Mar 1, 2026)

## Key DB Schema
- **users**: `{id, email, hashed_password, full_name, role, license_no, ptr_no, prc_no, specialization, created_by}` (created_by links receptionist to doctor)
- **patients**: `{id, patient_id, full_name, birthdate, sex, ..., owner_id, created_by}`
- **visits**: `{id, patient_id, vitals, soap_*, ..., created_by, owner_id}`
- **appointments**: `{id, patient_id, date, time, status, ..., owner_id, created_by}`
- **attachments**: `{id, patient_id, visit_id, filename, file_data, content_type, tag, notes, uploaded_by}`
- **prescriptions**: `{id, patient_id, visit_id, medications, notes, created_by}`
- **certificates**: `{id, patient_id, visit_id, certificate_type, content, created_by}`
- **lab_requests**: `{id, patient_id, visit_id, request_type, tests, clinical_info, urgency, created_by, created_at}`
- **ai_drafts**: `{id, patient_id, owner_id, clinical_notes, ai_result, red_flags, created_by_name, created_at}` - Persisted AI consultation drafts

## Key API Endpoints
- `POST /api/auth/register` | `POST /api/auth/login`
- `POST /api/users/create-receptionist` - Doctor/Admin creates receptionist
- `GET/POST /api/patients` | `GET/PUT/DELETE /api/patients/{id}`
- `GET/POST /api/visits` | `GET/PUT/DELETE /api/visits/{id}`
- `GET/POST /api/appointments` | `PUT/DELETE /api/appointments/{id}`
- `GET/POST /api/attachments` | `GET/PUT/DELETE /api/attachments/{id}`
- `GET/POST /api/lab-requests` - Lab/Imaging request forms
- `GET/POST /api/prescriptions` | `GET/POST /api/certificates`
- `POST /api/ai/ocr` - Extract text from uploaded SOAP images using GPT vision
- `GET/POST /api/ai/drafts` - AI consultation drafts
- `DELETE /api/ai/drafts/{draft_id}` - Delete specific draft
- `DELETE /api/ai/drafts/patient/{patient_id}` - Clear all drafts for a patient
- `GET/PUT /api/settings` (per-user) | `POST /api/ai/assist`

## Credentials
- Admin: admin@clinic.com / admin123

## Recent Changes
- **Mar 4, 2026**: **Fixed Appointment Delete Function** - Replaced window.confirm() with AlertDialog component for reliable cross-browser support. Delete now shows proper confirmation dialog with patient name and time
- **Mar 4, 2026**: **Fixed Timezone Issue for Dashboard** - Dashboard, queue, and stats now use client's local date instead of server date. Appointments created in your timezone will now appear correctly
- **Mar 4, 2026**: **Removed "Made with Emergent" Badge** - Hidden the badge from the UI
- **Mar 3, 2026**: **Added Delete Option for Saved Forms** - Prescriptions, Certificates, and Lab Requests can now be deleted from the Visit Detail page. Red trash icon appears next to the print button for each saved form
- **Mar 3, 2026**: **Added Vitals Preview Tooltip** - Hover over "Vitals Ready" badges to see detailed vital values (BP, HR, RR, Temp, SpO2, Weight, Height) without opening the visit. Color-coded icons for easy reading
- **Mar 3, 2026**: **Added Vitals Ready Indicators** - Appointments with pre-recorded vitals now display green "Vitals Ready" badges on Dashboard queue, Appointments page, and sidebar. Visual distinction helps doctors identify patients ready for consultation
- **Mar 3, 2026**: **Verified Receptionist-to-Doctor Vitals Flow** - Receptionist can enter vital signs when scheduling appointments, and these vitals automatically populate the doctor's New Visit page with "Vitals loaded from appointment" toast confirmation
- **Mar 1, 2026**: Added OCR (Optical Character Recognition) feature - doctors can upload scanned/handwritten SOAP notes and AI extracts text to pre-fill SOAP fields. Uses GPT-5.2 vision with emergentintegrations library
- **Mar 1, 2026**: Moved "Upload SOAP Notes" feature from Visit Detail page to New Visit page - now appears after SOAP Notes section, before Labs & Imaging
- **Mar 1, 2026**: Added "Draft History" feature - AI consultation drafts now stored in MongoDB instead of localStorage. Drafts persist across browser sessions, show creator name, and are limited to 10 per patient. New API endpoints: POST/GET/DELETE /api/ai/drafts
- **Mar 1, 2026**: Added "Compare Drafts" feature - doctors can select 2 saved AI consultations and view them side-by-side in a comparison dialog showing clinical notes, SOAP notes, diagnoses, and medications with color-coded sections
- **Mar 1, 2026**: Added "Save Draft" feature for AI consultations - doctors can save AI-generated suggestions and load them later before applying to visit record. Shows diagnosis preview and timestamp.
- **Mar 1, 2026**: Fixed recurring React crash - Added getErrorMessage utility to ALL API error handlers across 8 files (AppointmentsPage, PatientsPage, SettingsPage, PatientProfilePage, VisitDetailPage, DashboardPage, NewVisitPage, AIConsultation)
- **Mar 1, 2026**: AI-Assisted Consultation feature now fully functional on New Visit page with SOAP generation, diagnosis/ICD-10 suggestions, medication recommendations, and red flag alerts
- **Dec 2025**: Fixed React error - Pydantic validation error objects now properly extracted for toast messages
- **Dec 2025**: Create Receptionist flow verified end-to-end (Doctor/Admin creates, receptionist logs in, limited access confirmed)
- **Dec 2025**: Data isolation between doctors verified (Doctor A cannot see Doctor B's patients)
- **Dec 2025**: Fixed uuid4 bug and created ReceptionistCreate model for cleaner API
- **Feb 25, 2026**: Added Labs & Imaging section to New Visit page
- **Feb 25, 2026**: Added edit/rename for Labs & Imaging files
- **Feb 25, 2026**: Enhanced Labs & Imaging file viewer with zoom controls
- [x] Data isolation verified (backend + frontend testing passed)
- [x] Labs & Imaging with messenger-style UI

## P1 - Upcoming Tasks
- [ ] Admin approval for new Doctor/Admin sign-ups
- [ ] Attachment tagging/filtering in "Labs & Imaging" section
- [ ] Refactor duplicated file upload UI into reusable component

## P2 - Future/Backlog
- [ ] Simple inventory management
- [ ] Billing/OR and receipt printing
- [ ] Email/SMS appointment reminders
- [ ] Differentiate print forms for Fit-to-Work vs Referral letters
- [ ] Refactor: Extract print template logic into reusable components
