# Test Credentials

## EMR Application
- **Doctor/Admin**: doctitong@yahoo.com / admin123
- NOTE: EMR accounts live in the DB; the preview DB may not contain the account above.
  For testing, register a fresh doctor via POST /api/auth/register or the /signup page.

## Self-Service Trial (device-bound)
- No fixed credentials. A fresh browser context (new device fingerprint) is trial-eligible.
- Trial sign-up asks for Full Name + Email + Password and starts a 7-day trial.
- Trial sign-up is SEPARATE from EMR login. After the trial unlocks the app, the user
  still logs in / signs up for an EMR doctor account.
- One trial per device: an expired-trial device gets HTTP 403 from /api/license/start-trial
  and must enter an activation code.

## License System (Super Admin)
- **Super Admin**: superadmin@ddhapps.com / DDH_SuperAdmin_2026!
- **Admin Portal URL**: /license-admin/login

## License Admin Routes (bypass activation/trial gate)
- /license-admin/login — Super admin login
- /license-admin — License management dashboard
