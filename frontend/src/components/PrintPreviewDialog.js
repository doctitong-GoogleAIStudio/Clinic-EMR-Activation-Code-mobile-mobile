import React, { useState, useEffect, useRef } from 'react';
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

// Default print settings
const DEFAULT_SETTINGS = {
  // Paper size
  paperWidth: 8,
  paperHeight: 4,
  paperUnit: 'in',
  paperPreset: 'custom',
  
  // Layout position
  topOffset: 110,
  leftOffset: 40,
  rightOffset: 40,
  bottomOffset: 20,
  contentWidth: 720,
  
  // Typography
  fontSize: 16,
  lineSpacing: 1.4,
  sectionSpacing: 12,
  
  // Section visibility
  showHeader: false,
  showPatientInfo: true,
  showRxLabel: true,
  showSignatureSection: false,
  showFooter: false,
  showDate: true,
  showAgeSex: true,
  showQuantity: true,
  showDoctorName: true,
  showLicenseNumber: true,
};

// Paper presets
const PAPER_PRESETS = {
  '8x4': { width: 8, height: 4, unit: 'in', label: '8 × 4 inches' },
  '5x3': { width: 5, height: 3, unit: 'in', label: '5 × 3 inches' },
  'a5': { width: 148, height: 210, unit: 'mm', label: 'A5 (148 × 210 mm)' },
  'a6': { width: 105, height: 148, unit: 'mm', label: 'A6 (105 × 148 mm)' },
  'half-letter': { width: 5.5, height: 8.5, unit: 'in', label: 'Half Letter (5.5 × 8.5 in)' },
  'letter': { width: 8.5, height: 11, unit: 'in', label: 'Letter (8.5 × 11 in)' },
  'custom': { width: 8, height: 4, unit: 'in', label: 'Custom' },
};

const STORAGE_KEY = 'emr_prescription_print_settings';

// Load print settings from localStorage
export const loadPrintSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load print settings:', e);
  }
  return DEFAULT_SETTINGS;
};

// Save print settings to localStorage
export const savePrintSettings = (settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const PrintPreviewDialog = ({ 
  open, 
  onOpenChange, 
  title = "Print Prescription",
  patient,
  doctor,
  clinicSettings = {},
  medicines = [],
  onPrint 
}) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('preview');
  const printRef = useRef();

  // Load settings on mount
  useEffect(() => {
    setSettings(loadPrintSettings());
  }, [open]);

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
    savePrintSettings(settings);
    toast.success('Print settings saved');
  };

  // Restore defaults
  const handleRestoreDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
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

  // Handle print
  const handlePrint = () => {
    if (!medicines || medicines.length === 0) {
      toast.error('No prescription to print.');
      return;
    }

    // Save settings before printing
    savePrintSettings(settings);

    // Convert paper size to mm for better browser compatibility
    const toMM = (value, unit) => {
      switch (unit) {
        case 'in': return value * 25.4;
        case 'cm': return value * 10;
        case 'mm': return value;
        default: return value * 25.4;
      }
    };

    const paperWidthMM = toMM(settings.paperWidth, settings.paperUnit);
    const paperHeightMM = toMM(settings.paperHeight, settings.paperUnit);

    const paperCSS = {
      width: `${settings.paperWidth}${settings.paperUnit}`,
      height: `${settings.paperHeight}${settings.paperUnit}`,
      widthMM: `${paperWidthMM}mm`,
      heightMM: `${paperHeightMM}mm`,
    };
    
    // Generate medicines HTML
    const medicinesHTML = medicines.map((med, idx) => `
      <div class="medicine-item">
        <div class="medicine-name">${idx + 1}. ${med.name} ${med.dosage || ''}</div>
        <div class="medicine-sig">
          Sig: ${med.sig || med.frequency || ''} ${med.duration ? `for ${med.duration}` : ''}
          ${settings.showQuantity && med.quantity ? `<span class="quantity">#${med.quantity}</span>` : ''}
        </div>
      </div>
    `).join('');

    // Generate print HTML
    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - ${patient?.full_name || 'Patient'}</title>
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
          
          .prescription-container {
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
            overflow: hidden;
          }
          
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
          
          .patient-info {
            margin-bottom: ${settings.sectionSpacing * 1.5}px;
          }
          
          .patient-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          
          .patient-name { font-weight: bold; }
          
          .rx-section { margin-bottom: ${settings.sectionSpacing}px; }
          .rx-symbol { font-size: ${settings.fontSize + 10}px; font-weight: bold; font-style: italic; }
          
          .medicines-list {
            flex: 1;
            margin-left: 16px;
          }
          
          .medicine-item { margin-bottom: ${settings.sectionSpacing}px; }
          .medicine-name { font-weight: 600; }
          .medicine-sig { margin-left: 20px; color: #444; }
          .quantity { margin-left: 20px; font-weight: 500; }
          
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
          
          .footer-section {
            font-size: ${settings.fontSize - 4}px;
            color: #777;
            margin-top: ${settings.sectionSpacing}px;
          }
          
          @media print {
            html, body {
              width: ${paperCSS.width} !important;
              height: ${paperCSS.height} !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .prescription-container {
              width: ${paperCSS.width} !important;
              height: ${paperCSS.height} !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="prescription-container">
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
            
            ${settings.showPatientInfo ? `
              <div class="patient-info">
                <div class="patient-row">
                  <span class="patient-name">${patient?.full_name || 'Patient Name'}</span>
                  ${settings.showDate ? `<span>Date: ${new Date().toLocaleDateString()}</span>` : ''}
                </div>
                ${settings.showAgeSex ? `
                  <div class="patient-row">
                    <span>Age: ${patient?.age || 'N/A'} | Sex: ${patient?.sex || 'N/A'}</span>
                  </div>
                ` : ''}
              </div>
            ` : ''}
            
            ${settings.showRxLabel ? `
              <div class="rx-section">
                <div class="rx-symbol">Rx</div>
              </div>
            ` : ''}
            
            <div class="medicines-list">
              ${medicinesHTML}
            </div>
            
            ${settings.showSignatureSection ? `
              <div class="signature-section">
                <div class="signature-inner">
                  <div class="signature-line">
                    ${settings.showDoctorName ? `<div>${doctor?.full_name || 'Doctor Name'}</div>` : ''}
                    ${settings.showLicenseNumber ? `
                      <div class="license-info">
                        ${doctor?.license_no ? `S2 No: ${doctor.license_no}` : ''}
                        ${doctor?.ptr_no ? ` | PTR: ${doctor.ptr_no}` : ''}
                      </div>
                    ` : ''}
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
            // Show paper size reminder
            var paperInfo = 'Paper size: ${paperCSS.width} x ${paperCSS.height} (${Math.round(paperWidthMM)} x ${Math.round(paperHeightMM)} mm)';
            console.log(paperInfo);
            
            // Slight delay to ensure content is rendered
            setTimeout(function() {
              window.print();
            }, 100);
            
            window.onafterprint = function() { 
              window.close(); 
            };
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

    // Wait for content to load then print
    printFrame.onload = () => {
      setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        
        // Clean up after print dialog closes
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }, 250);
    };

    // Show paper size reminder to user
    toast.info(`Paper size: ${settings.paperWidth}${settings.paperUnit} × ${settings.paperHeight}${settings.paperUnit}. Please select this size in print dialog.`, {
      duration: 5000,
    });
    
    if (onPrint) onPrint();
  };

  // Preview scale
  const previewScale = 0.45;
  const widthPx = toPixels(settings.paperWidth, settings.paperUnit) * previewScale;
  const heightPx = toPixels(settings.paperHeight, settings.paperUnit) * previewScale;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#0F766E]" />
            {title}
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
                    <div className="text-center border-b-2 border-[#0F766E] pb-2 mb-3">
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
                  
                  {settings.showPatientInfo && (
                    <div className="mb-3">
                      <div className="flex justify-between">
                        <span className="font-bold">{patient?.full_name || 'Patient Name'}</span>
                        {settings.showDate && <span>Date: {new Date().toLocaleDateString()}</span>}
                      </div>
                      {settings.showAgeSex && (
                        <div className="text-slate-600">Age: {patient?.age || 'N/A'} | Sex: {patient?.sex || 'N/A'}</div>
                      )}
                    </div>
                  )}
                  
                  {settings.showRxLabel && (
                    <div className="font-bold italic mb-2" style={{ fontSize: `${(settings.fontSize + 6) * previewScale}px` }}>Rx</div>
                  )}
                  
                  <div className="flex-grow space-y-2 ml-2">
                    {medicines.length > 0 ? medicines.map((med, idx) => (
                      <div key={idx}>
                        <div className="font-semibold">{idx + 1}. {med.name} {med.dosage || ''}</div>
                        <div className="ml-3 text-slate-600">
                          Sig: {med.sig || med.frequency || ''} {med.duration ? `for ${med.duration}` : ''}
                          {settings.showQuantity && med.quantity && <span className="ml-2">#{med.quantity}</span>}
                        </div>
                      </div>
                    )) : (
                      <div className="text-slate-400 italic">No medicines added</div>
                    )}
                  </div>
                  
                  {settings.showSignatureSection && (
                    <div className="text-right mt-auto pt-4">
                      <div className="inline-block text-center" style={{ minWidth: '100px' }}>
                        <div className="border-t border-black pt-1 mt-6">
                          {settings.showDoctorName && <div>{doctor?.full_name || 'Doctor Name'}</div>}
                          {settings.showLicenseNumber && (
                            <div className="text-slate-500" style={{ fontSize: `${(settings.fontSize - 2) * previewScale}px` }}>
                              {doctor?.license_no ? `S2: ${doctor.license_no}` : ''}
                            </div>
                          )}
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
                Print Prescription
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
                  {[
                    { key: 'showHeader', label: 'Show Header' },
                    { key: 'showPatientInfo', label: 'Show Patient Info' },
                    { key: 'showRxLabel', label: 'Show Rx Label' },
                    { key: 'showSignatureSection', label: 'Show Signature' },
                    { key: 'showFooter', label: 'Show Footer' },
                    { key: 'showDate', label: 'Show Date' },
                    { key: 'showAgeSex', label: 'Show Age/Sex' },
                    { key: 'showQuantity', label: 'Show Quantity' },
                    { key: 'showDoctorName', label: 'Show Doctor Name' },
                    { key: 'showLicenseNumber', label: 'Show License No.' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={settings[key]}
                        onCheckedChange={(checked) => updateSetting(key, checked)}
                      />
                      <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>
                
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 mt-4">
                  <strong>Tip:</strong> Turn off Header and Signature if your prescription paper already has pre-printed clinic info.
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
