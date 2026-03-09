import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Printer, Settings, Eye, RotateCcw, Save, 
  Ruler, Type, Layout, CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Form types
export const FORM_TYPES = {
  PRESCRIPTION: 'prescription',
  MEDICAL_CERTIFICATE: 'medical_certificate',
  FIT_TO_WORK: 'fit_to_work',
  REFERRAL: 'referral',
  LAB_REQUEST: 'lab_request',
};

// Default print settings per form type
const DEFAULT_SETTINGS = {
  prescription: {
    paperWidth: 8, paperHeight: 4, paperUnit: 'in', paperPreset: 'custom',
    topOffset: 60, leftOffset: 40, rightOffset: 40, bottomOffset: 20, contentWidth: 720,
    fontSize: 14, lineSpacing: 1.4, sectionSpacing: 10,
    showHeader: false, showPatientInfo: true, showRxLabel: true, showSignatureSection: false,
    showFooter: false, showDate: true, showAgeSex: true, showQuantity: true,
    showDoctorName: true, showLicenseNumber: true,
    showPrcNo: true, showPtrNo: true, showS2No: true,
  },
  medical_certificate: {
    paperWidth: 8.5, paperHeight: 11, paperUnit: 'in', paperPreset: 'letter',
    topOffset: 80, leftOffset: 60, rightOffset: 60, bottomOffset: 60, contentWidth: 650,
    fontSize: 14, lineSpacing: 1.6, sectionSpacing: 16,
    showHeader: true, showPatientInfo: true, showSignatureSection: true,
    showFooter: true, showDate: true, showAgeSex: true,
    showDoctorName: true, showLicenseNumber: true,
    showPrcNo: true, showPtrNo: true, showS2No: true,
  },
  fit_to_work: {
    paperWidth: 8.5, paperHeight: 11, paperUnit: 'in', paperPreset: 'letter',
    topOffset: 80, leftOffset: 60, rightOffset: 60, bottomOffset: 60, contentWidth: 650,
    fontSize: 14, lineSpacing: 1.6, sectionSpacing: 16,
    showHeader: true, showPatientInfo: true, showSignatureSection: true,
    showFooter: true, showDate: true, showAgeSex: true,
    showDoctorName: true, showLicenseNumber: true,
    showPrcNo: true, showPtrNo: true, showS2No: true,
  },
  referral: {
    paperWidth: 8.5, paperHeight: 11, paperUnit: 'in', paperPreset: 'letter',
    topOffset: 80, leftOffset: 60, rightOffset: 60, bottomOffset: 60, contentWidth: 650,
    fontSize: 14, lineSpacing: 1.6, sectionSpacing: 16,
    showHeader: true, showPatientInfo: true, showSignatureSection: true,
    showFooter: true, showDate: true, showAgeSex: true,
    showDoctorName: true, showLicenseNumber: true,
    showPrcNo: true, showPtrNo: true, showS2No: true,
  },
  lab_request: {
    paperWidth: 8.5, paperHeight: 11, paperUnit: 'in', paperPreset: 'letter',
    topOffset: 80, leftOffset: 60, rightOffset: 60, bottomOffset: 60, contentWidth: 650,
    fontSize: 14, lineSpacing: 1.6, sectionSpacing: 14,
    showHeader: true, showPatientInfo: true, showSignatureSection: true,
    showFooter: false, showDate: true, showAgeSex: true,
    showDoctorName: true, showLicenseNumber: true, showUrgency: true,
    showPrcNo: true, showPtrNo: true, showS2No: true,
  },
};

// Paper presets
const PAPER_PRESETS = {
  '8x4': { width: 8, height: 4, unit: 'in', label: '8 × 4 inches' },
  '5x3': { width: 5, height: 3, unit: 'in', label: '5 × 3 inches' },
  'a5': { width: 148, height: 210, unit: 'mm', label: 'A5 (148 × 210 mm)' },
  'a6': { width: 105, height: 148, unit: 'mm', label: 'A6 (105 × 148 mm)' },
  'half-letter': { width: 5.5, height: 8.5, unit: 'in', label: 'Half Letter (5.5 × 8.5 in)' },
  'letter': { width: 8.5, height: 11, unit: 'in', label: 'Letter (8.5 × 11 in)' },
  'legal': { width: 8.5, height: 14, unit: 'in', label: 'Legal (8.5 × 14 in)' },
  'custom': { width: 8, height: 4, unit: 'in', label: 'Custom' },
};

// Storage keys per form type
const getStorageKey = (formType) => `emr_print_settings_${formType}`;

// Load print settings from localStorage
export const loadPrintSettings = (formType = 'prescription') => {
  try {
    const saved = localStorage.getItem(getStorageKey(formType));
    if (saved) {
      return { ...DEFAULT_SETTINGS[formType], ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load print settings:', e);
  }
  return DEFAULT_SETTINGS[formType] || DEFAULT_SETTINGS.prescription;
};

// Save print settings to localStorage
export const savePrintSettings = (settings, formType = 'prescription') => {
  localStorage.setItem(getStorageKey(formType), JSON.stringify(settings));
};

// Form type labels
const FORM_TYPE_LABELS = {
  prescription: 'Prescription',
  medical_certificate: 'Medical Certificate',
  fit_to_work: 'Fit-to-Work Certificate',
  referral: 'Referral Letter',
  lab_request: 'Lab/Imaging Request',
};

const PrintPreviewDialog = ({ 
  open, 
  onOpenChange, 
  formType = FORM_TYPES.PRESCRIPTION,
  title,
  patient,
  doctor,
  clinicSettings = {},
  // Data props based on form type
  medicines = [],          // For prescription
  certificateData = {},    // For medical_certificate, fit_to_work
  referralData = {},       // For referral
  labRequestData = {},     // For lab_request
  onPrint 
}) => {
  const [settings, setSettings] = useState(() => loadPrintSettings(formType));
  const [activeTab, setActiveTab] = useState('preview');

  // Load settings on mount or form type change
  useEffect(() => {
    if (open) {
      setSettings(loadPrintSettings(formType));
    }
  }, [open, formType]);

  // Update setting helper
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Handle paper preset change
  const handlePresetChange = (preset) => {
    if (preset !== 'custom' && PAPER_PRESETS[preset]) {
      const p = PAPER_PRESETS[preset];
      setSettings(prev => ({
        ...prev,
        paperPreset: preset,
        paperWidth: p.width,
        paperHeight: p.height,
        paperUnit: p.unit,
      }));
    } else {
      updateSetting('paperPreset', 'custom');
    }
  };

  // Save settings
  const handleSaveSettings = () => {
    savePrintSettings(settings, formType);
    toast.success('Print settings saved');
  };

  // Restore defaults
  const handleRestoreDefaults = () => {
    setSettings(DEFAULT_SETTINGS[formType] || DEFAULT_SETTINGS.prescription);
    toast.info('Settings restored to defaults');
  };

  // Convert units to pixels for preview
  const toPixels = (value, unit) => {
    switch (unit) {
      case 'in': return value * 96;
      case 'cm': return value * 37.8;
      case 'mm': return value * 3.78;
      default: return value;
    }
  };

  // Convert to mm for CSS
  const toMM = (value, unit) => {
    switch (unit) {
      case 'in': return value * 25.4;
      case 'cm': return value * 10;
      case 'mm': return value;
      default: return value * 25.4;
    }
  };

  // Generate content HTML based on form type
  const generateContentHTML = () => {
    const today = new Date().toLocaleDateString();
    
    switch (formType) {
      case FORM_TYPES.PRESCRIPTION:
        return generatePrescriptionHTML(today);
      case FORM_TYPES.MEDICAL_CERTIFICATE:
        return generateMedCertHTML(today);
      case FORM_TYPES.FIT_TO_WORK:
        return generateFitToWorkHTML(today);
      case FORM_TYPES.REFERRAL:
        return generateReferralHTML(today);
      case FORM_TYPES.LAB_REQUEST:
        return generateLabRequestHTML(today);
      default:
        return '';
    }
  };

  // Prescription HTML
  const generatePrescriptionHTML = (today) => {
    const medicinesHTML = medicines.map((med, idx) => `
      <div class="medicine-item">
        <div class="medicine-name">${idx + 1}. ${med.name || ''} ${med.dosage || ''}</div>
        <div class="medicine-sig">
          Sig: ${med.sig || med.frequency || ''} ${med.duration ? `for ${med.duration}` : ''}
          ${settings.showQuantity && med.quantity ? `<span class="quantity">#${med.quantity}</span>` : ''}
        </div>
      </div>
    `).join('');

    return `
      ${settings.showPatientInfo ? `
        <div class="patient-info">
          <div class="patient-row">
            <span class="patient-name">${patient?.full_name || 'Patient Name'}</span>
            ${settings.showDate ? `<span>Date: ${today}</span>` : ''}
          </div>
          ${settings.showAgeSex ? `
            <div class="patient-row">
              <span>Age: ${patient?.age || 'N/A'} | Sex: ${patient?.sex || 'N/A'}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      ${settings.showRxLabel ? `<div class="rx-symbol">Rx</div>` : ''}
      
      <div class="medicines-list">
        ${medicinesHTML}
      </div>
    `;
  };

  // Medical Certificate HTML
  const generateMedCertHTML = (today) => {
    const { diagnosis, start_date, end_date, remarks } = certificateData;
    return `
      <div class="form-title">MEDICAL CERTIFICATE</div>
      
      ${settings.showDate ? `<div class="date-line">Date: ${today}</div>` : ''}
      
      <div class="form-content">
        <p class="greeting">To Whom It May Concern:</p>
        
        <p class="body-text">
          This is to certify that <strong>${patient?.full_name || 'Patient Name'}</strong>,
          ${settings.showAgeSex ? `${patient?.age || 'N/A'} years old, ${patient?.sex || 'N/A'},` : ''}
          was examined and treated on this date.
        </p>
        
        ${diagnosis ? `
          <p class="body-text"><strong>Diagnosis:</strong> ${diagnosis}</p>
        ` : ''}
        
        ${start_date && end_date ? `
          <p class="body-text">
            The patient is advised to rest from <strong>${format(new Date(start_date), 'MMMM d, yyyy')}</strong> 
            to <strong>${format(new Date(end_date), 'MMMM d, yyyy')}</strong>.
          </p>
        ` : ''}
        
        ${remarks ? `<p class="body-text"><strong>Remarks:</strong> ${remarks}</p>` : ''}
      </div>
    `;
  };

  // Fit-to-Work HTML
  const generateFitToWorkHTML = (today) => {
    const { examined_date, fit_date, restrictions } = certificateData;
    return `
      <div class="form-title">FIT-TO-WORK CERTIFICATE</div>
      
      ${settings.showDate ? `<div class="date-line">Date: ${today}</div>` : ''}
      
      <div class="form-content">
        <p class="greeting">To Whom It May Concern:</p>
        
        <p class="body-text">
          This is to certify that <strong>${patient?.full_name || 'Patient Name'}</strong>,
          ${settings.showAgeSex ? `${patient?.age || 'N/A'} years old, ${patient?.sex || 'N/A'},` : ''}
          was examined ${examined_date ? `on <strong>${format(new Date(examined_date), 'MMMM d, yyyy')}</strong>` : 'on this date'}
          and is found to be <strong>FIT TO WORK</strong>${fit_date ? ` effective <strong>${format(new Date(fit_date), 'MMMM d, yyyy')}</strong>` : ''}.
        </p>
        
        ${restrictions ? `
          <p class="body-text"><strong>Restrictions/Limitations:</strong> ${restrictions}</p>
        ` : ''}
        
        <p class="body-text">This certificate is issued upon the request of the above-named patient.</p>
      </div>
    `;
  };

  // Referral HTML
  const generateReferralHTML = (today) => {
    const { to_doctor, to_specialty, reason, findings } = referralData;
    return `
      <div class="form-title">REFERRAL LETTER</div>
      
      ${settings.showDate ? `<div class="date-line">Date: ${today}</div>` : ''}
      
      <div class="form-content">
        <p class="greeting">
          Dear ${to_doctor ? `Dr. ${to_doctor}` : 'Colleague'}${to_specialty ? ` (${to_specialty})` : ''},
        </p>
        
        <p class="body-text">
          I am referring <strong>${patient?.full_name || 'Patient Name'}</strong>,
          ${settings.showAgeSex ? `${patient?.age || 'N/A'} years old, ${patient?.sex || 'N/A'},` : ''}
          for your expert evaluation and management.
        </p>
        
        ${reason ? `
          <p class="body-text"><strong>Reason for Referral:</strong><br/>${reason}</p>
        ` : ''}
        
        ${findings ? `
          <p class="body-text"><strong>Clinical Findings:</strong><br/>${findings}</p>
        ` : ''}
        
        <p class="body-text">Thank you for your kind attention to this patient.</p>
      </div>
    `;
  };

  // Lab Request HTML
  const generateLabRequestHTML = (today) => {
    const { request_type, tests = [], clinical_info, urgency } = labRequestData;
    const testsHTML = tests.map((test, idx) => `
      <div class="test-item">
        <span class="test-checkbox">☐</span>
        <span class="test-name">${test.name || ''}</span>
        ${test.instructions ? `<span class="test-instructions">(${test.instructions})</span>` : ''}
      </div>
    `).join('');

    return `
      <div class="form-title">${request_type === 'imaging' ? 'IMAGING/RADIOLOGY' : 'LABORATORY'} REQUEST</div>
      
      ${settings.showDate ? `<div class="date-line">Date: ${today}</div>` : ''}
      
      ${settings.showUrgency && urgency && urgency !== 'routine' ? `
        <div class="urgency-badge ${urgency}">${urgency.toUpperCase()}</div>
      ` : ''}
      
      ${settings.showPatientInfo ? `
        <div class="patient-info-box">
          <div><strong>Patient:</strong> ${patient?.full_name || 'Patient Name'}</div>
          ${settings.showAgeSex ? `<div><strong>Age/Sex:</strong> ${patient?.age || 'N/A'} / ${patient?.sex || 'N/A'}</div>` : ''}
        </div>
      ` : ''}
      
      ${clinical_info ? `
        <div class="clinical-info">
          <strong>Clinical Information:</strong><br/>${clinical_info}
        </div>
      ` : ''}
      
      <div class="tests-section">
        <strong>Tests/Procedures Requested:</strong>
        <div class="tests-list">
          ${testsHTML}
        </div>
      </div>
    `;
  };

  // Handle print
  const handlePrint = () => {
    // Save settings before printing
    savePrintSettings(settings, formType);

    const paperWidthMM = toMM(settings.paperWidth, settings.paperUnit);
    const paperHeightMM = toMM(settings.paperHeight, settings.paperUnit);

    const paperCSS = {
      width: `${settings.paperWidth}${settings.paperUnit}`,
      height: `${settings.paperHeight}${settings.paperUnit}`,
      widthMM: `${paperWidthMM}mm`,
      heightMM: `${paperHeightMM}mm`,
    };

    const contentHTML = generateContentHTML();

    // Generate print HTML
    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title || FORM_TYPE_LABELS[formType]} - ${patient?.full_name || 'Patient'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          @page {
            size: ${paperCSS.width} ${paperCSS.height};
            margin: 0 !important;
          }
          
          html, body {
            width: ${paperCSS.width};
            height: ${paperCSS.height};
            max-width: ${paperCSS.width};
            max-height: ${paperCSS.height};
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden;
            font-family: 'Times New Roman', Times, serif;
            font-size: ${settings.fontSize}px;
            line-height: ${settings.lineSpacing};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .print-container {
            width: ${paperCSS.width};
            height: ${paperCSS.height};
            max-width: ${paperCSS.width};
            max-height: ${paperCSS.height};
            padding: ${settings.topOffset}px ${settings.rightOffset}px ${settings.bottomOffset}px ${settings.leftOffset}px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            page-break-after: avoid;
            page-break-inside: avoid;
          }
          
          .content-area {
            max-width: ${settings.contentWidth}px;
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          
          /* Header styles */
          .header-section {
            text-align: center;
            border-bottom: 2px solid #0F766E;
            padding-bottom: ${settings.sectionSpacing}px;
            margin-bottom: ${settings.sectionSpacing * 1.5}px;
          }
          .header-logo { height: 48px; margin-bottom: 8px; }
          .clinic-name { font-size: ${settings.fontSize + 6}px; font-weight: bold; color: #0F766E; }
          .clinic-subtitle { font-size: ${settings.fontSize - 2}px; color: #555; font-style: italic; }
          .clinic-address { font-size: ${settings.fontSize - 2}px; color: #555; }
          
          /* Patient info */
          .patient-info { margin-bottom: ${settings.sectionSpacing * 1.5}px; }
          .patient-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .patient-name { font-weight: bold; }
          
          /* Prescription specific */
          .rx-symbol { font-size: ${settings.fontSize + 10}px; font-weight: bold; font-style: italic; margin-bottom: ${settings.sectionSpacing}px; }
          .medicines-list { flex: 1; margin-left: 16px; }
          .medicine-item { margin-bottom: ${settings.sectionSpacing}px; }
          .medicine-name { font-weight: 600; }
          .medicine-sig { margin-left: 20px; color: #444; }
          .quantity { margin-left: 20px; font-weight: 500; }
          
          /* Certificate/Form styles */
          .form-title { 
            font-size: ${settings.fontSize + 4}px; 
            font-weight: bold; 
            text-align: center; 
            margin-bottom: ${settings.sectionSpacing * 2}px;
            text-decoration: underline;
          }
          .date-line { text-align: right; margin-bottom: ${settings.sectionSpacing}px; }
          .form-content { flex: 1; }
          .greeting { margin-bottom: ${settings.sectionSpacing}px; }
          .body-text { 
            margin-bottom: ${settings.sectionSpacing}px; 
            text-align: justify; 
            text-indent: 40px;
          }
          .body-text:first-child { text-indent: 0; }
          
          /* Lab request styles */
          .urgency-badge {
            display: inline-block;
            padding: 4px 12px;
            font-weight: bold;
            border-radius: 4px;
            margin-bottom: ${settings.sectionSpacing}px;
          }
          .urgency-badge.urgent { background: #FEF3C7; color: #92400E; }
          .urgency-badge.stat { background: #FEE2E2; color: #991B1B; }
          .patient-info-box { 
            background: #F8FAFC; 
            padding: 12px; 
            border-radius: 4px; 
            margin-bottom: ${settings.sectionSpacing}px;
          }
          .clinical-info { margin-bottom: ${settings.sectionSpacing}px; }
          .tests-section { margin-bottom: ${settings.sectionSpacing}px; }
          .tests-list { margin-top: 8px; margin-left: 16px; }
          .test-item { margin-bottom: 6px; display: flex; align-items: flex-start; gap: 8px; }
          .test-checkbox { font-size: 16px; }
          .test-name { font-weight: 500; }
          .test-instructions { color: #666; font-size: ${settings.fontSize - 2}px; }
          
          /* Signature */
          .signature-section {
            text-align: right;
            margin-top: auto;
            padding-top: ${settings.sectionSpacing * 2}px;
          }
          .signature-inner {
            display: inline-block;
            text-align: center;
            min-width: 200px;
          }
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 36px;
            padding-top: 6px;
          }
          .license-info { font-size: ${settings.fontSize - 2}px; color: #555; }
          
          /* Footer */
          .footer-section {
            font-size: ${settings.fontSize - 4}px;
            color: #777;
            text-align: center;
            margin-top: ${settings.sectionSpacing}px;
            border-top: 1px solid #ddd;
            padding-top: 8px;
          }
          
          @media print {
            html, body {
              width: ${paperCSS.width} !important;
              height: ${paperCSS.height} !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print-container {
              width: ${paperCSS.width} !important;
              height: ${paperCSS.height} !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <div class="content-area">
            ${settings.showHeader ? `
              <div class="header-section">
                ${clinicSettings.print_header_logo ? `<img src="${clinicSettings.print_header_logo}" class="header-logo" alt="Logo" />` : ''}
                <div class="clinic-name">${clinicSettings.print_header_title || clinicSettings.clinic_name || 'Medical Clinic'}</div>
                ${clinicSettings.print_header_subtitle ? `<div class="clinic-subtitle">${clinicSettings.print_header_subtitle}</div>` : ''}
                ${clinicSettings.address ? `<div class="clinic-address">${clinicSettings.address}</div>` : ''}
                ${clinicSettings.phone ? `<div class="clinic-address">Tel: ${clinicSettings.phone}</div>` : ''}
              </div>
            ` : ''}
            
            ${contentHTML}
            
            ${settings.showSignatureSection ? `
              <div class="signature-section">
                <div class="signature-inner">
                  <div class="signature-line">
                    ${settings.showDoctorName ? `<div>${doctor?.full_name || 'Doctor Name'}</div>` : ''}
                    <div class="license-info">
                      ${settings.showPrcNo ? `<div>PRC No: ${doctor?.prc_no || '____________'}</div>` : ''}
                      ${settings.showPtrNo ? `<div>PTR No: ${doctor?.ptr_no || '____________'}</div>` : ''}
                      ${settings.showS2No ? `<div>S2 No: ${doctor?.license_no || '____________'}</div>` : ''}
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}
            
            ${settings.showFooter ? `
              <div class="footer-section">Printed from Private Clinic EMR</div>
            ` : ''}
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 100);
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `;

    // Use iframe method for better print control
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentDocument || printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(printHTML);
    frameDoc.close();

    printFrame.onload = () => {
      setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }, 250);
    };

    toast.info(`Paper size: ${settings.paperWidth}${settings.paperUnit} × ${settings.paperHeight}${settings.paperUnit}`, {
      duration: 4000,
    });
    
    if (onPrint) onPrint();
  };

  // Preview scale
  const previewScale = 0.4;
  const widthPx = toPixels(settings.paperWidth, settings.paperUnit) * previewScale;
  const heightPx = toPixels(settings.paperHeight, settings.paperUnit) * previewScale;

  // Render preview content based on form type
  const renderPreviewContent = () => {
    const scaledFontSize = settings.fontSize * previewScale;
    
    switch (formType) {
      case FORM_TYPES.PRESCRIPTION:
        return (
          <>
            {settings.showPatientInfo && (
              <div className="mb-2">
                <div className="flex justify-between">
                  <span className="font-bold">{patient?.full_name || 'Patient Name'}</span>
                  {settings.showDate && <span style={{ fontSize: scaledFontSize }}>Date: {new Date().toLocaleDateString()}</span>}
                </div>
                {settings.showAgeSex && (
                  <div className="text-slate-600" style={{ fontSize: scaledFontSize }}>Age: {patient?.age || 'N/A'} | Sex: {patient?.sex || 'N/A'}</div>
                )}
              </div>
            )}
            {settings.showRxLabel && (
              <div className="font-bold italic mb-1" style={{ fontSize: (settings.fontSize + 6) * previewScale }}>Rx</div>
            )}
            <div className="flex-grow space-y-1 ml-2">
              {medicines.length > 0 ? medicines.map((med, idx) => (
                <div key={idx} style={{ fontSize: scaledFontSize }}>
                  <div className="font-semibold">{idx + 1}. {med.name} {med.dosage || ''}</div>
                  <div className="ml-2 text-slate-600">
                    Sig: {med.sig || med.frequency || ''} {med.duration ? `for ${med.duration}` : ''}
                  </div>
                </div>
              )) : (
                <div className="text-slate-400 italic" style={{ fontSize: scaledFontSize }}>No medicines added</div>
              )}
            </div>
          </>
        );
      
      case FORM_TYPES.MEDICAL_CERTIFICATE:
        return (
          <>
            <div className="text-center font-bold underline mb-2" style={{ fontSize: (settings.fontSize + 2) * previewScale }}>
              MEDICAL CERTIFICATE
            </div>
            <div className="text-right mb-2" style={{ fontSize: scaledFontSize }}>Date: {new Date().toLocaleDateString()}</div>
            <div style={{ fontSize: scaledFontSize }} className="space-y-1">
              <p>To Whom It May Concern:</p>
              <p className="indent-4">This is to certify that <strong>{patient?.full_name || 'Patient Name'}</strong> was examined...</p>
              {certificateData.diagnosis && <p><strong>Diagnosis:</strong> {certificateData.diagnosis}</p>}
            </div>
          </>
        );
      
      case FORM_TYPES.FIT_TO_WORK:
        return (
          <>
            <div className="text-center font-bold underline mb-2" style={{ fontSize: (settings.fontSize + 2) * previewScale }}>
              FIT-TO-WORK CERTIFICATE
            </div>
            <div className="text-right mb-2" style={{ fontSize: scaledFontSize }}>Date: {new Date().toLocaleDateString()}</div>
            <div style={{ fontSize: scaledFontSize }} className="space-y-1">
              <p>To Whom It May Concern:</p>
              <p className="indent-4">This is to certify that <strong>{patient?.full_name || 'Patient Name'}</strong> is FIT TO WORK...</p>
            </div>
          </>
        );
      
      case FORM_TYPES.REFERRAL:
        return (
          <>
            <div className="text-center font-bold underline mb-2" style={{ fontSize: (settings.fontSize + 2) * previewScale }}>
              REFERRAL LETTER
            </div>
            <div className="text-right mb-2" style={{ fontSize: scaledFontSize }}>Date: {new Date().toLocaleDateString()}</div>
            <div style={{ fontSize: scaledFontSize }} className="space-y-1">
              <p>Dear {referralData.to_doctor ? `Dr. ${referralData.to_doctor}` : 'Colleague'},</p>
              <p className="indent-4">I am referring <strong>{patient?.full_name || 'Patient Name'}</strong> for evaluation...</p>
            </div>
          </>
        );
      
      case FORM_TYPES.LAB_REQUEST:
        return (
          <>
            <div className="text-center font-bold underline mb-2" style={{ fontSize: (settings.fontSize + 2) * previewScale }}>
              {labRequestData.request_type === 'imaging' ? 'IMAGING REQUEST' : 'LABORATORY REQUEST'}
            </div>
            {labRequestData.urgency && labRequestData.urgency !== 'routine' && (
              <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-1 ${labRequestData.urgency === 'stat' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                {labRequestData.urgency.toUpperCase()}
              </div>
            )}
            <div style={{ fontSize: scaledFontSize }} className="space-y-1">
              <div><strong>Patient:</strong> {patient?.full_name || 'Patient Name'}</div>
              {labRequestData.tests?.length > 0 && (
                <div>
                  <strong>Tests:</strong>
                  <ul className="ml-3">
                    {labRequestData.tests.slice(0, 3).map((t, i) => <li key={i}>☐ {t.name}</li>)}
                    {labRequestData.tests.length > 3 && <li>...and {labRequestData.tests.length - 3} more</li>}
                  </ul>
                </div>
              )}
            </div>
          </>
        );
      
      default:
        return null;
    }
  };

  // Get section visibility options based on form type
  const getSectionOptions = () => {
    const common = [
      { key: 'showHeader', label: 'Show Header' },
      { key: 'showPatientInfo', label: 'Show Patient Info' },
      { key: 'showSignatureSection', label: 'Show Signature' },
      { key: 'showPrcNo', label: 'Show PRC No.' },
      { key: 'showPtrNo', label: 'Show PTR No.' },
      { key: 'showS2No', label: 'Show S2 No.' },
      { key: 'showFooter', label: 'Show Footer' },
      { key: 'showDate', label: 'Show Date' },
      { key: 'showAgeSex', label: 'Show Age/Sex' },
      { key: 'showDoctorName', label: 'Show Doctor Name' },
      { key: 'showLicenseNumber', label: 'Show License No.' },
    ];

    if (formType === FORM_TYPES.PRESCRIPTION) {
      return [
        ...common.slice(0, 2),
        { key: 'showRxLabel', label: 'Show Rx Label' },
        ...common.slice(2),
        { key: 'showQuantity', label: 'Show Quantity' },
      ];
    }

    if (formType === FORM_TYPES.LAB_REQUEST) {
      return [
        ...common,
        { key: 'showUrgency', label: 'Show Urgency Badge' },
      ];
    }

    return common;
  };

  const displayTitle = title || FORM_TYPE_LABELS[formType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#0F766E]" />
            Print {displayTitle}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="preview">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <div className="flex justify-center p-4 bg-slate-100 rounded-lg overflow-auto">
              <div 
                className="bg-white border shadow-lg relative"
                style={{ 
                  width: `${Math.min(widthPx, 380)}px`, 
                  minHeight: `${Math.min(heightPx, 500)}px`,
                  fontSize: `${settings.fontSize * previewScale}px`,
                  lineHeight: settings.lineSpacing,
                }}
              >
                <div 
                  className="h-full flex flex-col"
                  style={{ 
                    padding: `${settings.topOffset * previewScale}px ${settings.rightOffset * previewScale}px ${settings.bottomOffset * previewScale}px ${settings.leftOffset * previewScale}px`,
                  }}
                >
                  {settings.showHeader && (
                    <div className="text-center border-b-2 border-[#0F766E] pb-2 mb-2">
                      <div className="font-bold text-[#0F766E]" style={{ fontSize: `${(settings.fontSize + 4) * previewScale}px` }}>
                        {clinicSettings.print_header_title || clinicSettings.clinic_name || 'Medical Clinic'}
                      </div>
                      {clinicSettings.print_header_subtitle && (
                        <div className="text-slate-500 italic" style={{ fontSize: `${(settings.fontSize - 2) * previewScale}px` }}>
                          {clinicSettings.print_header_subtitle}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {renderPreviewContent()}
                  
                  {settings.showSignatureSection && (
                    <div className="text-right mt-auto pt-3">
                      <div className="inline-block text-center" style={{ minWidth: '80px' }}>
                        <div className="border-t border-black pt-1 mt-4">
                          {settings.showDoctorName && <div style={{ fontSize: `${settings.fontSize * previewScale}px` }}>{doctor?.full_name || 'Doctor Name'}</div>}
                          <div className="text-slate-500" style={{ fontSize: `${(settings.fontSize - 2) * previewScale}px` }}>
                            {settings.showPrcNo && <div>PRC: {doctor?.prc_no || '______'}</div>}
                            {settings.showPtrNo && <div>PTR: {doctor?.ptr_no || '______'}</div>}
                            {settings.showS2No && <div>S2: {doctor?.license_no || '______'}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Paper size reminder */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="text-amber-800">
                <strong>Paper Size:</strong> {settings.paperWidth}{settings.paperUnit} × {settings.paperHeight}{settings.paperUnit}
              </p>
              <p className="text-amber-700 text-xs mt-1">
                In the print dialog, select "More settings" → Paper size → Choose matching size or "Custom"
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setActiveTab('settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Adjust Settings
              </Button>
              <Button onClick={handlePrint} className="bg-[#0F766E] hover:bg-[#115E59]">
                <Printer className="w-4 h-4 mr-2" />
                Print {displayTitle}
              </Button>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Tabs defaultValue="paper">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="paper" className="text-xs">
                  <Ruler className="w-3 h-3 mr-1" />
                  Paper
                </TabsTrigger>
                <TabsTrigger value="layout" className="text-xs">
                  <Layout className="w-3 h-3 mr-1" />
                  Layout
                </TabsTrigger>
                <TabsTrigger value="sections" className="text-xs">
                  <CheckSquare className="w-3 h-3 mr-1" />
                  Sections
                </TabsTrigger>
                <TabsTrigger value="typography" className="text-xs">
                  <Type className="w-3 h-3 mr-1" />
                  Text
                </TabsTrigger>
              </TabsList>

              {/* Paper Settings */}
              <TabsContent value="paper" className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Paper Preset</Label>
                  <Select value={settings.paperPreset} onValueChange={handlePresetChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAPER_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>{preset.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Width</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={settings.paperWidth}
                      onChange={(e) => {
                        updateSetting('paperWidth', parseFloat(e.target.value) || 0);
                        updateSetting('paperPreset', 'custom');
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={settings.paperHeight}
                      onChange={(e) => {
                        updateSetting('paperHeight', parseFloat(e.target.value) || 0);
                        updateSetting('paperPreset', 'custom');
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Select value={settings.paperUnit} onValueChange={(v) => updateSetting('paperUnit', v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in">inches</SelectItem>
                        <SelectItem value="cm">cm</SelectItem>
                        <SelectItem value="mm">mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Layout Settings */}
              <TabsContent value="layout" className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Top Offset (px)</Label>
                    <Input
                      type="number"
                      value={settings.topOffset}
                      onChange={(e) => updateSetting('topOffset', parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bottom Offset (px)</Label>
                    <Input
                      type="number"
                      value={settings.bottomOffset}
                      onChange={(e) => updateSetting('bottomOffset', parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Left Offset (px)</Label>
                    <Input
                      type="number"
                      value={settings.leftOffset}
                      onChange={(e) => updateSetting('leftOffset', parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Right Offset (px)</Label>
                    <Input
                      type="number"
                      value={settings.rightOffset}
                      onChange={(e) => updateSetting('rightOffset', parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Content Width (px)</Label>
                  <Input
                    type="number"
                    value={settings.contentWidth}
                    onChange={(e) => updateSetting('contentWidth', parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
              </TabsContent>

              {/* Section Visibility */}
              <TabsContent value="sections" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {getSectionOptions().map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={settings[key] || false}
                        onCheckedChange={(checked) => updateSetting(key, checked)}
                      />
                      <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>
                
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 mt-4">
                  <strong>Tip:</strong> Turn off Header and Signature if your paper already has pre-printed clinic info.
                </div>
              </TabsContent>

              {/* Typography Settings */}
              <TabsContent value="typography" className="space-y-4">
                <div>
                  <Label className="text-xs">Font Size (px)</Label>
                  <Input
                    type="number"
                    value={settings.fontSize}
                    onChange={(e) => updateSetting('fontSize', parseInt(e.target.value) || 12)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Line Spacing</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.lineSpacing}
                    onChange={(e) => updateSetting('lineSpacing', parseFloat(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Section Spacing (px)</Label>
                  <Input
                    type="number"
                    value={settings.sectionSpacing}
                    onChange={(e) => updateSetting('sectionSpacing', parseInt(e.target.value) || 8)}
                    className="mt-1"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleSaveSettings} className="flex-1 bg-[#0F766E] hover:bg-[#115E59]">
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </Button>
              <Button onClick={handleRestoreDefaults} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore Defaults
              </Button>
            </div>
            
            <Button onClick={() => setActiveTab('preview')} variant="outline" className="w-full">
              <Eye className="w-4 h-4 mr-2" />
              Back to Preview
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PrintPreviewDialog;
