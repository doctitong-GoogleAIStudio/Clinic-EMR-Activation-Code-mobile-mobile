# Private Clinic EMR - Product Requirements Document

## Original Problem Statement
Build a secure Private Clinic EMR web app (mobile-responsive, printable) for Internal Medicine but generic for all medical specialties.

## User Personas
1. **Doctor** - Full access to all features including SOAP notes, prescriptions, certificates, AI assistance
2. **Receptionist** - Patient registration, scheduling, queue management, printing forms (cannot edit doctor notes)
3. **Admin** - User management, clinic settings, data exports, audit logs

## Core Requirements
- Login + role-based access control
- Patient registry with search (name, mobile, patient ID)
- Visit/consultation with SOAP notes and vitals
- Prescription, Medical Certificate, Fit-to-Work, Referral printing
- Calendar-based appointments + walk-in queue
- AI features (SOAP conversion, diagnosis suggestions, patient instructions)
- File attachments with tagging (Lab, X-ray, Ultrasound, ECG, Other)

## What's Been Implemented (Feb 24, 2026)

### Backend (FastAPI + MongoDB)
- ✅ User authentication with JWT tokens
- ✅ Role-based access control (Admin, Doctor, Receptionist)
- ✅ Patient CRUD with auto-generated patient IDs
- ✅ Visit/consultation management with SOAP notes
- ✅ Vitals capture with auto BMI calculation
- ✅ Appointment scheduling and queue management
- ✅ File attachments with base64 encoding
- ✅ Prescription and certificate storage
- ✅ Clinic settings management
- ✅ AI integration with OpenAI GPT-5.2 via Emergent LLM Key
- ✅ Audit logging for important actions
- ✅ Data export functionality (patients, visits)

### Frontend (React + Shadcn UI + Tailwind CSS)
- ✅ Login page with demo credentials display
- ✅ Dashboard with bento grid layout (queue, stats, appointments)
- ✅ Patient list with search functionality
- ✅ Patient profile with tabs (Info, Visits, Attachments)
- ✅ New patient registration form
- ✅ Visit form with vitals and SOAP notes
- ✅ AI assistance buttons (SOAP convert, diagnosis suggest, patient instructions)
- ✅ Visit detail page with print forms
- ✅ Prescription form with multiple medications
- ✅ Medical Certificate, Fit-to-Work, Referral forms
- ✅ Print templates with clinic header and doctor signature
- ✅ Appointments calendar with status management
- ✅ Settings page (Clinic, Users, Exports, Audit)
- ✅ Responsive sidebar navigation
- ✅ Mobile-first design

### Design System
- Theme: Organic & Earthy (Teal #0F766E + Orange accent #F97316)
- Typography: Manrope (headings), Public Sans (body), Merriweather (print)
- Components: Shadcn UI with custom styling

## Prioritized Backlog

### P0 - Critical (Completed)
- ✅ Authentication and authorization
- ✅ Patient management
- ✅ Visit/SOAP notes
- ✅ Queue management
- ✅ Print forms (Rx, MedCert)

### P1 - High Priority (Future)
- [ ] Lab/Radiology request forms
- [ ] Referral tracking
- [ ] SMS/Email appointment reminders
- [ ] Report generation (daily/weekly/monthly)
- [ ] Doctor schedule management

### P2 - Medium Priority (Future)
- [ ] Simple billing/invoicing
- [ ] Inventory management for medications
- [ ] Multi-clinic support
- [ ] Patient portal (view own records)
- [ ] ICD-10 code lookup integration

### P3 - Nice to Have (Future)
- [ ] Offline mode (PWA)
- [ ] Voice-to-text for SOAP notes
- [ ] Drug interaction checker
- [ ] HL7/FHIR integration
- [ ] Telemedicine video calls

## Next Action Items
1. Add doctor user with proper credentials (License, PTR, PRC numbers)
2. Configure clinic settings (name, address, logo for print forms)
3. Test AI features for SOAP note conversion
4. Set up regular database backups
5. Add more users based on clinic staff

## Technical Notes
- Backend: FastAPI on port 8001
- Frontend: React on port 3000
- Database: MongoDB
- AI: OpenAI GPT-5.2 via Emergent LLM Key
- Default admin: admin@clinic.com / admin123
