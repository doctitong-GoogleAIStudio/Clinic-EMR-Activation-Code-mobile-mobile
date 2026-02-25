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
- [x] Patient deletion with cascade
- [x] About page with developer credits
- [x] Data isolation (owner_id on all collections) - **VERIFIED Dec 2025**
- [x] Performance: DB indexes and API pagination
- [x] Dashboard with stats
- [x] AI assist (SOAP convert, diagnosis suggest, patient instructions)
- [x] **Private Receptionist Creation** - Doctors/Admins create receptionists from Settings (Dec 2025)
- [x] **Receptionist-Doctor Binding** - Receptionist tied to specific doctor who created them. Sees only their doctor's patients/appointments (Dec 2025)
- [x] **Per-User Clinic Settings** - Each user has their own clinic settings pre-filled from signup

## Key DB Schema
- **users**: `{id, email, hashed_password, full_name, role, license_no, ptr_no, prc_no, specialization}`
- **patients**: `{id, patient_id, full_name, birthdate, sex, ..., owner_id}`
- **visits**: `{id, patient_id, vitals, soap_*, ..., created_by, owner_id}`
- **appointments**: `{id, patient_id, date, time, status, ..., owner_id}`
- **attachments**: `{id, patient_id, visit_id, filename, file_data, content_type, tag, notes, uploaded_by}`
- **prescriptions**: `{id, patient_id, visit_id, medications, notes, created_by}`
- **certificates**: `{id, patient_id, visit_id, certificate_type, content, created_by}`

## Key API Endpoints
- `POST /api/auth/register` | `POST /api/auth/login`
- `POST /api/users/create-receptionist` - Doctor/Admin creates receptionist (NEW)
- `GET/POST /api/patients` | `GET/PUT/DELETE /api/patients/{id}`
- `GET/POST /api/visits` | `GET/PUT/DELETE /api/visits/{id}`
- `GET/POST /api/appointments` | `PUT/DELETE /api/appointments/{id}`
- `GET/POST /api/attachments` | `GET/PUT/DELETE /api/attachments/{id}`
- `GET/POST /api/prescriptions` | `GET/POST /api/certificates`
- `GET/PUT /api/settings` (per-user) | `POST /api/ai/assist`

## Credentials
- Admin: admin@clinic.com / admin123

## Recent Changes
- **Dec 2025**: Fixed React error - Pydantic validation error objects now properly extracted for toast messages
- **Dec 2025**: Create Receptionist flow verified end-to-end (Doctor/Admin creates, receptionist logs in, limited access confirmed)
- **Dec 2025**: Data isolation between doctors verified (Doctor A cannot see Doctor B's patients)
- **Dec 2025**: Fixed uuid4 bug and created ReceptionistCreate model for cleaner API
- **Feb 25, 2026**: Added Labs & Imaging section to New Visit page — doctors can upload/view/edit/analyze patient's lab results and imaging files during visit documentation. Same messenger-style UI with zoom/pan viewer.
- **Feb 25, 2026**: Added edit/rename for Labs & Imaging files — inline edit form with filename, tag, and notes fields. Backend PUT /api/attachments/{id} with data isolation.
- **Feb 25, 2026**: Enhanced Labs & Imaging file viewer with zoom controls (slider, +/- buttons, mouse wheel), drag-to-pan (up/down, side to side), reset/fit buttons, and download. PDFs open in new tab.
- [x] Data isolation verified (backend + frontend testing passed)
- [x] Labs & Imaging with messenger-style UI

## P1 - Upcoming Tasks
- [ ] Admin approval for new sign-ups
- [ ] Attachment tagging improvements

## P2 - Future/Backlog
- [ ] Lab/Rad request forms
- [ ] Simple inventory management
- [ ] Billing/OR and receipt printing
- [ ] Email/SMS appointment reminders
- [ ] Differentiate print forms for Fit-to-Work vs Referral letters
- [ ] Refactor: Extract print template logic into reusable components
