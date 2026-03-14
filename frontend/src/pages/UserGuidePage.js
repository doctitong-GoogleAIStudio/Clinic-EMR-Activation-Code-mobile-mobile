import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { 
  BookOpen, User, UserCog, CheckCircle, AlertTriangle, Lightbulb, 
  LogIn, Users, Calendar, FileText, Stethoscope, Pill, Microscope, 
  Printer, Edit, Database, HelpCircle, Search, Clock, Shield,
  ChevronRight, ChevronDown, Phone, Mail, UserPlus, Download, RotateCcw, Mic
} from 'lucide-react';

const UserGuidePage = () => {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const SectionHeader = ({ id, icon: Icon, title, children }) => (
    <div className="border rounded-lg mb-4 overflow-hidden">
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-[#0F766E]" />
          <span className="font-semibold text-slate-900">{title}</span>
        </div>
        {expandedSections[id] ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {expandedSections[id] && (
        <div className="p-4 bg-white border-t">
          {children}
        </div>
      )}
    </div>
  );

  const Step = ({ number, children }) => (
    <div className="flex gap-3 mb-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0F766E] text-white text-sm flex items-center justify-center font-medium">
        {number}
      </div>
      <div className="text-slate-700 pt-0.5">{children}</div>
    </div>
  );

  const Tip = ({ children }) => (
    <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-3 mb-3">
      <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-amber-800">{children}</div>
    </div>
  );

  const Warning = ({ children }) => (
    <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mt-3 mb-3">
      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-red-800">{children}</div>
    </div>
  );

  const Checklist = ({ items }) => (
    <ul className="space-y-2 mt-2">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <span className="text-slate-700 text-sm">{item}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-[#0F766E]/10">
          <BookOpen className="w-8 h-8 text-[#0F766E]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Guide</h1>
          <p className="text-slate-500">Step-by-step instructions for Private ClinicEMR</p>
        </div>
      </div>

      {/* Role Selection Tabs */}
      <Tabs defaultValue="doctor" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="doctor" className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            Doctor's Guide
          </TabsTrigger>
          <TabsTrigger value="receptionist" className="flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            Receptionist's Guide
          </TabsTrigger>
        </TabsList>

        {/* ============ DOCTOR GUIDE ============ */}
        <TabsContent value="doctor">
          <Card className="bg-gradient-to-r from-[#0F766E]/5 to-transparent border-[#0F766E]/20 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Stethoscope className="w-6 h-6 text-[#0F766E]" />
                <h2 className="text-lg font-semibold text-slate-900">Doctor's User Guide</h2>
              </div>
              <p className="text-slate-600 text-sm">
                As a doctor, you have full access to patient records, consultations, prescriptions, 
                certificates, and clinic settings. This guide covers all essential workflows.
              </p>
            </CardContent>
          </Card>

          {/* 1. Login & Change Password */}
          <SectionHeader id="doc-login" icon={LogIn} title="1. Login & Change Password">
            <h4 className="font-medium text-slate-900 mb-3">Logging In</h4>
            <Step number="1">Go to the login page at your clinic's EMR URL</Step>
            <Step number="2">Enter your registered <strong>Email</strong> address</Step>
            <Step number="3">Enter your <strong>Password</strong></Step>
            <Step number="4">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Sign In</Badge></Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Changing Your Password</h4>
            <Step number="1">Click <strong>Settings</strong> in the left sidebar</Step>
            <Step number="2">Scroll down to <strong>Change Password</strong> section</Step>
            <Step number="3">Enter your <strong>Current Password</strong></Step>
            <Step number="4">Enter your <strong>New Password</strong> (minimum 8 characters)</Step>
            <Step number="5">Re-enter the new password in <strong>Confirm New Password</strong></Step>
            <Step number="6">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Change Password</Badge></Step>
            
            <Tip>
              <strong>Quick Tip:</strong> Use the eye icon to show/hide passwords. The password strength meter 
              shows how secure your password is (aim for "Strong" or "Very Strong").
            </Tip>
            
            <Warning>
              After changing your password, you'll need to log in again with the new password. 
              After 5 failed attempts, your account will be locked for 10 minutes.
            </Warning>
          </SectionHeader>

          {/* 2. Add New Patient */}
          <SectionHeader id="doc-patient" icon={Users} title="2. Add New Patient & Make Appointments">
            <h4 className="font-medium text-slate-900 mb-3">Adding a New Patient</h4>
            <Step number="1">Click <strong>Patients</strong> in the left sidebar</Step>
            <Step number="2">Click the <Badge variant="outline" className="bg-[#0F766E] text-white">+ New Patient</Badge> button</Step>
            <Step number="3">Fill in the required fields:</Step>
            <Checklist items={[
              "Full Name (required)",
              "Date of Birth (required)",
              "Gender (required)",
              "Contact Number",
              "Email Address",
              "Address",
              "Emergency Contact Name & Number",
              "Allergies (important for safety)",
              "Medical History notes"
            ]} />
            <Step number="4">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Create Patient</Badge></Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Making an Appointment</h4>
            <Step number="1">Go to <strong>Appointments</strong> in the sidebar</Step>
            <Step number="2">Click <Badge variant="outline" className="bg-[#0F766E] text-white">+ New Appointment</Badge></Step>
            <Step number="3">Search and select the patient</Step>
            <Step number="4">Select the date from the calendar</Step>
            <Step number="5">Enter the appointment time</Step>
            <Step number="6">Enter the reason for visit</Step>
            <Step number="7">(Optional) Enter vital signs if available</Step>
            <Step number="8">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Schedule Appointment</Badge></Step>
            
            <Tip>
              <strong>Quick Tip:</strong> You can also schedule appointments directly from a patient's profile 
              by clicking "Schedule Appointment" in their record.
            </Tip>
          </SectionHeader>

          {/* 3. Search Patient */}
          <SectionHeader id="doc-search" icon={Search} title="3. Search / Open Patient Record">
            <h4 className="font-medium text-slate-900 mb-3">Finding a Patient</h4>
            <Step number="1">Go to <strong>Patients</strong> in the sidebar</Step>
            <Step number="2">Use the search box at the top</Step>
            <Step number="3">Type the patient's name, phone number, or email</Step>
            <Step number="4">Click on the patient row to open their profile</Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Patient Profile Sections</h4>
            <Checklist items={[
              "Overview - Basic info, allergies, contact details",
              "Visits - History of all consultations",
              "Prescriptions - All medications prescribed",
              "Labs & Imaging - Test results and uploaded files",
              "Certificates - Medical certificates issued"
            ]} />
            
            <Tip>
              <strong>Quick Tip:</strong> From the Dashboard, you can click on any patient name in 
              Today's Queue to quickly open their record.
            </Tip>
          </SectionHeader>

          {/* 4. Create New Visit */}
          <SectionHeader id="doc-visit" icon={FileText} title="4. Create New Visit/Consultation (SOAP)">
            <h4 className="font-medium text-slate-900 mb-3">Starting a New Visit</h4>
            <Step number="1">Open the patient's profile</Step>
            <Step number="2">Click <Badge variant="outline" className="bg-[#0F766E] text-white">New Visit</Badge></Step>
            <Step number="3">Or from Dashboard, click the stethoscope icon on a queued appointment</Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Documenting in SOAP Format</h4>
            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <p className="font-medium text-slate-900 mb-2">S - Subjective</p>
              <p className="text-sm text-slate-600 mb-3">What the patient tells you: chief complaint, symptoms, history</p>
              
              <p className="font-medium text-slate-900 mb-2">O - Objective</p>
              <p className="text-sm text-slate-600 mb-3">What you observe: vital signs, physical exam findings, test results</p>
              
              <p className="font-medium text-slate-900 mb-2">A - Assessment</p>
              <p className="text-sm text-slate-600 mb-3">Your diagnosis or differential diagnoses</p>
              
              <p className="font-medium text-slate-900 mb-2">P - Plan</p>
              <p className="text-sm text-slate-600">Treatment plan: medications, tests ordered, follow-up instructions</p>
            </div>
            
            <Step number="4">Fill in each SOAP section</Step>
            <Step number="5">Use <Badge variant="outline" className="bg-purple-100 text-purple-700">AI Assist</Badge> to help generate SOAP notes</Step>
            <Step number="6">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Save Visit</Badge></Step>
            
            <Tip>
              <strong>AI Feature:</strong> Click "AI Consultation" to get AI-assisted SOAP notes, 
              diagnosis suggestions, and medication recommendations based on your clinical notes.
            </Tip>
          </SectionHeader>

          {/* 5. Add Diagnosis */}
          <SectionHeader id="doc-diagnosis" icon={Stethoscope} title="5. Add Diagnosis (ICD-10)">
            <h4 className="font-medium text-slate-900 mb-3">Adding Diagnoses</h4>
            <Step number="1">In the New Visit page, scroll to the <strong>Diagnoses</strong> section</Step>
            <Step number="2">Type the diagnosis in the search field</Step>
            <Step number="3">Select from ICD-10 suggestions if available</Step>
            <Step number="4">Click <strong>Add</strong> to include the diagnosis</Step>
            <Step number="5">Add multiple diagnoses if needed (primary first)</Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Using AI for Diagnosis Suggestions</h4>
            <Step number="1">Click <Badge variant="outline" className="bg-purple-100 text-purple-700">AI Consultation</Badge></Step>
            <Step number="2">Enter your clinical notes</Step>
            <Step number="3">Click <strong>Generate Suggestions</strong></Step>
            <Step number="4">Review AI-suggested diagnoses with ICD-10 codes</Step>
            <Step number="5">Click <strong>Apply</strong> to add to the visit record</Step>
            
            <Warning>
              AI suggestions are for assistance only. Always verify diagnoses based on your 
              clinical judgment and examination findings.
            </Warning>
          </SectionHeader>

          {/* 6. Add Prescriptions */}
          <SectionHeader id="doc-rx" icon={Pill} title="6. Add Prescriptions">
            <h4 className="font-medium text-slate-900 mb-3">Creating a Prescription</h4>
            <Step number="1">In the Visit Detail page, click <Badge variant="outline" className="bg-[#0F766E] text-white">New Prescription</Badge></Step>
            <Step number="2">For each medication, enter:</Step>
            <Checklist items={[
              "Drug Name",
              "Dosage (e.g., 500mg)",
              "Frequency (e.g., Every 8 hours)",
              "Duration (e.g., 7 days)",
              "Route (e.g., Oral, IV)",
              "Instructions (e.g., Take with food)"
            ]} />
            <Step number="3">Click <strong>+ Add Medication</strong> for additional drugs</Step>
            <Step number="4">Add general prescription notes if needed</Step>
            <Step number="5">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Save & Print</Badge></Step>
            
            <Tip>
              <strong>Quick Tip:</strong> The prescription will be automatically linked to this visit 
              and appear in the patient's prescription history.
            </Tip>
          </SectionHeader>

          {/* 7. Labs/Imaging */}
          <SectionHeader id="doc-labs" icon={Microscope} title="7. Request Labs/Imaging & Record Results">
            <h4 className="font-medium text-slate-900 mb-3">Requesting Laboratory Tests</h4>
            <Step number="1">In Visit Detail, click <Badge variant="outline" className="bg-[#0F766E] text-white">New Lab Request</Badge></Step>
            <Step number="2">Select <strong>Laboratory</strong> or <strong>Imaging</strong> type</Step>
            <Step number="3">Check the tests you want to order</Step>
            <Step number="4">Select urgency: Routine, Urgent, or STAT</Step>
            <Step number="5">Add clinical information for the lab</Step>
            <Step number="6">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Save & Print</Badge></Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Recording Results</h4>
            <Step number="1">Go to patient's <strong>Labs & Imaging</strong> tab</Step>
            <Step number="2">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Upload Results</Badge></Step>
            <Step number="3">Select the file (PDF, image, or document)</Step>
            <Step number="4">Add a description or notes</Step>
            <Step number="5">Link to the relevant visit if applicable</Step>
          </SectionHeader>

          {/* 8. Print Forms */}
          <SectionHeader id="doc-print" icon={Printer} title="8. Create and Print Forms">
            <h4 className="font-medium text-slate-900 mb-3">Available Print Forms</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">Prescription (Rx)</p>
                <p className="text-sm text-slate-600">Medication orders with dosage and instructions</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">Medical Certificate</p>
                <p className="text-sm text-slate-600">Sick leave or medical fitness documentation</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">Fit-to-Work Certificate</p>
                <p className="text-sm text-slate-600">Clearance to return to work</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">Referral Letter</p>
                <p className="text-sm text-slate-600">Referral to specialist or facility</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">Lab/Imaging Request</p>
                <p className="text-sm text-slate-600">Laboratory or imaging test orders</p>
              </div>
            </div>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Printing Steps</h4>
            <Step number="1">Create the form (prescription, certificate, etc.)</Step>
            <Step number="2">Click the <strong>Print</strong> button</Step>
            <Step number="3">A print preview will open</Step>
            <Step number="4">Select your printer and click Print</Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Reprinting Saved Forms</h4>
            <Step number="1">Go to the Visit Detail page</Step>
            <Step number="2">Find the form under <strong>Saved Forms</strong> section</Step>
            <Step number="3">Click the print icon to reprint</Step>
            
            <Tip>
              <strong>Customize Header:</strong> Go to Settings → Print Header Customization to add your 
              clinic logo, tagline, and custom text to all printed forms.
            </Tip>
          </SectionHeader>

          {/* 9. Edit Entry */}
          <SectionHeader id="doc-edit" icon={Edit} title="9. Edit / Correct an Entry">
            <h4 className="font-medium text-slate-900 mb-3">Editing Patient Information</h4>
            <Step number="1">Open the patient's profile</Step>
            <Step number="2">Click <Badge variant="outline">Edit</Badge> button</Step>
            <Step number="3">Make your changes</Step>
            <Step number="4">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Save Changes</Badge></Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Correcting Visit Notes</h4>
            <Step number="1">Go to the Visit Detail page</Step>
            <Step number="2">Click <Badge variant="outline">Edit Visit</Badge></Step>
            <Step number="3">Update the SOAP notes or other fields</Step>
            <Step number="4">Add an amendment note explaining the correction</Step>
            <Step number="5">Save the changes</Step>
            
            <Warning>
              <strong>Important:</strong> All changes are logged in the audit trail. Never delete 
              patient records - always add corrections as amendments to maintain medical-legal integrity.
            </Warning>
          </SectionHeader>

          {/* 10. Data Safety */}
          <SectionHeader id="doc-data" icon={Database} title="10. Data Safety & Backups">
            <h4 className="font-medium text-slate-900 mb-3">Autosave Features</h4>
            <Checklist items={[
              "Visit notes are saved when you click Save",
              "Patient information updates immediately",
              "Prescriptions and certificates are saved upon creation",
              "AI consultation drafts can be saved for later"
            ]} />
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Exporting Data</h4>
            <Step number="1">Go to <strong>Settings</strong></Step>
            <Step number="2">Scroll to <strong>Data Management</strong></Step>
            <Step number="3">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Export Patients</Badge> for CSV export</Step>
            <Step number="4">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Export Visits</Badge> for consultation records</Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Best Practices</h4>
            <Checklist items={[
              "Save your work frequently",
              "Export patient data regularly (weekly/monthly)",
              "Keep your password secure and change it periodically",
              "Log out when leaving your workstation",
              "Report any system issues immediately"
            ]} />
            
            <Tip>
              <strong>Data Protection:</strong> All data is stored securely. Your patients' data is 
              isolated and only visible to you and your authorized receptionists.
            </Tip>
          </SectionHeader>

          {/* 11. Manage Receptionists */}
          <SectionHeader id="doc-receptionist" icon={UserPlus} title="11. Create & Manage Receptionists">
            <h4 className="font-medium text-slate-900 mb-3">Creating a Receptionist Account</h4>
            <Step number="1">Click <strong>Settings</strong> in the left sidebar</Step>
            <Step number="2">Scroll down to <strong>Create Receptionist Account</strong> section</Step>
            <Step number="3">Fill in the required fields:</Step>
            <Checklist items={[
              "Full Name - The receptionist's complete name",
              "Email - Their login email address",
              "Password - A temporary password they can change later"
            ]} />
            <Step number="4">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Create Receptionist</Badge></Step>
            
            <Tip>
              <strong>Quick Tip:</strong> Receptionists you create are automatically linked to your account. 
              They can only see and manage your patients and appointments.
            </Tip>

            <h4 className="font-medium text-slate-900 mt-6 mb-3">Viewing Your Receptionists</h4>
            <p className="text-slate-600 text-sm mb-3">
              After creating receptionists, they will appear in a list under "My Receptionists" in the same section.
            </p>

            <h4 className="font-medium text-slate-900 mt-6 mb-3">Editing a Receptionist Account</h4>
            <Step number="1">Go to <strong>Settings</strong></Step>
            <Step number="2">Find the receptionist in <strong>My Receptionists</strong> list</Step>
            <Step number="3">Click the <strong>Edit</strong> (pencil) button</Step>
            <Step number="4">Update any of the following:</Step>
            <Checklist items={[
              "Full Name - Change their display name",
              "Email - Update their login email",
              "Password - Set a new password (leave blank to keep current)"
            ]} />
            <Step number="5">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Save Changes</Badge></Step>

            <h4 className="font-medium text-slate-900 mt-6 mb-3">Deleting a Receptionist Account</h4>
            <Step number="1">Go to <strong>Settings</strong></Step>
            <Step number="2">Find the receptionist in <strong>My Receptionists</strong> list</Step>
            <Step number="3">Click the <strong>Delete</strong> (trash) button</Step>
            <Step number="4">Confirm the deletion when prompted</Step>
            
            <Warning>
              <strong>Important:</strong> Deleting a receptionist account is permanent and cannot be undone. 
              The receptionist will immediately lose access to the system.
            </Warning>
          </SectionHeader>

          {/* 12. Print Settings */}
          <SectionHeader id="doc-print-settings" icon={Printer} title="12. Print Settings">
            <h4 className="font-medium text-slate-900 mb-3">Accessing Print Settings</h4>
            <Step number="1">Click <strong>Settings</strong> in the left sidebar</Step>
            <Step number="2">Click the <strong>Print Settings</strong> tab</Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Form Types</h4>
            <p className="text-slate-600 text-sm mb-3">
              You can customize print settings for each form type independently:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-slate-900">Prescription</p>
                <p className="text-xs text-slate-600">Default: 8 × 4 inches</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="font-medium text-slate-900">Medical Certificate</p>
                <p className="text-xs text-slate-600">Default: Letter (8.5 × 11 in)</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-medium text-slate-900">Fit-to-Work</p>
                <p className="text-xs text-slate-600">Default: Letter (8.5 × 11 in)</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="font-medium text-slate-900">Referral Letter</p>
                <p className="text-xs text-slate-600">Default: Letter (8.5 × 11 in)</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                <p className="font-medium text-slate-900">Lab/Imaging Request</p>
                <p className="text-xs text-slate-600">Default: Letter (8.5 × 11 in)</p>
              </div>
            </div>

            <h4 className="font-medium text-slate-900 mt-6 mb-3">Available Settings</h4>
            <Checklist items={[
              "Paper Size - Choose preset sizes or set custom dimensions",
              "Layout - Adjust top, bottom, left, right offsets and content width",
              "Sections - Show/hide header, patient info, signature, footer, date, etc.",
              "Typography - Set font size, line spacing, and section spacing"
            ]} />

            <h4 className="font-medium text-slate-900 mt-6 mb-3">Configuring Print Settings</h4>
            <Step number="1">Select a form type (Prescription, Certificate, etc.)</Step>
            <Step number="2">Adjust Paper, Layout, Sections, or Text settings</Step>
            <Step number="3">Preview changes in real-time on the right panel</Step>
            <Step number="4">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Save Settings</Badge></Step>

            <h4 className="font-medium text-slate-900 mt-6 mb-3">Export & Import Settings</h4>
            <Step number="1">Click <Badge variant="outline">Export All</Badge> to download all print settings as a JSON file</Step>
            <Step number="2">Click <Badge variant="outline">Import</Badge> to load settings from a previously exported file</Step>
            
            <Tip>
              <strong>Copy Settings:</strong> Use the "Copy Settings To" buttons to quickly apply the same 
              settings from one form type to another.
            </Tip>

            <h4 className="font-medium text-slate-900 mt-6 mb-3">Print Preview Dialog</h4>
            <p className="text-slate-600 text-sm mb-3">
              When printing any form from the Visit Details page, a preview dialog will appear showing:
            </p>
            <Checklist items={[
              "Live preview of the form with your saved settings",
              "Settings tab to adjust paper size and visibility options",
              "Paper size reminder to help you select the correct size in the browser print dialog"
            ]} />

            <Warning>
              <strong>Browser Print Dialog:</strong> After clicking "Print", you may need to select the correct 
              paper size in your browser's print dialog. Look for "More settings" → "Paper size" and choose the 
              matching size or "Custom".
            </Warning>
          </SectionHeader>

          {/* 13. Data Backup */}
          <SectionHeader id="doc-backup" icon={Download} title="13. Data Backup">
            <h4 className="font-medium text-slate-900 mb-3">Backing Up Your Data</h4>
            <Step number="1">On the Dashboard, click the <strong>Backup</strong> button (green outline) in the top-right</Step>
            <Step number="2">A JSON file will download containing all your patients and visit records</Step>
            <Step number="3">The file is named <code>EMR_Backup_YYYY-MM-DD_HH-MM-SS.json</code></Step>
            <Tips items={[
              "If you haven't backed up in 3+ days, a red warning banner appears on the Dashboard",
              "The banner disappears only after you complete a backup",
              "A toast reminder also appears on login when your backup is overdue",
              "Keep backup files in a safe location (cloud drive, USB, etc.)"
            ]} />
            <Warning>
              <strong>Back up regularly!</strong> Your patient data is critical. Make it a habit to back up at least weekly.
            </Warning>
          </SectionHeader>

          {/* 14. Restore Backup */}
          <SectionHeader id="doc-restore" icon={RotateCcw} title="14. Restore Backup">
            <h4 className="font-medium text-slate-900 mb-3">Restoring from a Backup File</h4>
            <Step number="1">Click the <strong>Restore</strong> button on the Dashboard, or go to Settings → Imports → Restore from Backup File</Step>
            <Step number="2">Select your backup JSON file</Step>
            <Step number="3">Review the file preview (patient and visit counts)</Step>
            <Step number="4">Choose what to restore: <strong>Patients only</strong>, <strong>Visits only</strong>, or <strong>Both</strong></Step>
            <Step number="5">Choose a mode:</Step>
            <Tips items={[
              "Merge — adds new records, skips duplicates (safe, no data loss)",
              "Replace — deletes ALL existing data first, then imports from backup (use with caution!)"
            ]} />
            <Warning>
              <strong>Replace mode is destructive!</strong> It permanently deletes your existing patients, visits, prescriptions, and certificates before importing. Always create a fresh backup before using Replace.
            </Warning>
          </SectionHeader>

          {/* 15. AI Doctor Dictation */}
          <SectionHeader id="doc-dictation" icon={Mic} title="15. AI Doctor Dictation">
            <h4 className="font-medium text-slate-900 mb-3">Using Voice Dictation</h4>
            <Step number="1">Open a patient's profile and click the <strong>AI Dictation</strong> button (purple mic icon)</Step>
            <Step number="2">The AI Consultation page opens with a 3-column layout: Patient Info | SOAP Editor | Dictation Panel</Step>
            <Step number="3">Select a dictation mode (Full Consultation, Subjective, Objective, Assessment, Plan, Prescription, Orders, or Instructions)</Step>
            <Step number="4">Click the red microphone button to start recording</Step>
            <Step number="5">Speak your clinical notes. You can Pause/Resume as needed</Step>
            <Step number="6">Click Stop — the system will transcribe (Whisper) then structure (AI) your dictation</Step>
            <Step number="7">Review the AI-generated SOAP, prescriptions, orders, and instructions</Step>
            <Step number="8">Click <strong>Insert</strong> buttons to add content to the chart (with Append/Replace options)</Step>
            <Step number="9">Edit any field as needed, then click <strong>Save Visit</strong></Step>

            <h4 className="font-medium text-slate-900 mt-6 mb-3">Demo Mode</h4>
            <Step number="1">Toggle <strong>Demo Mode</strong> on in the dictation panel</Step>
            <Step number="2">Select a sample dictation (e.g., Respiratory Infection, Hypertension, etc.)</Step>
            <Step number="3">The AI will process the sample text and show structured output — no microphone needed!</Step>
            <Tips items={[
              "The AI preserves important negatives (e.g., 'no chest pain')",
              "Uncertain medications are flagged with review warnings",
              "ICD-10 suggestions are for reference only — never auto-finalized",
              "Demo Mode is great for training and demonstrations",
              "All dictation sessions are tracked with a full audit trail"
            ]} />
            <Warning>
              <strong>Always review AI output before saving.</strong> The AI assists documentation but the physician must verify and approve all clinical content.
            </Warning>
          </SectionHeader>
        </TabsContent>

        {/* ============ RECEPTIONIST GUIDE ============ */}
        <TabsContent value="receptionist">
          <Card className="bg-gradient-to-r from-blue-50 to-transparent border-blue-200 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <UserCog className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-900">Receptionist's User Guide</h2>
              </div>
              <p className="text-slate-600 text-sm">
                As a receptionist, you can register patients, manage appointments, and record vital signs. 
                You work under a specific doctor and can only see their patients.
              </p>
            </CardContent>
          </Card>

          {/* 1. Login */}
          <SectionHeader id="rec-login" icon={LogIn} title="1. Login & Your Account">
            <h4 className="font-medium text-slate-900 mb-3">Logging In</h4>
            <Step number="1">Go to the clinic's EMR login page</Step>
            <Step number="2">Enter the email address your doctor gave you</Step>
            <Step number="3">Enter your password</Step>
            <Step number="4">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Sign In</Badge></Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Your Access Level</h4>
            <Checklist items={[
              "View and register patients for your doctor",
              "Schedule and manage appointments",
              "Record vital signs during check-in",
              "View patient basic information",
              "Cannot create prescriptions or certificates (doctor only)",
              "Cannot access other doctors' patients"
            ]} />
            
            <Tip>
              <strong>Password Issues:</strong> If you forgot your password, ask your doctor to reset it 
              from their Settings page under "My Receptionists."
            </Tip>
          </SectionHeader>

          {/* 2. Register Patients */}
          <SectionHeader id="rec-patient" icon={Users} title="2. Register New Patients">
            <h4 className="font-medium text-slate-900 mb-3">Adding a New Patient</h4>
            <Step number="1">Click <strong>Patients</strong> in the sidebar</Step>
            <Step number="2">Click <Badge variant="outline" className="bg-[#0F766E] text-white">+ New Patient</Badge></Step>
            <Step number="3">Fill in the patient information:</Step>
            
            <div className="bg-slate-50 p-4 rounded-lg my-4">
              <p className="font-medium text-red-600 mb-2">Required Fields:</p>
              <Checklist items={[
                "Full Name",
                "Date of Birth",
                "Gender"
              ]} />
              <p className="font-medium text-slate-700 mt-4 mb-2">Recommended Fields:</p>
              <Checklist items={[
                "Contact Number (for appointment reminders)",
                "Address",
                "Emergency Contact",
                "Allergies (ask patient - important for safety!)"
              ]} />
            </div>
            
            <Step number="4">Double-check the spelling of the patient's name</Step>
            <Step number="5">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Create Patient</Badge></Step>
            
            <Warning>
              Always ask about allergies! This information is critical for patient safety and will 
              alert the doctor during prescribing.
            </Warning>
          </SectionHeader>

          {/* 3. Schedule Appointments */}
          <SectionHeader id="rec-appointments" icon={Calendar} title="3. Schedule Appointments">
            <h4 className="font-medium text-slate-900 mb-3">Creating an Appointment</h4>
            <Step number="1">Click <strong>Appointments</strong> in the sidebar</Step>
            <Step number="2">Click <Badge variant="outline" className="bg-[#0F766E] text-white">+ New Appointment</Badge></Step>
            <Step number="3">Search for the patient by name or phone number</Step>
            <Step number="4">Select the patient from the dropdown</Step>
            <Step number="5">Choose the date from the calendar</Step>
            <Step number="6">Enter the appointment time</Step>
            <Step number="7">Enter the reason for visit (e.g., "Follow-up", "Check-up")</Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Recording Vital Signs (Optional)</h4>
            <p className="text-slate-600 text-sm mb-3">
              If you take vital signs during check-in, enter them in the appointment:
            </p>
            <Checklist items={[
              "Blood Pressure (Systolic/Diastolic)",
              "Heart Rate (beats per minute)",
              "Respiratory Rate (breaths per minute)",
              "Temperature (°C)",
              "Oxygen Saturation (SpO2 %)",
              "Weight (kg)",
              "Height (cm)"
            ]} />
            <Step number="8">Click <Badge variant="outline" className="bg-[#0F766E] text-white">Schedule Appointment</Badge></Step>
            
            <Tip>
              <strong>Vitals Tip:</strong> When you enter vital signs, they automatically appear in the 
              doctor's consultation screen. Look for the green "Vitals Ready" badge on appointments!
            </Tip>
          </SectionHeader>

          {/* 4. Search Patients */}
          <SectionHeader id="rec-search" icon={Search} title="4. Search for Patients">
            <h4 className="font-medium text-slate-900 mb-3">Finding a Patient Record</h4>
            <Step number="1">Go to <strong>Patients</strong> page</Step>
            <Step number="2">Type in the search box at the top</Step>
            <Step number="3">You can search by:
              <Checklist items={[
                "Patient name (first or last)",
                "Phone number",
                "Email address"
              ]} />
            </Step>
            <Step number="4">Click on the patient to view their profile</Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">What You Can See</h4>
            <Checklist items={[
              "Patient's contact information",
              "Upcoming and past appointments",
              "Allergies and basic medical info",
              "Visit history (read-only)"
            ]} />
          </SectionHeader>

          {/* 5. Manage Today's Queue */}
          <SectionHeader id="rec-queue" icon={Clock} title="5. Managing Today's Queue">
            <h4 className="font-medium text-slate-900 mb-3">Using the Dashboard</h4>
            <Step number="1">Click <strong>Dashboard</strong> in the sidebar</Step>
            <Step number="2">View <strong>Today's Queue</strong> on the left</Step>
            <Step number="3">Patients are listed in order of appointment time</Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Queue Status Icons</h4>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3">
                <Badge className="bg-yellow-100 text-yellow-800">Waiting</Badge>
                <span className="text-sm text-slate-600">Patient has arrived and is waiting</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-100 text-blue-800">In Consultation</Badge>
                <span className="text-sm text-slate-600">Doctor is currently seeing the patient</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-green-100 text-green-800">Done</Badge>
                <span className="text-sm text-slate-600">Consultation completed</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-red-100 text-red-800">No Show</Badge>
                <span className="text-sm text-slate-600">Patient did not arrive</span>
              </div>
            </div>
            
            <Tip>
              <strong>Quick Tip:</strong> Look for the green "Vitals" badge - it means vital signs 
              have been recorded for that appointment!
            </Tip>
          </SectionHeader>

          {/* 6. Edit Appointments */}
          <SectionHeader id="rec-edit" icon={Edit} title="6. Edit or Cancel Appointments">
            <h4 className="font-medium text-slate-900 mb-3">Changing an Appointment</h4>
            <Step number="1">Go to <strong>Appointments</strong></Step>
            <Step number="2">Find the appointment you need to change</Step>
            <Step number="3">Click the <strong>Edit</strong> button</Step>
            <Step number="4">Update the date, time, or reason</Step>
            <Step number="5">Save your changes</Step>
            
            <h4 className="font-medium text-slate-900 mt-6 mb-3">Canceling an Appointment</h4>
            <Step number="1">Find the appointment</Step>
            <Step number="2">Click the <strong>Delete</strong> (trash) button</Step>
            <Step number="3">Confirm the deletion</Step>
            
            <Warning>
              Always inform the patient when changing or canceling their appointment. Consider calling 
              them or sending a message.
            </Warning>
          </SectionHeader>

          {/* Receptionist Data Safety */}
          <SectionHeader id="rec-data" icon={Shield} title="7. Data Safety Tips">
            <h4 className="font-medium text-slate-900 mb-3">Best Practices</h4>
            <Checklist items={[
              "Always log out when leaving your desk",
              "Don't share your password with anyone",
              "Double-check patient names before creating records",
              "Verify patient identity before giving information",
              "Report any suspicious activity to your doctor",
              "Don't discuss patient information in public areas"
            ]} />
            
            <Tip>
              <strong>Privacy Reminder:</strong> Patient information is confidential. Only share 
              information with the patient themselves or authorized family members.
            </Tip>
          </SectionHeader>
        </TabsContent>
      </Tabs>

      {/* ============ TROUBLESHOOTING SECTION ============ */}
      <Card className="mt-8 border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <HelpCircle className="w-5 h-5" />
            Troubleshooting & Common Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Printing Issues */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
              <Printer className="w-4 h-4 text-orange-600" />
              Printing Issues
            </h4>
            <div className="bg-white p-4 rounded-lg border border-orange-200">
              <p className="font-medium text-slate-700 mb-2">Problem: Print preview is blank or not loading</p>
              <p className="text-sm text-slate-600 mb-2">Solutions:</p>
              <ul className="text-sm text-slate-600 space-y-1 ml-4">
                <li>• Refresh the page and try again</li>
                <li>• Disable popup blockers for this site</li>
                <li>• Try a different browser (Chrome recommended)</li>
                <li>• Check if your printer is connected and online</li>
              </ul>
            </div>
            <div className="bg-white p-4 rounded-lg border border-orange-200 mt-2">
              <p className="font-medium text-slate-700 mb-2">Problem: Header/Logo not showing on printout</p>
              <p className="text-sm text-slate-600 mb-2">Solutions:</p>
              <ul className="text-sm text-slate-600 space-y-1 ml-4">
                <li>• Go to Settings → Print Header Customization</li>
                <li>• Re-upload your logo (max 500KB)</li>
                <li>• Make sure to click "Save Header Settings"</li>
              </ul>
            </div>
          </div>

          {/* Missing Patient */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-600" />
              Can't Find a Patient
            </h4>
            <div className="bg-white p-4 rounded-lg border border-orange-200">
              <p className="text-sm text-slate-600 mb-2">If a patient doesn't appear in search:</p>
              <ul className="text-sm text-slate-600 space-y-1 ml-4">
                <li>• Check spelling - try partial name search</li>
                <li>• Try searching by phone number or email</li>
                <li>• The patient might be registered under a different doctor</li>
                <li>• (Receptionist) You can only see your assigned doctor's patients</li>
                <li>• If truly missing, the patient may need to be re-registered</li>
              </ul>
            </div>
          </div>

          {/* Wrong Date */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600" />
              Appointments Not Showing / Wrong Date
            </h4>
            <div className="bg-white p-4 rounded-lg border border-orange-200">
              <p className="text-sm text-slate-600 mb-2">If appointments don't appear in Today's Queue:</p>
              <ul className="text-sm text-slate-600 space-y-1 ml-4">
                <li>• Check that the appointment date matches today</li>
                <li>• Verify your computer's date/time is correct</li>
                <li>• Check the appointment status (only "Waiting" and "In Consultation" show in queue)</li>
                <li>• Refresh the Dashboard page</li>
                <li>• Go to Appointments page and verify the date in the calendar</li>
              </ul>
            </div>
          </div>

          {/* Password Reset */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
              <LogIn className="w-4 h-4 text-orange-600" />
              Forgot Password / Account Locked
            </h4>
            <div className="bg-white p-4 rounded-lg border border-orange-200">
              <p className="font-medium text-slate-700 mb-2">For Doctors:</p>
              <ul className="text-sm text-slate-600 space-y-1 ml-4 mb-3">
                <li>• Contact your system administrator</li>
                <li>• If locked out, wait 10 minutes and try again</li>
              </ul>
              <p className="font-medium text-slate-700 mb-2">For Receptionists:</p>
              <ul className="text-sm text-slate-600 space-y-1 ml-4">
                <li>• Ask your doctor to reset your password</li>
                <li>• Doctor goes to: Settings → My Receptionists → Edit → New Password</li>
              </ul>
            </div>
          </div>

          {/* Contact Support */}
          <div className="bg-[#0F766E]/10 p-4 rounded-lg">
            <h4 className="font-medium text-[#0F766E] mb-2">Need More Help?</h4>
            <p className="text-sm text-slate-600 mb-3">
              If you're still experiencing issues, please contact your system administrator or 
              the clinic's IT support with the following information:
            </p>
            <Checklist items={[
              "Description of the problem",
              "Steps you took before the error occurred",
              "Any error messages displayed",
              "Your browser and device type",
              "Screenshot of the issue (if possible)"
            ]} />
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-slate-500 pt-4 pb-8">
        <p>Private ClinicEMR User Guide v1.0</p>
        <p>Last updated: March 2026</p>
      </div>
    </div>
  );
};

export default UserGuidePage;
