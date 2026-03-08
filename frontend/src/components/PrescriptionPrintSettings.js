import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Printer, Settings, Eye, RotateCcw, Save, FileText, 
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
  'custom': { width: 8, height: 4, unit: 'in', label: 'Custom' },
};

const STORAGE_KEY = 'emr_prescription_print_settings';

const PrescriptionPrintSettings = ({ 
  prescription = null, 
  patient = null, 
  doctor = null,
  onClose = null,
  isModal = false 
}) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('paper');

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error('Failed to parse saved settings:', e);
      }
    }
  }, []);

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

  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast.success('Print settings saved');
  };

  // Restore default settings
  const restoreDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
    toast.info('Settings restored to defaults');
  };

  // Convert units to pixels for preview (approximate)
  const toPixels = (value, unit) => {
    switch (unit) {
      case 'in': return value * 96;
      case 'cm': return value * 37.8;
      case 'mm': return value * 3.78;
      default: return value;
    }
  };

  // Get paper dimensions in CSS
  const getPaperCSS = () => {
    return {
      width: `${settings.paperWidth}${settings.paperUnit}`,
      height: `${settings.paperHeight}${settings.paperUnit}`,
    };
  };

  // Print prescription
  const handlePrint = () => {
    if (!prescription || !prescription.medicines || prescription.medicines.length === 0) {
      toast.error('No prescription to print.');
      return;
    }

    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print');
      return;
    }

    const paperCSS = getPaperCSS();
    
    // Generate medicines HTML
    const medicinesHTML = prescription.medicines.map((med, idx) => `
      <div class="medicine-item" style="margin-bottom: ${settings.sectionSpacing}px;">
        <div class="medicine-name" style="font-weight: 600;">${idx + 1}. ${med.name} ${med.dosage || ''}</div>
        <div class="medicine-sig" style="margin-left: 20px; color: #444;">
          Sig: ${med.sig || med.instructions || 'As directed'}
          ${settings.showQuantity && med.quantity ? `<span style="margin-left: 20px;">#${med.quantity}</span>` : ''}
        </div>
      </div>
    `).join('');

    // Generate print HTML
    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription - ${patient?.full_name || 'Patient'}</title>
        <style>
          /* Reset */
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          /* Page setup */
          @page {
            size: ${paperCSS.width} ${paperCSS.height};
            margin: 0;
          }
          
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: ${settings.fontSize}px;
            line-height: ${settings.lineSpacing};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* Prescription container */
          .prescription-print-container {
            width: ${paperCSS.width};
            height: ${paperCSS.height};
            padding-top: ${settings.topOffset}px;
            padding-left: ${settings.leftOffset}px;
            padding-right: ${settings.rightOffset}px;
            padding-bottom: ${settings.bottomOffset}px;
            display: flex;
            flex-direction: column;
          }
          
          .content-area {
            max-width: ${settings.contentWidth}px;
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          
          .medicines-list {
            flex-grow: 1;
            margin-left: 10px;
          }
          
          /* Header section */
          .header-section {
            text-align: center;
            margin-bottom: ${settings.sectionSpacing * 2}px;
            border-bottom: 1px solid #333;
            padding-bottom: ${settings.sectionSpacing}px;
          }
          
          .clinic-name {
            font-size: ${settings.fontSize + 4}px;
            font-weight: bold;
          }
          
          .doctor-name-header {
            font-size: ${settings.fontSize + 2}px;
            font-weight: 600;
          }
          
          .clinic-address {
            font-size: ${settings.fontSize - 2}px;
            color: #555;
          }
          
          /* Patient info */
          .patient-info {
            margin-bottom: ${settings.sectionSpacing * 1.5}px;
          }
          
          .patient-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          
          .patient-name {
            font-weight: 600;
          }
          
          /* Rx section */
          .rx-section {
            margin-bottom: ${settings.sectionSpacing}px;
          }
          
          .rx-symbol {
            font-size: ${settings.fontSize + 8}px;
            font-weight: bold;
            font-style: italic;
            margin-bottom: ${settings.sectionSpacing}px;
          }
          
          /* Medicines */
          .medicines-list {
            margin-left: 10px;
          }
          
          .medicine-item {
            margin-bottom: ${settings.sectionSpacing}px;
          }
          
          /* Signature section */
          .signature-section {
            text-align: right;
            margin-top: auto;
            padding-top: ${settings.sectionSpacing}px;
          }
          
          .signature-inner {
            display: inline-block;
            text-align: center;
            min-width: 200px;
          }
          
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 30px;
            padding-top: 5px;
          }
          
          .license-info {
            font-size: ${settings.fontSize - 2}px;
            color: #555;
          }
          
          /* Footer */
          .footer-section {
            font-size: ${settings.fontSize - 4}px;
            color: #777;
            margin-top: ${settings.sectionSpacing}px;
          }
          
          @media print {
            body { margin: 0; }
            .prescription-print-container { 
              page-break-after: always;
            }
          }
        </style>
      </head>
      <body>
        <div class="prescription-print-container">
          <div class="content-area">
            ${settings.showHeader ? `
              <div class="header-section">
                <div class="clinic-name">${doctor?.clinic_name || 'Medical Clinic'}</div>
                <div class="doctor-name-header">${doctor?.full_name || 'Doctor'}</div>
                <div class="clinic-address">${doctor?.clinic_address || ''}</div>
              </div>
            ` : ''}
            
            ${settings.showPatientInfo ? `
              <div class="patient-info">
                <div class="patient-row">
                  <span class="patient-name">${patient?.full_name || 'Patient Name'}</span>
                  ${settings.showDate ? `<span class="date">Date: ${new Date().toLocaleDateString()}</span>` : ''}
                </div>
                ${settings.showAgeSex ? `
                  <div class="patient-row">
                    <span>Age: ${patient?.age || 'N/A'} | Sex: ${patient?.sex || 'N/A'}</span>
                    <span>${patient?.address || ''}</span>
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
                        ${doctor?.license_no ? `Lic. No.: ${doctor.license_no}` : ''}
                        ${doctor?.ptr_no ? ` | PTR: ${doctor.ptr_no}` : ''}
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            ` : ''}
            
            ${settings.showFooter ? `
              <div class="footer-section">
                Printed from Private Clinic EMR
              </div>
            ` : ''}
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
  };

  // Preview component
  const PreviewPanel = () => {
    const previewScale = 0.5;
    const widthPx = toPixels(settings.paperWidth, settings.paperUnit) * previewScale;
    const heightPx = toPixels(settings.paperHeight, settings.paperUnit) * previewScale;

    return (
      <div className="border rounded-lg p-4 bg-slate-50">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Live Preview
        </h4>
        <div 
          className="bg-white border shadow-sm mx-auto overflow-hidden relative"
          style={{ 
            width: `${Math.min(widthPx, 350)}px`, 
            height: `${Math.min(heightPx, 450)}px`,
            fontSize: `${settings.fontSize * previewScale}px`,
            lineHeight: settings.lineSpacing,
          }}
        >
          <div 
            className="h-full flex flex-col"
            style={{ 
              paddingTop: `${settings.topOffset * previewScale}px`,
              paddingLeft: `${settings.leftOffset * previewScale}px`,
              paddingRight: `${settings.rightOffset * previewScale}px`,
              paddingBottom: `${settings.bottomOffset * previewScale}px`,
            }}
          >
            {settings.showHeader && (
              <div className="text-center border-b pb-1 mb-2">
                <div className="font-bold" style={{ fontSize: `${(settings.fontSize + 2) * previewScale}px` }}>
                  Medical Clinic
                </div>
                <div style={{ fontSize: `${(settings.fontSize - 2) * previewScale}px` }}>
                  Doctor Name, MD
                </div>
              </div>
            )}
            
            {settings.showPatientInfo && (
              <div className="mb-2">
                <div className="flex justify-between">
                  <span className="font-semibold">{patient?.full_name || 'Patient Name'}</span>
                  {settings.showDate && <span>Date: {new Date().toLocaleDateString()}</span>}
                </div>
                {settings.showAgeSex && (
                  <div className="text-slate-600">Age: 35 | Sex: Male</div>
                )}
              </div>
            )}
            
            {settings.showRxLabel && (
              <div className="font-bold italic text-lg mb-2">Rx</div>
            )}
            
            <div className="space-y-1 flex-grow">
              <div>
                <div className="font-semibold">1. Amoxicillin 500mg</div>
                <div className="ml-3 text-slate-600">Sig: 1 cap TID x 7 days {settings.showQuantity && '#21'}</div>
              </div>
              <div>
                <div className="font-semibold">2. Paracetamol 500mg</div>
                <div className="ml-3 text-slate-600">Sig: 1 tab q4h PRN {settings.showQuantity && '#10'}</div>
              </div>
            </div>
            
            {settings.showSignatureSection && (
              <div className="text-right mt-auto pt-2">
                <div className="inline-block text-center" style={{ minWidth: '80px' }}>
                  <div className="border-t border-black pt-1">
                    {settings.showDoctorName && <div className="text-xs">Doctor Name, MD</div>}
                    {settings.showLicenseNumber && (
                      <div style={{ fontSize: `${Math.max((settings.fontSize - 4) * previewScale, 6)}px` }}>
                        Lic. No.: 12345
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 text-center mt-2">
          Preview at {Math.round(previewScale * 100)}% scale
        </p>
      </div>
    );
  };

  return (
    <div className={isModal ? '' : 'space-y-6'}>
      <Card className="bg-white border-slate-100 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="font-heading flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#0F766E]" />
            Prescription Print Settings
          </CardTitle>
          <CardDescription>
            Customize paper size, layout, and visibility options for prescription printing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Settings Panel */}
            <div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="paper" className="text-xs">
                    <Ruler className="w-3 h-3 mr-1" />
                    Paper
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="text-xs">
                    <Layout className="w-3 h-3 mr-1" />
                    Layout
                  </TabsTrigger>
                  <TabsTrigger value="visibility" className="text-xs">
                    <CheckSquare className="w-3 h-3 mr-1" />
                    Sections
                  </TabsTrigger>
                  <TabsTrigger value="typography" className="text-xs">
                    <Type className="w-3 h-3 mr-1" />
                    Text
                  </TabsTrigger>
                </TabsList>

                {/* Paper Size Tab */}
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

                {/* Layout Tab */}
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

                {/* Visibility Tab */}
                <TabsContent value="visibility" className="space-y-3">
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

                {/* Typography Tab */}
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

              {/* Action Buttons */}
              <div className="flex gap-2 mt-6 pt-4 border-t">
                <Button onClick={saveSettings} className="flex-1 bg-[#0F766E] hover:bg-[#115E59]">
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </Button>
                <Button onClick={restoreDefaults} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Defaults
                </Button>
              </div>
              
              {prescription && (
                <Button onClick={handlePrint} className="w-full mt-3 bg-blue-600 hover:bg-blue-700">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Prescription
                </Button>
              )}
            </div>

            {/* Preview Panel */}
            <PreviewPanel />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrescriptionPrintSettings;
