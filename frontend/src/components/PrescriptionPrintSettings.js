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
  Ruler, Type, Layout, CheckSquare, Download, Upload,
  Pill, Award, Briefcase, Send, Microscope, Smartphone, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { loadPrintSettings, savePrintSettings, FORM_TYPES } from './PrintPreviewDialog';

// Paper presets
const PAPER_PRESETS = {
  '8x4': { width: 8, height: 4, unit: 'in', label: '8 × 4 inches (Prescription)' },
  '5x3': { width: 5, height: 3, unit: 'in', label: '5 × 3 inches' },
  'a5': { width: 148, height: 210, unit: 'mm', label: 'A5 (148 × 210 mm)' },
  'a6': { width: 105, height: 148, unit: 'mm', label: 'A6 (105 × 148 mm)' },
  'half-letter': { width: 5.5, height: 8.5, unit: 'in', label: 'Half Letter (5.5 × 8.5 in)' },
  'letter': { width: 8.5, height: 11, unit: 'in', label: 'Letter (8.5 × 11 in)' },
  'legal': { width: 8.5, height: 14, unit: 'in', label: 'Legal (8.5 × 14 in)' },
  'custom': { width: 8, height: 4, unit: 'in', label: 'Custom' },
};

// Form type configuration
const FORM_TYPE_CONFIG = {
  prescription: {
    label: 'Prescription',
    icon: Pill,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Settings for prescription print layout',
  },
  medical_certificate: {
    label: 'Medical Certificate',
    icon: Award,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    description: 'Settings for medical certificate print layout',
  },
  fit_to_work: {
    label: 'Fit-to-Work',
    icon: Briefcase,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    description: 'Settings for fit-to-work certificate print layout',
  },
  referral: {
    label: 'Referral Letter',
    icon: Send,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: 'Settings for referral letter print layout',
  },
  lab_request: {
    label: 'Lab/Imaging Request',
    icon: Microscope,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    description: 'Settings for laboratory and imaging request print layout',
  },
};

// Section options per form type
const getSectionOptions = (formType) => {
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

  if (formType === 'prescription') {
    return [
      ...common.slice(0, 2),
      { key: 'showRxLabel', label: 'Show Rx Label' },
      ...common.slice(2),
      { key: 'showQuantity', label: 'Show Quantity' },
    ];
  }

  if (formType === 'lab_request') {
    return [
      ...common,
      { key: 'showUrgency', label: 'Show Urgency Badge' },
    ];
  }

  return common;
};

const PrescriptionPrintSettings = ({ doctor = null, clinicSettings = {}, onUpdateClinicSettings, onSaveClinicSettings }) => {
  const [activeFormType, setActiveFormType] = useState('prescription');
  const [settings, setSettings] = useState(() => loadPrintSettings('prescription'));

  // Load settings when form type changes
  useEffect(() => {
    setSettings(loadPrintSettings(activeFormType));
  }, [activeFormType]);

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
    savePrintSettings(settings, activeFormType);
    toast.success(`${FORM_TYPE_CONFIG[activeFormType].label} settings saved`);
  };

  // Restore defaults
  const handleRestoreDefaults = () => {
    const defaultSettings = loadPrintSettings(activeFormType);
    // Clear localStorage for this form type
    localStorage.removeItem(`emr_print_settings_${activeFormType}`);
    setSettings(loadPrintSettings(activeFormType));
    toast.info('Settings restored to defaults');
  };

  // Export settings
  const exportSettings = () => {
    // Export all form type settings
    const allSettings = {};
    Object.keys(FORM_TYPE_CONFIG).forEach(type => {
      allSettings[type] = loadPrintSettings(type);
    });
    
    const dataStr = JSON.stringify(allSettings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `print-settings-all-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('All print settings exported');
  };

  // Import settings
  const importSettings = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        
        // Check if it's multi-form type format or single form type
        if (imported.prescription || imported.medical_certificate) {
          // Multi-form type format
          Object.keys(imported).forEach(type => {
            if (FORM_TYPE_CONFIG[type] && imported[type]) {
              savePrintSettings(imported[type], type);
            }
          });
          setSettings(loadPrintSettings(activeFormType));
          toast.success('All print settings imported');
        } else if (typeof imported.paperWidth === 'number') {
          // Single form type format - import to current form type
          setSettings(prev => ({ ...prev, ...imported }));
          savePrintSettings({ ...settings, ...imported }, activeFormType);
          toast.success(`Settings imported to ${FORM_TYPE_CONFIG[activeFormType].label}`);
        } else {
          toast.error('Invalid settings file format');
        }
      } catch (err) {
        toast.error('Failed to parse settings file');
        console.error('Import error:', err);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Copy settings to another form type
  const copySettingsTo = (targetFormType) => {
    savePrintSettings(settings, targetFormType);
    toast.success(`Settings copied to ${FORM_TYPE_CONFIG[targetFormType].label}`);
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

  // Preview scale
  const previewScale = 0.35;
  const widthPx = toPixels(settings.paperWidth, settings.paperUnit) * previewScale;
  const heightPx = toPixels(settings.paperHeight, settings.paperUnit) * previewScale;

  const currentConfig = FORM_TYPE_CONFIG[activeFormType];
  const IconComponent = currentConfig.icon;

  // Render preview based on form type
  const renderPreview = () => {
    const scaledFontSize = settings.fontSize * previewScale;
    
    const renderPrescriptionPreview = () => (
      <>
        {settings.showPatientInfo && (
          <div className="mb-2">
            <div className="flex justify-between">
              <span className="font-bold">Patient Name</span>
              {settings.showDate && <span style={{ fontSize: scaledFontSize }}>Date: {new Date().toLocaleDateString()}</span>}
            </div>
            {settings.showAgeSex && (
              <div className="text-slate-600" style={{ fontSize: scaledFontSize }}>Age: 35 | Sex: Male</div>
            )}
          </div>
        )}
        {settings.showRxLabel && (
          <div className="font-bold italic mb-1" style={{ fontSize: (settings.fontSize + 6) * previewScale }}>Rx</div>
        )}
        <div className="flex-grow space-y-1 ml-2">
          <div style={{ fontSize: scaledFontSize }}>
            <div className="font-semibold">1. Sample Medicine 500mg</div>
            <div className="ml-2 text-slate-600">Sig: 1 tablet 3x daily for 7 days</div>
          </div>
        </div>
      </>
    );

    const renderCertificatePreview = () => (
      <>
        <div className="text-center font-bold underline mb-2" style={{ fontSize: (settings.fontSize + 2) * previewScale }}>
          {activeFormType === 'medical_certificate' ? 'MEDICAL CERTIFICATE' : 'FIT-TO-WORK CERTIFICATE'}
        </div>
        {settings.showDate && (
          <div className="text-right mb-2" style={{ fontSize: scaledFontSize }}>Date: {new Date().toLocaleDateString()}</div>
        )}
        <div style={{ fontSize: scaledFontSize }} className="space-y-1">
          <p>To Whom It May Concern:</p>
          <p className="indent-4">This is to certify that <strong>Patient Name</strong> was examined...</p>
        </div>
      </>
    );

    const renderReferralPreview = () => (
      <>
        <div className="text-center font-bold underline mb-2" style={{ fontSize: (settings.fontSize + 2) * previewScale }}>
          REFERRAL LETTER
        </div>
        {settings.showDate && (
          <div className="text-right mb-2" style={{ fontSize: scaledFontSize }}>Date: {new Date().toLocaleDateString()}</div>
        )}
        <div style={{ fontSize: scaledFontSize }} className="space-y-1">
          <p>Dear Colleague,</p>
          <p className="indent-4">I am referring <strong>Patient Name</strong> for your expert evaluation...</p>
        </div>
      </>
    );

    const renderLabRequestPreview = () => (
      <>
        <div className="text-center font-bold underline mb-2" style={{ fontSize: (settings.fontSize + 2) * previewScale }}>
          LABORATORY REQUEST
        </div>
        {settings.showUrgency && (
          <div className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 mb-1">
            URGENT
          </div>
        )}
        <div style={{ fontSize: scaledFontSize }}>
          <div><strong>Patient:</strong> Patient Name</div>
          <div className="mt-1"><strong>Tests:</strong></div>
          <ul className="ml-3">
            <li>☐ Complete Blood Count</li>
            <li>☐ Urinalysis</li>
          </ul>
        </div>
      </>
    );

    switch (activeFormType) {
      case 'prescription':
        return renderPrescriptionPreview();
      case 'medical_certificate':
      case 'fit_to_work':
        return renderCertificatePreview();
      case 'referral':
        return renderReferralPreview();
      case 'lab_request':
        return renderLabRequestPreview();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#0F766E]" />
            Print Settings
          </CardTitle>
          <CardDescription>
            Customize print layout for each form type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Form Type Selector */}
          <div className="mb-6">
            <Label className="text-sm font-medium mb-3 block">Select Form Type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {Object.entries(FORM_TYPE_CONFIG).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveFormType(type)}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                      activeFormType === type 
                        ? `border-[#0F766E] ${config.bgColor}` 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${activeFormType === type ? config.color : 'text-slate-500'}`} />
                    <span className={`text-xs mt-1 text-center ${activeFormType === type ? 'font-medium' : ''}`}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Settings Panel */}
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${currentConfig.bgColor} border`}>
                <div className="flex items-center gap-2 mb-1">
                  <IconComponent className={`w-4 h-4 ${currentConfig.color}`} />
                  <span className="font-medium">{currentConfig.label} Settings</span>
                </div>
                <p className="text-xs text-slate-600">{currentConfig.description}</p>
              </div>

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

                  {/* Mobile/Tablet Note */}
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex gap-2">
                      <Smartphone className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p className="font-semibold mb-1">Android / Tablet Users</p>
                        <p>Mobile browsers do not support automatic custom paper sizes. To set paper size on Android or tablets:</p>
                        <ol className="list-decimal ml-4 mt-1 space-y-0.5">
                          <li>Tap <strong>Print</strong> to open the print dialog</li>
                          <li>Tap the <strong>dropdown arrow</strong> to expand options</li>
                          <li>Change <strong>"Paper size"</strong> manually to match your desired size</li>
                          <li>Adjust <strong>margins</strong> if content is cut off</li>
                        </ol>
                        <p className="mt-1 italic">Tip: You can also "Save as PDF" and print from a PDF viewer for more control.</p>
                      </div>
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
                    {getSectionOptions(activeFormType).map(({ key, label }) => (
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

                  {/* Header Customization - shown when Show Header is enabled */}
                  {settings.showHeader && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Header Content</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Header Title</Label>
                          <Input
                            value={clinicSettings.print_header_title || ''}
                            onChange={(e) => onUpdateClinicSettings?.({ ...clinicSettings, print_header_title: e.target.value })}
                            placeholder="Clinic name or title"
                            className="text-sm"
                            data-testid="print-header-title"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Subtitle / Tagline</Label>
                          <Input
                            value={clinicSettings.print_header_subtitle || ''}
                            onChange={(e) => onUpdateClinicSettings?.({ ...clinicSettings, print_header_subtitle: e.target.value })}
                            placeholder="e.g. Your Trusted Healthcare"
                            className="text-sm"
                            data-testid="print-header-subtitle"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Clinic Logo (Optional)</Label>
                          <Input
                            type="file"
                            accept="image/png,image/jpeg"
                            className="text-sm"
                            data-testid="print-header-logo-upload"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 500 * 1024) { toast.error('Logo must be under 500KB'); return; }
                                const reader = new FileReader();
                                reader.onload = (ev) => onUpdateClinicSettings?.({ ...clinicSettings, print_header_logo: ev.target.result });
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          {clinicSettings.print_header_logo && (
                            <div className="flex items-center gap-2">
                              <img src={clinicSettings.print_header_logo} alt="Logo" className="h-6 rounded" />
                              <button
                                className="text-xs text-red-500 hover:underline"
                                onClick={() => onUpdateClinicSettings?.({ ...clinicSettings, print_header_logo: '' })}
                              >Remove</button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Additional Header Text</Label>
                          <Input
                            value={clinicSettings.print_header_extra || ''}
                            onChange={(e) => onUpdateClinicSettings?.({ ...clinicSettings, print_header_extra: e.target.value })}
                            placeholder="e.g. Open Mon-Sat 8AM-5PM"
                            className="text-sm"
                            data-testid="print-header-extra"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={onSaveClinicSettings}
                        size="sm"
                        className="bg-[#0F766E] hover:bg-[#115E59]"
                        data-testid="save-header-content-btn"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Save Header Content
                      </Button>
                    </div>
                  )}
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

              {/* Action Buttons */}
              <div className="flex gap-2 mt-6 pt-4 border-t">
                <Button onClick={handleSaveSettings} className="flex-1 bg-[#0F766E] hover:bg-[#115E59]">
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </Button>
                <Button onClick={handleRestoreDefaults} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Defaults
                </Button>
              </div>

              {/* Export/Import Buttons */}
              <div className="flex gap-2 mt-3">
                <Button onClick={exportSettings} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Export All
                </Button>
                <div className="flex-1">
                  <input
                    type="file"
                    accept=".json"
                    onChange={importSettings}
                    className="hidden"
                    id="import-settings-input"
                  />
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => document.getElementById('import-settings-input').click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </Button>
                </div>
              </div>

              {/* Copy to other form types */}
              <div className="pt-4 border-t">
                <Label className="text-xs font-medium text-slate-500 mb-2 block">Copy Settings To:</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FORM_TYPE_CONFIG)
                    .filter(([type]) => type !== activeFormType)
                    .map(([type, config]) => {
                      const Icon = config.icon;
                      return (
                        <Button
                          key={type}
                          variant="outline"
                          size="sm"
                          onClick={() => copySettingsTo(type)}
                          className="text-xs"
                        >
                          <Icon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Live Preview</span>
              </div>

              <div className="flex justify-center p-4 bg-slate-100 rounded-lg min-h-[400px] overflow-auto">
                <div 
                  className="bg-white border shadow-lg relative"
                  style={{ 
                    width: `${Math.min(widthPx, 320)}px`, 
                    minHeight: `${Math.min(heightPx, 400)}px`,
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
                        {clinicSettings.print_header_logo && (
                          <img src={clinicSettings.print_header_logo} alt="Logo" className="mx-auto mb-1" style={{ height: `${12 * previewScale}px` }} />
                        )}
                        <div className="font-bold text-[#0F766E]" style={{ fontSize: `${(settings.fontSize + 4) * previewScale}px` }}>
                          {clinicSettings.print_header_title || clinicSettings.clinic_name || 'Medical Clinic'}
                        </div>
                        {clinicSettings.print_header_subtitle && (
                          <div className="text-slate-500 italic" style={{ fontSize: `${(settings.fontSize - 2) * previewScale}px` }}>
                            {clinicSettings.print_header_subtitle}
                          </div>
                        )}
                        {clinicSettings.address && (
                          <div className="text-slate-500" style={{ fontSize: `${(settings.fontSize - 2) * previewScale}px` }}>
                            {clinicSettings.address}
                          </div>
                        )}
                        {clinicSettings.phone && (
                          <div className="text-slate-500" style={{ fontSize: `${(settings.fontSize - 2) * previewScale}px` }}>
                            Tel: {clinicSettings.phone}
                          </div>
                        )}
                        {clinicSettings.email && (
                          <div className="text-slate-500" style={{ fontSize: `${(settings.fontSize - 2) * previewScale}px` }}>
                            Email: {clinicSettings.email}
                          </div>
                        )}
                        {clinicSettings.print_header_extra && (
                          <div className="text-slate-400" style={{ fontSize: `${(settings.fontSize - 3) * previewScale}px` }}>
                            {clinicSettings.print_header_extra}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {renderPreview()}
                    
                    {settings.showSignatureSection && (
                      <div className="text-right mt-auto pt-3">
                        <div className="inline-block text-center" style={{ minWidth: '80px' }}>
                          <div className="border-t border-black pt-1 mt-4">
                            {settings.showDoctorName && (
                              <div style={{ fontSize: `${settings.fontSize * previewScale}px` }}>
                                {doctor?.full_name || 'Doctor Name'}
                              </div>
                            )}
                            <div className="text-slate-500" style={{ fontSize: `${(settings.fontSize - 2) * previewScale}px` }}>
                              {settings.showPrcNo && <div>PRC: {doctor?.prc_no || '12345'}</div>}
                              {settings.showPtrNo && <div>PTR: {doctor?.ptr_no || '67890'}</div>}
                              {settings.showS2No && <div>S2: {doctor?.license_no || '11111'}</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {settings.showFooter && (
                      <div 
                        className="text-center text-slate-400 border-t pt-1 mt-2"
                        style={{ fontSize: `${(settings.fontSize - 4) * previewScale}px` }}
                      >
                        Printed from Private Clinic EMR
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <strong>Paper Size:</strong> {settings.paperWidth}{settings.paperUnit} × {settings.paperHeight}{settings.paperUnit}
                <br />
                <strong>Tip:</strong> Changes are applied when you click "Save Settings"
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrescriptionPrintSettings;
