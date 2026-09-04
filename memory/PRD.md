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
- **Security**: Ed25519 digital signatures, AES-256-GCM encryption, HMAC-SHA256, Web Crypto API

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

## Licensing System - Implemented (Aug 1, 2026)
- [x] **Device Fingerprinting** - Generates unique DDH-XXXX-XXXX-XXXX-XXXX Device IDs from browser/hardware characteristics (OS, GPU, screen, timezone, language, WebGL, canvas, random seed)
- [x] **Activation Gate** - Blocks all app access (including login) until device is activated
- [x] **Online Activation** - Short activation codes (DDH-XXXX-XXXX-XXXX-XXXX format) verified against server
- [x] **Offline Activation** - Base64-encoded signed license keys for offline verification
- [x] **Ed25519 Digital Signatures** - License payloads signed with Ed25519 private key, verifiable with public key
- [x] **AES-256-GCM Encrypted Storage** - License data stored encrypted in localStorage, key derived from device fingerprint + activation code via PBKDF2
- [x] **Device Binding Protection** - Copying license data to another device fails (different fingerprint = wrong decryption key)
- [x] **License Types**: Lifetime, 1-Year, Trial (configurable days + patient limit), Hospital
- [x] **Grace Period** - 7-day grace period after license expiry with warning banner, then full lockout
- [x] **Super Admin Portal** - Separate auth, dashboard with stats, license table, search, CRUD operations
- [x] **License Operations**: Generate, Activate, Revoke, Reactivate, Transfer (to new device), Extend, Delete
- [x] **Audit Trail** - Full audit log of all license operations with timestamps
- [x] **Online Revocation Check** - App silently checks server for revocation on startup when internet is available

## Bug Fixes (Sep 4, 2026)
- [x] **Unlimited backup/export** - `/api/export/patients` and `/api/export/visits` no longer cap results (removed skip/limit; `to_list(length=None)`). Backup is now limited only by storage.
- [x] **Birthdate picker fix** - Replaced flaky native `type="date"` (reverted to current date on mobile) with `BirthdatePicker` (shadcn Calendar + Month/Year dropdowns, 1900–today). Used in NewPatientPage and PatientProfilePage edit mode.
- [x] **Age auto-fill** - BirthdatePicker shows the computed age ("Age: N years old") live the moment a birthdate is picked (both new-patient and edit screens).

## Self-Service 7-Day Trial - Implemented (Sep 1, 2026)
- [x] **Instant Trial Gate** - Fresh/new device sees a Trial Sign-up screen (Full Name, Email, Password) instead of a hard activation block. Signing up starts a fully functional 7-day trial.
- [x] **Device-Bound (one trial per device)** - Backend `POST /api/license/start-trial` enforces one trial per device fingerprint; expired/used-trial devices get HTTP 403 and must enter an activation code.
- [x] **Live Countdown** - Top banner (all pages) + Dashboard card show remaining time to minute/second granularity. "Activate Now" available anytime -> `/activate` route.
- [x] **Trial is separate from EMR login** - After the trial unlocks the app, the user still logs in / signs up for an EMR doctor account.
- [x] **Send Device ID** - mailto button on Trial + Activation pages, prefilled to docvincent2022@yahoo.com and including the customer's registered email.
- [x] **After 7 days** - Device locks and shows the Activation screen requiring an activation code (trialEligible=false path in `UnactivatedGate`).

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
- **licenses**: `{id, device_id, activation_code, app_name, customer_name, customer_email, license_type, status, expires_at, trial_patient_limit, signature, signed_payload, notes, activated_at, created_at, updated_at}`
- **license_audit_logs**: `{id, license_id, device_id, action, details, performed_by, timestamp}`

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
- **License System:**
  - `POST /api/license/start-trial` - Self-service 7-day trial (device-bound)
  - `POST /api/license/check` - Check if a stored device license is still valid on server
  - `POST /api/license/activate` - Online device activation
  - `POST /api/license/activate-offline` - Offline device activation
  - `POST /api/license/verify` - Verify existing license
  - `GET /api/license/public-key` - Ed25519 public key for offline verification
  - `POST /api/license/admin/login` - Super admin authentication
  - `GET /api/license/admin/stats` - License statistics
  - `GET /api/license/admin/licenses` - List all licenses
  - `GET /api/license/admin/licenses/{id}` - Get single license
  - `POST /api/license/admin/generate` - Generate new license + activation code
  - `PUT /api/license/admin/revoke/{id}` - Revoke a license
  - `PUT /api/license/admin/reactivate/{id}` - Reactivate a revoked license
  - `PUT /api/license/admin/extend/{id}` - Extend license expiry
  - `PUT /api/license/admin/transfer/{id}` - Transfer to new device
  - `DELETE /api/license/admin/licenses/{id}` - Delete license
  - `GET /api/license/admin/audit` - View audit logs

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
