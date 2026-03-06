import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Book, Users, UserPlus, Search, Stethoscope, FileText, Pill, 
  Microscope, Printer, Edit, Shield, AlertTriangle, CheckCircle,
  ChevronDown, ChevronRight, Calendar, ClipboardList, Key, Save,
  Download, HelpCircle, RefreshCw, Clock, Lock
} from 'lucide-react';

const Section = ({ title, icon: Icon, children, defaultOpen = false, badge }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-[#0F766E]" />
          <span className="font-semibold text-slate-900">{title}</span>
          {badge && <Badge variant="outline" className="ml-2">{badge}</Badge>}
        </div>
        {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
      </button>
      {isOpen && (
        <div className="p-4 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

const Step = ({ number, children }) => (
  <div className="flex gap-3 mb-3">
    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-sm font-bold">
      {number}
    </div>
    <div className="text-slate-700 pt-0.5">{children}</div>
  </div>
);

const Tip = ({ children }) => (
  <div className="flex gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg my-3">
    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
    <div className="text-sm text-emerald-800">{children}</div>
  </div>
);

const Warning = ({ children }) => (
  <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg my-3">
    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
    <div className="text-sm text-amber-800">{children}</div>
  </div>
);

const Checklist = ({ items }) => (
  <ul className="space-y-2 my-3">
    {items.map((item, idx) => (
      <li key={idx} className="flex items-start gap-2">
        <CheckCircle className="w-4 h-4 text-[#0F766E] flex-shrink-0 mt-1" />
        <span className="text-slate-700">{item}</span>
      </li>
    ))}
  </ul>
);

const RoleBadge = ({ role }) => (
  <Badge className={role === 'Doctor' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}>
    {role}
  </Badge>
);

const UserGuide = () => {
  const [activeRole, setActiveRole] = useState('all');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Role Filter */}
      <div className="flex gap-2 mb-6 p-4 bg-slate-50 rounded-lg">
        <span className="text-sm text-slate-600 mr-2 pt-1">Show guide for:</span>
        <button
          onClick={() => setActiveRole('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            activeRole === 'all' ? 'bg-[#0F766E] text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Users
        </button>
        <button
          onClick={() => setActiveRole('doctor')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            activeRole === 'doctor' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
          }`}
        >
          Doctor
        </button>
        <button
          onClick={() => setActiveRole('receptionist')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            activeRole === 'receptionist' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
          }`}
        >
          Receptionist
        </button>
      </div>

      {/* 1. Login & Change Password */}
      <Section title="1. Login & Change Password" icon={Key} defaultOpen={true}>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <RoleBadge role="Doctor" /> <RoleBadge role="Receptionist" /> Logging In
            </h4>
            <Step number="1">Go to the ClinicEMR login page</Step>
            <Step number="2">Enter your registered <strong>Email Address</strong></Step>
            <Step number="3">Enter your <strong>Password</strong></Step>
            <Step number="4">Click <strong>"Sign In"</strong></Step>
            <Tip>Use the "eye" icon to show/hide your password while typing</Tip>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-2">Changing Your Password</h4>
            <Step number="1">After logging in, click <strong>Settings</strong> in the sidebar</Step>
            <Step number="2">Scroll to <strong>"Change Password"</strong> section</Step>
            <Step number="3">Enter your <strong>Current Password</strong></Step>
            <Step number="4">Enter your <strong>New Password</strong> (minimum 8 characters)</Step>
            <Step number="5">Re-enter to <strong>Confirm New Password</strong></Step>
            <Step number="6">Click <strong>"Change Password"</strong></Step>
            <Tip>Watch the password strength meter - aim for "Strong" or "Very Strong"</Tip>
            <Warning>After changing password, you'll need to log in again with your new password</Warning>
          </div>
        </div>
      </Section>

      {/* 2. Add New Patient & Appointments */}
      {(activeRole === 'all' || activeRole === 'doctor' || activeRole === 'receptionist') && (
        <Section title="2. Add New Patient & Make Appointments" icon={UserPlus}>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <RoleBadge role="Doctor" /> <RoleBadge role="Receptionist" /> Adding a New Patient
              </h4>
              <Step number="1">Click <strong>Patients</strong> in the sidebar</Step>
              <Step number="2">Click the <strong>"+ Add Patient"</strong> button</Step>
              <Step number="3">Fill in the required fields:</Step>
              <Checklist items={[
                'Full Name (required)',
                'Date of Birth (required)',
                'Gender (required)',
                'Phone Number',
                'Address',
                'Emergency Contact Name & Phone'
              ]} />
              <Step number="4">Click <strong>"Create Patient"</strong></Step>
              <Tip>You can add more details like blood type, allergies, and medical history later</Tip>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <RoleBadge role="Doctor" /> <RoleBadge role="Receptionist" /> Making an Appointment
              </h4>
              <Step number="1">Click <strong>Appointments</strong> in the sidebar</Step>
              <Step number="2">Click <strong>"+ New Appointment"</strong></Step>
              <Step number="3">Search and select the <strong>Patient</strong></Step>
              <Step number="4">Choose the <strong>Date</strong> on the calendar</Step>
              <Step number="5">Set the <strong>Time</strong></Step>
              <Step number="6">Enter the <strong>Reason for Visit</strong> (optional)</Step>
              <Step number="7">Add <strong>Vital Signs</strong> if pre-recorded (optional)</Step>
              <Step number="8">Click <strong>"Schedule Appointment"</strong></Step>
              <Tip>Pre-recording vitals saves time - they'll auto-fill when the doctor starts the visit</Tip>
            </div>
          </div>
        </Section>
      )}

      {/* 3. Search / Open Patient Record */}
      <Section title="3. Search & Open Patient Record" icon={Search}>
        <div>
          <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <RoleBadge role="Doctor" /> <RoleBadge role="Receptionist" />
          </h4>
          <Step number="1">Click <strong>Patients</strong> in the sidebar</Step>
          <Step number="2">Use the <strong>Search box</strong> at the top</Step>
          <Step number="3">Type the patient's <strong>name, phone, or ID</strong></Step>
          <Step number="4">Click on the patient row to open their profile</Step>
          <Tip>The search updates in real-time as you type - no need to press Enter</Tip>
          
          <h4 className="font-semibold text-slate-900 mb-2 mt-4">Patient Profile Tabs:</h4>
          <Checklist items={[
            'Overview - Basic info, allergies, medical history',
            'Visits - All consultation records',
            'Attachments - Lab results, imaging, documents',
            'Prescriptions - All prescriptions issued',
            'Appointments - Scheduled appointments'
          ]} />
        </div>
      </Section>

      {/* 4. Create New Visit/Consultation */}
      {(activeRole === 'all' || activeRole === 'doctor') && (
        <Section title="4. Create New Visit / Consultation (SOAP)" icon={Stethoscope} badge="Doctor Only">
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <RoleBadge role="Doctor" /> Starting a New Visit
            </h4>
            
            <p className="text-slate-700 mb-3"><strong>Option A: From Dashboard Queue</strong></p>
            <Step number="1">On Dashboard, find the patient in <strong>Today's Queue</strong></Step>
            <Step number="2">Click the <strong>Play button</strong> to start consultation</Step>
            <Step number="3">Click the <strong>Stethoscope icon</strong> to create visit</Step>

            <p className="text-slate-700 mb-3 mt-4"><strong>Option B: From Patient Profile</strong></p>
            <Step number="1">Open the patient's profile</Step>
            <Step number="2">Click <strong>"New Visit"</strong> button</Step>

            <h4 className="font-semibold text-slate-900 mb-2 mt-4">Filling the SOAP Notes:</h4>
            <Step number="1"><strong>Subjective (S)</strong> - Patient's complaints, symptoms, history</Step>
            <Step number="2"><strong>Objective (O)</strong> - Examination findings, vital signs</Step>
            <Step number="3"><strong>Assessment (A)</strong> - Diagnosis, clinical impression</Step>
            <Step number="4"><strong>Plan (P)</strong> - Treatment plan, medications, follow-up</Step>
            <Step number="5">Click <strong>"Save Visit"</strong></Step>

            <Tip>Use the <strong>AI Assistant</strong> to help generate SOAP notes from your clinical notes!</Tip>
            <Tip>If vitals were recorded during appointment scheduling, they'll be pre-filled automatically</Tip>
          </div>
        </Section>
      )}

      {/* 5. Add Diagnosis */}
      {(activeRole === 'all' || activeRole === 'doctor') && (
        <Section title="5. Add Diagnosis (ICD-10)" icon={ClipboardList} badge="Doctor Only">
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <RoleBadge role="Doctor" />
            </h4>
            <Step number="1">In the Visit form, find the <strong>Diagnosis</strong> section</Step>
            <Step number="2">Enter the <strong>Diagnosis description</strong></Step>
            <Step number="3">Add the <strong>ICD-10 Code</strong> (e.g., J06.9 for URTI)</Step>
            <Step number="4">The diagnosis will be saved with the visit record</Step>
            
            <Tip>Use the AI Assistant - it can suggest diagnoses with ICD-10 codes based on symptoms!</Tip>
            
            <h4 className="font-semibold text-slate-900 mb-2 mt-4">Common ICD-10 Codes:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-slate-50 rounded">J06.9 - Acute URTI</div>
              <div className="p-2 bg-slate-50 rounded">K30 - Dyspepsia</div>
              <div className="p-2 bg-slate-50 rounded">I10 - Hypertension</div>
              <div className="p-2 bg-slate-50 rounded">E11.9 - Type 2 Diabetes</div>
              <div className="p-2 bg-slate-50 rounded">M54.5 - Low back pain</div>
              <div className="p-2 bg-slate-50 rounded">R50.9 - Fever</div>
            </div>
          </div>
        </Section>
      )}

      {/* 6. Add Prescriptions */}
      {(activeRole === 'all' || activeRole === 'doctor') && (
        <Section title="6. Add Prescriptions" icon={Pill} badge="Doctor Only">
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <RoleBadge role="Doctor" />
            </h4>
            <Step number="1">In the Visit Detail page, go to <strong>Prescriptions</strong> tab</Step>
            <Step number="2">Click <strong>"+ Add Medication"</strong></Step>
            <Step number="3">Fill in medication details:</Step>
            <Checklist items={[
              'Drug Name (e.g., Amoxicillin 500mg)',
              'Dosage (e.g., 1 capsule)',
              'Frequency (e.g., 3 times a day)',
              'Duration (e.g., 7 days)',
              'Special Instructions (e.g., Take after meals)'
            ]} />
            <Step number="4">Add more medications if needed</Step>
            <Step number="5">Click <strong>"Save & Print Prescription"</strong></Step>
            
            <Tip>You can save the prescription first and print it later from "Saved Forms"</Tip>
            <Warning>Always verify patient allergies before prescribing medications</Warning>
          </div>
        </Section>
      )}

      {/* 7. Request Labs/Imaging */}
      {(activeRole === 'all' || activeRole === 'doctor') && (
        <Section title="7. Request Labs & Imaging" icon={Microscope} badge="Doctor Only">
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <RoleBadge role="Doctor" /> Creating a Lab/Imaging Request
            </h4>
            <Step number="1">In Visit Detail, go to <strong>Lab Request</strong> tab</Step>
            <Step number="2">Select <strong>Request Type</strong> (Laboratory or Imaging)</Step>
            <Step number="3">Check the tests needed:</Step>
            <div className="grid grid-cols-2 gap-2 text-sm my-2 ml-9">
              <div><strong>Lab:</strong> CBC, Urinalysis, FBS, Lipid Panel, etc.</div>
              <div><strong>Imaging:</strong> X-ray, Ultrasound, CT Scan, etc.</div>
            </div>
            <Step number="4">Add <strong>Clinical Information</strong> for the lab</Step>
            <Step number="5">Set <strong>Urgency</strong> (Routine, Urgent, STAT)</Step>
            <Step number="6">Click <strong>"Save & Print Request"</strong></Step>
            
            <h4 className="font-semibold text-slate-900 mb-2 mt-4">Recording Results:</h4>
            <Step number="1">Go to Patient Profile → <strong>Attachments</strong> tab</Step>
            <Step number="2">Click <strong>"Upload File"</strong></Step>
            <Step number="3">Select the lab result file (PDF, image, etc.)</Step>
            <Step number="4">Add a description (e.g., "CBC Results - Jan 2026")</Step>
          </div>
        </Section>
      )}

      {/* 8. Create and Print Forms */}
      {(activeRole === 'all' || activeRole === 'doctor') && (
        <Section title="8. Create & Print Forms" icon={Printer} badge="Doctor Only">
          <div>
            <h4 className="font-semibold text-slate-900 mb-2">Available Print Forms:</h4>
            
            <div className="space-y-4">
              <div className="p-3 border border-slate-200 rounded-lg">
                <h5 className="font-medium text-slate-900 mb-2">Prescription (Rx)</h5>
                <Step number="1">Add medications in the Prescriptions tab</Step>
                <Step number="2">Click <strong>"Save & Print"</strong></Step>
                <Step number="3">The prescription opens in print preview</Step>
              </div>

              <div className="p-3 border border-slate-200 rounded-lg">
                <h5 className="font-medium text-slate-900 mb-2">Medical Certificate</h5>
                <Step number="1">Go to <strong>Certificates</strong> tab</Step>
                <Step number="2">Select <strong>"Medical Certificate"</strong></Step>
                <Step number="3">Enter diagnosis and rest days recommended</Step>
                <Step number="4">Click <strong>"Save & Print"</strong></Step>
              </div>

              <div className="p-3 border border-slate-200 rounded-lg">
                <h5 className="font-medium text-slate-900 mb-2">Fit-to-Work Certificate</h5>
                <Step number="1">Go to <strong>Certificates</strong> tab</Step>
                <Step number="2">Select <strong>"Fit to Work"</strong></Step>
                <Step number="3">Add any remarks</Step>
                <Step number="4">Click <strong>"Save & Print"</strong></Step>
              </div>

              <div className="p-3 border border-slate-200 rounded-lg">
                <h5 className="font-medium text-slate-900 mb-2">Referral Form</h5>
                <Step number="1">Go to <strong>Certificates</strong> tab</Step>
                <Step number="2">Select <strong>"Referral"</strong></Step>
                <Step number="3">Enter specialist name and reason for referral</Step>
                <Step number="4">Click <strong>"Save & Print"</strong></Step>
              </div>
            </div>

            <Tip>All saved forms can be reprinted from the <strong>"Saved Forms"</strong> section at the bottom of Visit Details</Tip>
            <Tip>Customize your print header (logo, clinic name) in Settings → Print Header Customization</Tip>
          </div>
        </Section>
      )}

      {/* 9. Edit / Correct Entry */}
      {(activeRole === 'all' || activeRole === 'doctor') && (
        <Section title="9. Edit / Correct an Entry" icon={Edit}>
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <RoleBadge role="Doctor" /> <RoleBadge role="Receptionist" />
            </h4>
            
            <div className="mb-4">
              <h5 className="font-medium text-slate-900 mb-2">Editing Patient Information:</h5>
              <Step number="1">Open the patient's profile</Step>
              <Step number="2">Click the <strong>Edit (pencil)</strong> icon</Step>
              <Step number="3">Make your changes</Step>
              <Step number="4">Click <strong>"Save Changes"</strong></Step>
            </div>

            <div className="mb-4">
              <h5 className="font-medium text-slate-900 mb-2">Editing Visit Notes:</h5>
              <Step number="1">Go to Patient Profile → Visits tab</Step>
              <Step number="2">Click on the visit to view details</Step>
              <Step number="3">Click <strong>"Edit Visit"</strong></Step>
              <Step number="4">Update the SOAP notes or other information</Step>
              <Step number="5">Click <strong>"Save Changes"</strong></Step>
            </div>

            <Warning>Visit records are audit-logged. Any changes are tracked for medical-legal purposes.</Warning>
            <Tip>Never delete patient history - always edit/correct instead to maintain medical records integrity</Tip>
          </div>
        </Section>
      )}

      {/* 10. Data Safety */}
      <Section title="10. Data Safety & Backups" icon={Shield}>
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Keeping Your Data Safe</h4>
          
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <h5 className="font-medium text-emerald-800 mb-2 flex items-center gap-2">
                <Save className="w-4 h-4" /> Auto-Save
              </h5>
              <p className="text-sm text-emerald-700">Your data is automatically saved when you click any Save button. There's no auto-save while typing - always click Save before leaving a page.</p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                <Download className="w-4 h-4" /> Regular Backups
              </h5>
              <p className="text-sm text-blue-700 mb-2">Export your data regularly from Settings → Exports:</p>
              <Checklist items={[
                'Export Patient Registry (JSON or CSV)',
                'Export Visit Records (JSON or CSV)',
                'Store backups in a safe location'
              ]} />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <h5 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> How NOT to Lose Data
              </h5>
              <Checklist items={[
                'Always click Save before closing a form',
                'Don\'t close the browser while uploading files',
                'Export your data at least weekly',
                'Keep your password secure',
                'Don\'t share your account with others'
              ]} />
            </div>
          </div>
        </div>
      </Section>

      {/* Troubleshooting */}
      <Section title="Troubleshooting" icon={HelpCircle}>
        <div className="space-y-4">
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <h5 className="font-medium text-red-800 mb-2">Printing Issues</h5>
            <Checklist items={[
              'Make sure your printer is connected and turned on',
              'Try using Chrome or Edge browser for best printing',
              'If print preview is blank, refresh the page and try again',
              'Check if pop-ups are blocked - allow pop-ups for this site',
              'For PDF issues, try "Print to PDF" and open the file'
            ]} />
          </div>

          <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
            <h5 className="font-medium text-amber-800 mb-2">Can't Find a Patient</h5>
            <Checklist items={[
              'Check if you spelled the name correctly',
              'Try searching by phone number instead',
              'The patient might be registered under a different doctor',
              'Make sure you\'re logged into the correct account'
            ]} />
          </div>

          <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <h5 className="font-medium text-blue-800 mb-2">Wrong Date on Appointments</h5>
            <Checklist items={[
              'Check your computer\'s date and time settings',
              'Make sure your timezone is set correctly',
              'Appointments are based on your local time, not server time',
              'You can edit appointments to change the date'
            ]} />
          </div>

          <div className="p-4 border border-purple-200 bg-purple-50 rounded-lg">
            <h5 className="font-medium text-purple-800 mb-2">Password Reset</h5>
            <Checklist items={[
              'Go to Settings → Change Password',
              'If locked out (too many failed attempts), wait 10 minutes',
              'Contact your admin if you forgot your password completely',
              'Admins can reset receptionist passwords from Settings'
            ]} />
          </div>

          <div className="p-4 border border-slate-200 bg-slate-50 rounded-lg">
            <h5 className="font-medium text-slate-800 mb-2">General Tips</h5>
            <Checklist items={[
              'Refresh the page (Ctrl+R or Cmd+R) if something seems stuck',
              'Clear browser cache if you see old data',
              'Use a modern browser (Chrome, Edge, Firefox)',
              'Check your internet connection',
              'Contact support if issues persist'
            ]} />
          </div>
        </div>
      </Section>

      {/* Quick Reference */}
      <Card className="bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white mt-6">
        <CardContent className="p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" /> Quick Reference
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2 text-emerald-200">Keyboard Shortcuts</h4>
              <ul className="space-y-1 text-emerald-100">
                <li>Ctrl+S / Cmd+S - Save (in some forms)</li>
                <li>Ctrl+P / Cmd+P - Print</li>
                <li>Ctrl+F / Cmd+F - Find on page</li>
                <li>Tab - Move to next field</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-emerald-200">Support Contact</h4>
              <ul className="space-y-1 text-emerald-100">
                <li>For technical issues, contact your system admin</li>
                <li>For account issues, speak with your supervisor</li>
                <li>Always include screenshots when reporting bugs</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserGuide;
