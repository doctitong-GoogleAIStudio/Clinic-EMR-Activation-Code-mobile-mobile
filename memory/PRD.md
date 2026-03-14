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
- **dictation_sessions**: `{id, patient_id, visit_id, provider_id, provider_name, dictation_mode, language, status, raw_transcript, cleaned_transcript, ai_structured_json, review_flags_json, physician_reviewed, inserted_sections_json, duration_seconds, created_at, updated_at}`
- **dictation_audit_logs**: `{id, dictation_session_id, action_type, action_by, action_timestamp, notes}`

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
- `POST/GET/PUT /api/dictation/sessions` | `GET /api/dictation/sessions/{id}` - Dictation session CRUD
- `POST /api/dictation/transcribe` - Whisper speech-to-text (multipart audio upload)
- `POST /api/dictation/structure` - GPT-5.2 clinical structuring (transcript → SOAP JSON)
- `POST /api/dictation/audit` | `GET /api/dictation/audit/{session_id}` - Audit logging
- `POST /api/restore` - Restore backup with merge/replace modes

## Credentials
- Admin: admin@clinic.com / admin123

## Recent Changes
- **Mar 14, 2026**: **AI Doctor Assistant Dictation System (Phase 1 Complete)** - Production-grade voice dictation module:
  - New 3-column AI Consultation page (Patient Snapshot | SOAP Editor | AI Dictation Panel)
  - Voice recording controls (Start/Pause/Resume/Stop) with audio level meter and timer
  - Speech-to-text via OpenAI Whisper (Emergent LLM Key)
  - AI clinical structuring via GPT-5.2 — converts transcript into structured SOAP, Rx, Orders, Instructions, ICD-10 suggestions
  - 8 dictation modes (Full Consultation, Subjective, Objective, Assessment, Plan, Prescription, Orders, Instructions)
  - Insert-to-chart with Append/Replace/Cancel confirmation dialogs
  - Structured output preview with review flags and uncertainty highlighting
  - Full audit trail (recording_started, transcript_generated, ai_processed, section_inserted, saved_to_chart)
  - Dictation session management (CRUD) with provider isolation
  - Accessible from Patient Profile page via "AI Dictation" button
  - Route: /patients/:patientId/ai-consultation
  - Backend: POST /api/dictation/sessions, /transcribe, /structure, /audit
  - DB: dictation_sessions, dictation_audit_logs collections
- **Mar 13, 2026**: **Restore Backup Feature** - Restore from backup JSON with merge/replace modes
- **Mar 13, 2026**: **Data Backup Feature** - Backup Now button, 3-day overdue banner, toast reminders
- **Mar 5, 2026**: **Added Change Password Feature** - Doctors can change their password from Settings. Includes: password strength meter (Weak to Very Strong), show/hide eye icons, match validation, rate limiting (5 attempts then 10 min lockout), prevents reusing current password
- **Mar 5, 2026**: **Added Receptionist Account Management** - Doctors can now view list of their receptionists, edit account details (name, email, password), and delete receptionist accounts from the Settings page
- **Mar 5, 2026**: **Added Print Header Customization** - New section in Settings to customize printed form headers with: Header Title, Subtitle/Tagline, Logo Upload (from local file), and Additional Text. Includes live preview
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

## Recent Changes (continued)
- **Mar 6, 2026**: **Added User Guide Page** - Comprehensive step-by-step user guide added to Settings page with separate guides for Doctors and Receptionists. Includes collapsible sections for Login, Patients, Appointments, SOAP Notes, Prescriptions, Labs, Printing, and Troubleshooting.
- **Mar 6, 2026**: **Updated User Guide** - Changed "Doctor Guide" to "Doctor's Guide" and "Receptionist Guide" to "Receptionist's Guide". Added Section 11: "Create & Manage Receptionists" with instructions for creating, viewing, editing, and deleting receptionist accounts.
- **Mar 6, 2026**: **Added Data Import Feature** - New "Imports" tab in Settings for importing Patient Registry and Visit Records from JSON files. Includes validation, error reporting, and format examples. Backend endpoints: POST /api/import/patients, POST /api/import/visits.
- **Mar 8, 2026**: **Prescription Print Settings** - Added comprehensive print settings panel with:
  - Paper size customization (presets: 8x4in, 5x3in, A5, A6, custom)
  - Layout position settings (top/bottom/left/right offsets, content width)
  - Typography settings (font size, line spacing, section spacing)
  - Section visibility toggles (header, patient info, Rx label, signature, footer, date, age/sex, quantity, doctor name, license no.)
  - Live preview panel
  - Settings persistence via localStorage
  - Modular design for future reuse with other print types
- **Mar 8, 2026**: **Print Settings Integration with Visit Details** - Integrated PrintPreviewDialog into VisitDetailPage:
  - Creates prescription → Shows print preview dialog with live settings preview
  - View saved prescription → "Print Prescription" button opens print preview dialog
  - Settings tab in dialog allows real-time adjustments before printing
  - Fixed bug: changed `clinicSettings` prop to correct `settings` variable
- **Mar 8, 2026**: **Extended Print Settings to All Form Types** - Major update to support all form types:
  - PrintPreviewDialog now supports: Prescription, Medical Certificate, Fit-to-Work, Referral Letter, Lab/Imaging Request
  - Settings > Print Settings page updated with form type selector (5 tabs with icons)
  - Each form type has its own dedicated settings stored separately in localStorage
  - Default paper sizes: Prescription (8x4in), Certificates/Referrals/Lab Requests (Letter 8.5x11in)
  - "Copy Settings To" feature allows copying settings between form types
  - "Export All" exports settings for all form types to a single JSON file
  - Live preview updates based on selected form type
  - VisitDetailPage now opens print preview dialog for all form types (not just prescriptions)

## P1 - Upcoming Tasks
- [ ] Admin approval for new Doctor/Admin sign-ups
- [ ] Attachment tagging/filtering in "Labs & Imaging" section
- [ ] Refactor duplicated file upload UI into reusable component

## P2 - Future/Backlog
- [ ] Simple inventory management
- [ ] Billing/OR and receipt printing
- [ ] Email/SMS appointment reminders
- [ ] Refactor: Extract duplicated file upload UI into reusable component

## Recent Changes (Mar 9-13, 2026)
- **Mar 9, 2026**: **Added PRC/PTR/S2 Number Settings** - Added Show PRC No., Show PTR No., and Show S2 No. checkboxes to print settings (below Show Signature). These credentials are now loaded from clinic settings and displayed in print preview and print output.
- **Mar 9, 2026**: **Fixed Credentials Auto-Load** - Print preview now loads PRC/PTR/S2 numbers from clinic settings (Settings page) instead of just user profile, ensuring credentials appear in print output.
- **Mar 9, 2026**: **Added refreshUser to AuthContext** - Settings page now refreshes user data after saving, ensuring auth context has updated credentials.
- **Mar 13, 2026**: **Restore Backup Feature (Complete)** - Full backup restore system:
  - Restore button on Dashboard header and Settings > Imports tab
  - RestoreBackupDialog: file upload, preview (patient/visit counts), type & mode selection
  - Merge mode: adds new records, skips duplicates by name+birthdate
  - Replace mode: deletes all existing data then imports from backup (with confirmation dialog)
  - Restore type: Patients only, Visits only, or Both
  - Replace cascade-deletes related visits, prescriptions, certificates, lab requests, appointments
  - Backend: POST /api/restore endpoint with data isolation (owner_id)
  - "Backup Now" button on Dashboard header triggers JSON download of all patient and visit data
  - Non-dismissible red banner on Dashboard when last backup >3 days ago (or never)
  - Banner disappears only after a successful backup
  - Toast reminder on login if backup is overdue
  - Silent backup to localStorage every 5 minutes while logged in
  - Silent backup on tab switch and before browser close
  - Fixed export API response parsing (paginated response handling)
  - Files saved as `EMR_Backup_YYYY-MM-DD_HH-MM-SS.json`
  - Backend: GET /api/export/patients, GET /api/export/visits

