# Private Clinic EMR - Product Requirements Document

## Original Problem Statement
Build a fast, simple, and profitable **Private Clinic EMR** web application with an advanced AI Doctor Assistant Dictation System and a commercial-grade device-bound licensing system.

## Users & Roles
- **Doctor**: Manage patients, document visits, print forms, AI-assisted notes
- **Receptionist**: Register patients, manage appointments
- **Admin**: Manage users, clinic settings
- **Super Admin (DDH)**: Manage device licenses across all deployments (separate auth)

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
- [x] **Labs & Imaging tab** - Messenger-style file upload/display
- [x] **Lab/Imaging Request Forms** - Printable lab & imaging request forms
- [x] **Edit SOAP Notes** - Edit button to modify SOAP notes after visit creation
- [x] **Local File Storage** - Files saved to disk instead of MongoDB
- [x] **PWA Support** - Progressive Web App with offline caching, install prompt, app icons
- [x] Patient deletion with cascade
- [x] About page with developer credits
- [x] Data isolation (owner_id on all collections)
- [x] Performance: DB indexes and API pagination
- [x] Dashboard with stats
- [x] AI assist (SOAP convert, diagnosis suggest, patient instructions)
- [x] **Private Receptionist Creation** - Doctors/Admins create receptionists from Settings
- [x] **Receptionist-Doctor Binding** - Receptionist tied to specific doctor
- [x] **Per-User Clinic Settings** - Each user has their own clinic settings
- [x] **AI-Assisted Consultation** - Full AI consultation with SOAP generation, diagnosis suggestions, ICD-10 codes
- [x] **Save Draft Feature** - AI consultation drafts per patient, persisted in MongoDB
- [x] **Compare Drafts Feature** - Side-by-side comparison of saved AI consultations
- [x] **AI Doctor Assistant Dictation System** - Voice dictation with Whisper + GPT-5.2 structuring
- [x] **Data Backup & Restore** - Manual backup/restore with merge/replace modes
- [x] **Print Settings** - Comprehensive customizable print settings for all form types
- [x] **Change Password** - With strength meter and rate limiting
- [x] **User Guide** - Step-by-step guides for Doctors and Receptionists

## Bug Fixes (Sep 4, 2026)
- [x] **Unlimited backup/export** - `/api/export/patients` and `/api/export/visits` no longer cap results (removed skip/limit; `to_list(length=None)`). Backup is now limited only by storage.
- [x] **Birthdate picker fix** - Replaced flaky native `type="date"` (reverted to current date on mobile) with `BirthdatePicker` (shadcn Calendar + Month/Year dropdowns, 1900–today). Used in NewPatientPage and PatientProfilePage edit mode.
- [x] **Age auto-fill** - BirthdatePicker shows the computed age ("Age: N years old") live the moment a birthdate is picked (both new-patient and edit screens).

## Bug Fixes (Sep 8, 2026)
- [x] **Allergies/Chronic Conditions comma bug** - The Medical Information textareas split on comma and `.filter(Boolean)` on every keystroke, stripping the comma as you typed so entries couldn't be separated. Fix: inputs now hold raw text while typing and are parsed into arrays (split/trim/drop-empties) only on save. Applied to NewPatientPage (create) and PatientProfilePage (edit). Verified via testing agent (create + edit).
- [x] **>1000 patients could not save/see SOAP** - Root cause: `get_visits` and sibling per-patient list endpoints (attachments, prescriptions, certificates, lab-requests, license-stats) enumerated the doctor's owned patients with a hard `.to_list(1000)` cap. For any patient beyond the first 1000, their id was excluded from the ownership `$in` filter, so their visits/records returned empty — SOAP looked unsaved. Fix: all owned-patient enumerations now use `.to_list(length=None)` (no cap; limited only by storage). Also removed 10k/100k caps in backup/restore/import paths. Verified via testing agent (12/12) by seeding 1001 patients and confirming the 1001st patient's SOAP persists and lists correctly. Indexes on `patients.owner_id` and `visits.patient_id` already exist for scale.
- [x] **SOAP notes disappearing after refresh** - Root cause: PWA/browser serving stale cached app + API responses. Fix: (a) backend HTTP middleware sets `Cache-Control: no-store` on all `/api` responses; (b) `service-worker.js` rewritten (cache `clinic-emr-v3`, network-only for navigations/app code, purges all old caches on activate).

## Licensing / Trial Removed (Sep 16, 2026)
- Device activation gate, self-service 7-day trial, activation codes, grace period and the super-admin license portal were all removed. The app opens straight to the EMR login/signup; access is controlled only by EMR user accounts.

## Object Storage Migration - Implemented (Sep 1, 2026)
- [x] **Attachments moved to Emergent Object Storage** (was pod-local disk, which broke on deployed/production). Upload -> `storage_put`, download/OCR -> `storage_get`. DB stores `storage_path` object key. Legacy `stored_filename`/`file_data` still read as fallback.

## Key DB Schema
- **users**: `{id, email, hashed_password, full_name, role, license_no, ptr_no, prc_no, specialization, created_by}`
- **patients**: `{id, patient_id, full_name, birthdate, sex, ..., owner_id, created_by}`
- **visits**: `{id, patient_id, vitals, soap_*, ..., created_by, owner_id}`
- **appointments**: `{id, patient_id, date, time, status, ..., owner_id, created_by}`
- **attachments**: `{id, patient_id, visit_id, filename, storage_path, content_type, file_size, tag, notes, uploaded_by, uploaded_at}` (legacy: stored_filename/file_data)
- **prescriptions**: `{id, patient_id, visit_id, medications, notes, created_by}`
- **certificates**: `{id, patient_id, visit_id, certificate_type, content, created_by}`
- **lab_requests**: `{id, patient_id, visit_id, request_type, tests, clinical_info, urgency, created_by, created_at}`
- **ai_drafts**: `{id, patient_id, owner_id, clinical_notes, ai_result, red_flags, created_by_name, created_at}`
- **dictation_sessions**: `{id, patient_id, visit_id, provider_id, ...dictation data...}`
- **dictation_audit_logs**: `{id, dictation_session_id, action_type, action_by, ...}`

## Key API Endpoints
- `POST /api/auth/register` | `POST /api/auth/login` | `GET /api/auth/me`
- `POST /api/users/create-receptionist`
- `GET/POST /api/patients` | `GET/PUT/DELETE /api/patients/{id}`
- `GET/POST /api/visits` | `GET/PUT/DELETE /api/visits/{id}`
- `GET/POST /api/appointments` | `PUT/DELETE /api/appointments/{id}`
- `GET/POST /api/attachments` | `GET/PUT/DELETE /api/attachments/{id}`
- `GET/POST /api/lab-requests`
- `GET/POST /api/prescriptions` | `GET/POST /api/certificates`
- `POST /api/ai/ocr` | `POST /api/ai/assist` | `GET/POST/DELETE /api/ai/drafts`
- `POST /api/dictation/transcribe` | `POST /api/dictation/structure`
- `POST /api/restore` | `GET /api/export/patients` | `GET /api/export/visits`
## Credentials
- EMR Admin: doctitong@yahoo.com / admin123
- Super Admin (Licensing): superadmin@ddhapps.com / DDH_SuperAdmin_2026!

## 3rd Party Integrations
- OpenAI GPT-5.2 via Emergent LLM Key (`emergentintegrations`)
- OpenAI Whisper (Audio Transcription) via user's `OPENAI_API_KEY` in backend `.env`
- Emergent Object Storage (private file attachments) via `INTEGRATION_PROXY_URL` + `EMERGENT_LLM_KEY`

## P1 - Upcoming Tasks
- [ ] Admin approval for new Doctor/Admin sign-ups
- [ ] Attachment tagging/filtering in "Labs & Imaging" section
- [ ] Refactor duplicated file upload UI into reusable component

## P2 - Future/Backlog
- [ ] Simple inventory management
- [ ] Billing/OR and receipt printing
- [ ] Email/SMS appointment reminders
- [ ] Refactor: Split server.py (~3100 lines) into modular route files under `/app/backend/routes/`
- [ ] Build a shared DDH Licensing SDK (@ddh/license) for reuse across apps
- [ ] Master License Server (license.ddhapps.com) for centralized management
