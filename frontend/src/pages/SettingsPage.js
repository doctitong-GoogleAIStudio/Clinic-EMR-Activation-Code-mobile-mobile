import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { settingsAPI, userAPI, auditAPI, exportAPI, authAPI, importAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Settings, Building, Users, FileText, Shield, Save, 
  Plus, Download, Clock, User, Edit, Info, Stethoscope, Heart, Code, UserPlus,
  Sparkles, Microscope, Calendar, Upload, Smartphone, Brain, ScanText, FolderOpen, GitCompare, Printer, Trash2, Key, Eye, EyeOff, Lock, BookOpen, FileUp, AlertCircle, CheckCircle2, Mic, RotateCcw, ShieldCheck
} from 'lucide-react';
import UserGuidePage from './UserGuidePage';
import PrescriptionPrintSettings from '../components/PrescriptionPrintSettings';
import RestoreBackupDialog from '../components/RestoreBackupDialog';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { getErrorMessage } from '../lib/utils';

const SettingsPage = () => {
  const { user, isAdmin, isDoctor, refreshUser } = useAuth();
  const [receptionistForm, setReceptionistForm] = useState({ full_name: '', email: '', password: '' });
  const [creatingReceptionist, setCreatingReceptionist] = useState(false);
  const [myReceptionists, setMyReceptionists] = useState([]);
  const [editingReceptionist, setEditingReceptionist] = useState(null);
  const [editReceptionistForm, setEditReceptionistForm] = useState({ full_name: '', email: '', password: '' });
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [settings, setSettings] = useState({
    clinic_name: '',
    address: '',
    phone: '',
    email: '',
    license_no: '',
    ptr_no: '',
    prc_no: '',
    specialization: '',
    // Print Header customization
    print_header_title: '',
    print_header_subtitle: '',
    print_header_logo: '',
    print_header_extra: ''
  });
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewUser, setShowNewUser] = useState(false);
  // Import state
  const [importingPatients, setImportingPatients] = useState(false);
  const [importingVisits, setImportingVisits] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showRestore, setShowRestore] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'receptionist',
    license_no: '',
    ptr_no: '',
    prc_no: '',
    specialization: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsRes, usersRes, auditRes, receptionistsRes] = await Promise.all([
        settingsAPI.get(),
        isAdmin ? userAPI.getAll() : Promise.resolve({ data: [] }),
        isAdmin ? auditAPI.getAll(50) : Promise.resolve({ data: [] }),
        (isDoctor || isAdmin) ? userAPI.getMyReceptionists() : Promise.resolve({ data: [] })
      ]);
      setSettings(settingsRes.data);
      setUsers(usersRes.data);
      setAuditLogs(auditRes.data);
      setMyReceptionists(receptionistsRes.data);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load settings'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await settingsAPI.update(settings);
      // Refresh user data to ensure auth context has updated credentials
      if (refreshUser) {
        await refreshUser();
      }
      toast.success('Settings saved');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save settings'));
    }
  };

  const handleCreateUser = async () => {
    try {
      await userAPI.create(newUser);
      toast.success('User created');
      setShowNewUser(false);
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        role: 'receptionist',
        license_no: '',
        ptr_no: '',
        prc_no: '',
        specialization: ''
      });
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create user'));
    }
  };

  const handleCreateReceptionist = async () => {
    if (!receptionistForm.full_name || !receptionistForm.email || !receptionistForm.password) {
      toast.error('Please fill in all fields');
      return;
    }
    setCreatingReceptionist(true);
    try {
      await userAPI.createReceptionist(receptionistForm);
      toast.success('Receptionist account created');
      setReceptionistForm({ full_name: '', email: '', password: '' });
      fetchData(); // Refresh to show new receptionist
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create receptionist'));
    } finally {
      setCreatingReceptionist(false);
    }
  };

  const handleEditReceptionist = (receptionist) => {
    setEditingReceptionist(receptionist);
    setEditReceptionistForm({
      full_name: receptionist.full_name,
      email: receptionist.email,
      password: '' // Empty - only update if user enters new password
    });
  };

  const handleUpdateReceptionist = async () => {
    if (!editReceptionistForm.full_name || !editReceptionistForm.email) {
      toast.error('Name and email are required');
      return;
    }
    try {
      await userAPI.update(editingReceptionist.id, editReceptionistForm);
      toast.success('Receptionist updated');
      setEditingReceptionist(null);
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update receptionist'));
    }
  };

  const handleDeleteReceptionist = async (receptionist) => {
    if (!window.confirm(`Are you sure you want to delete ${receptionist.full_name}'s account? This cannot be undone.`)) {
      return;
    }
    try {
      await userAPI.delete(receptionist.id);
      toast.success('Receptionist account deleted');
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete receptionist'));
    }
  };

  // Password strength checker
  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, text: '', color: '' };
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    if (strength <= 1) return { strength: 1, text: 'Weak', color: 'bg-red-500' };
    if (strength <= 2) return { strength: 2, text: 'Fair', color: 'bg-orange-500' };
    if (strength <= 3) return { strength: 3, text: 'Good', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength: 4, text: 'Strong', color: 'bg-green-500' };
    return { strength: 5, text: 'Very Strong', color: 'bg-emerald-500' };
  };

  const handleChangePassword = async () => {
    // Validation
    if (!passwordForm.current_password) {
      toast.error('Please enter your current password');
      return;
    }
    if (!passwordForm.new_password) {
      toast.error('Please enter a new password');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New password and confirmation do not match');
      return;
    }
    
    setChangingPassword(true);
    try {
      await authAPI.changePassword(passwordForm);
      toast.success('Password changed successfully! Please login again with your new password.');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to change password'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExportPatients = async (exportFormat = 'json') => {
    try {
      toast.info(`Preparing ${exportFormat.toUpperCase()} export...`);
      const response = await exportAPI.patients();
      const data = response.data.data || response.data;
      
      if (exportFormat === 'csv') {
        if (!data || data.length === 0) {
          toast.error('No patient data to export');
          return;
        }
        const headers = ['Full Name', 'Date of Birth', 'Gender', 'Phone', 'Email', 'Address', 'Blood Type', 'Emergency Contact', 'Emergency Phone', 'Created At'];
        const csvRows = [headers.join(',')];
        data.forEach(p => {
          const row = [
            `"${p.full_name || ''}"`,
            p.date_of_birth || '',
            p.gender || '',
            `"${p.phone || ''}"`,
            `"${p.email || ''}"`,
            `"${(p.address || '').replace(/"/g, '""')}"`,
            p.blood_type || '',
            `"${p.emergency_contact || ''}"`,
            `"${p.emergency_phone || ''}"`,
            p.created_at || ''
          ];
          csvRows.push(row.join(','));
        });
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `patient_registry_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `patient_registry_${format(new Date(), 'yyyy-MM-dd')}.json`;
        a.click();
      }
      toast.success(`Patient registry exported as ${exportFormat.toUpperCase()}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to export patients'));
    }
  };

  const handleExportVisits = async (exportFormat = 'json') => {
    try {
      toast.info(`Preparing ${exportFormat.toUpperCase()} export...`);
      const response = await exportAPI.visits({});
      const data = response.data.data || response.data;
      
      if (exportFormat === 'csv') {
        if (!data || data.length === 0) {
          toast.error('No visit data to export');
          return;
        }
        const headers = ['Patient Name', 'Visit Date', 'Chief Complaint', 'Subjective', 'Objective', 'Assessment', 'Plan', 'Diagnosis', 'ICD10 Code', 'Notes'];
        const csvRows = [headers.join(',')];
        data.forEach(v => {
          const row = [
            `"${v.patient_name || ''}"`,
            v.created_at || '',
            `"${(v.chief_complaint || '').replace(/"/g, '""')}"`,
            `"${(v.soap_subjective || '').replace(/"/g, '""')}"`,
            `"${(v.soap_objective || '').replace(/"/g, '""')}"`,
            `"${(v.soap_assessment || '').replace(/"/g, '""')}"`,
            `"${(v.soap_plan || '').replace(/"/g, '""')}"`,
            `"${(v.diagnosis || '').replace(/"/g, '""')}"`,
            `"${v.icd10_code || ''}"`,
            `"${(v.notes || '').replace(/"/g, '""')}"`
          ];
          csvRows.push(row.join(','));
        });
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `visit_records_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `visit_records_${format(new Date(), 'yyyy-MM-dd')}.json`;
        a.click();
      }
      toast.success(`Visit records exported as ${exportFormat.toUpperCase()}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to export visits'));
    }
  };

  const roleColors = {
    admin: 'bg-purple-100 text-purple-800',
    doctor: 'bg-blue-100 text-blue-800',
    receptionist: 'bg-emerald-100 text-emerald-800'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 font-body">Manage clinic settings and users</p>
      </div>

      <Tabs defaultValue="clinic" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="clinic" data-testid="tab-clinic">
            <Building className="w-4 h-4 mr-2" />
            Clinic
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="users" data-testid="tab-users">
                <Users className="w-4 h-4 mr-2" />
                Users
              </TabsTrigger>
            </>
          )}
          {(isAdmin || isDoctor) && (
            <TabsTrigger value="exports" data-testid="tab-exports">
              <Download className="w-4 h-4 mr-2" />
              Exports
            </TabsTrigger>
          )}
          {(isAdmin || isDoctor) && (
            <TabsTrigger value="imports" data-testid="tab-imports">
              <FileUp className="w-4 h-4 mr-2" />
              Imports
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="audit" data-testid="tab-audit">
              <Shield className="w-4 h-4 mr-2" />
              Audit Log
            </TabsTrigger>
          )}
          <TabsTrigger value="about" data-testid="tab-about">
            <Info className="w-4 h-4 mr-2" />
            About
          </TabsTrigger>
          <TabsTrigger value="guide" data-testid="tab-guide">
            <BookOpen className="w-4 h-4 mr-2" />
            User Guide
          </TabsTrigger>
          {(isAdmin || isDoctor) && (
            <TabsTrigger value="print-settings" data-testid="tab-print-settings">
              <Printer className="w-4 h-4 mr-2" />
              Print Settings
            </TabsTrigger>
          )}
        </TabsList>

        {/* Clinic Settings */}
        <TabsContent value="clinic">
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Building className="w-5 h-5 text-[#0F766E]" />
                Clinic Information
              </CardTitle>
              <CardDescription>
                This information appears on printed forms (prescriptions, certificates)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Clinic Name</Label>
                  <Input
                    value={settings.clinic_name}
                    onChange={(e) => setSettings({ ...settings, clinic_name: e.target.value })}
                    placeholder="Private Clinic EMR"
                    data-testid="clinic-name-input"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={settings.address}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    placeholder="123 Medical Center, City"
                    rows={2}
                    data-testid="clinic-address-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    placeholder="(02) 1234-5678"
                    data-testid="clinic-phone-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    placeholder="clinic@email.com"
                    data-testid="clinic-email-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>S2 No.</Label>
                  <Input
                    value={settings.license_no}
                    onChange={(e) => setSettings({ ...settings, license_no: e.target.value })}
                    placeholder="License #"
                    data-testid="clinic-license-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PTR No.</Label>
                  <Input
                    value={settings.ptr_no}
                    onChange={(e) => setSettings({ ...settings, ptr_no: e.target.value })}
                    placeholder="PTR No."
                    data-testid="clinic-ptr-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PRC No.</Label>
                  <Input
                    value={settings.prc_no}
                    onChange={(e) => setSettings({ ...settings, prc_no: e.target.value })}
                    placeholder="PRC No."
                    data-testid="clinic-prc-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Specialization</Label>
                  <Input
                    value={settings.specialization}
                    onChange={(e) => setSettings({ ...settings, specialization: e.target.value })}
                    placeholder="e.g. General Practice, Internal Medicine"
                    data-testid="clinic-specialization-input"
                  />
                </div>
              </div>
              <div className="pt-4 border-t">
                <Button onClick={handleSaveSettings} className="bg-[#0F766E] hover:bg-[#115E59]" data-testid="save-settings-btn">
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Print Header Customization */}
          <Card className="bg-white border-slate-100 shadow-sm mt-6">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#0F766E]" />
                Print Header Customization
              </CardTitle>
              <CardDescription>Customize the header that appears on printed forms (Prescriptions, Certificates, Lab Requests)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Header Title</Label>
                  <Input
                    value={settings.print_header_title}
                    onChange={(e) => setSettings({ ...settings, print_header_title: e.target.value })}
                    placeholder="Leave empty to use Clinic Name"
                    data-testid="print-header-title-input"
                  />
                  <p className="text-xs text-slate-500">Main title on printed forms. Leave blank to use clinic name.</p>
                </div>
                <div className="space-y-2">
                  <Label>Subtitle / Tagline</Label>
                  <Input
                    value={settings.print_header_subtitle}
                    onChange={(e) => setSettings({ ...settings, print_header_subtitle: e.target.value })}
                    placeholder="e.g. Your Trusted Healthcare Partner"
                    data-testid="print-header-subtitle-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clinic Logo (Optional)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 500000) {
                            toast.error('Logo file must be less than 500KB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setSettings({ ...settings, print_header_logo: reader.result });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="flex-1"
                      data-testid="print-header-logo-input"
                    />
                    {settings.print_header_logo && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSettings({ ...settings, print_header_logo: '' })}
                        className="text-red-500 hover:text-red-600"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Upload your clinic logo (PNG, JPG - max 500KB)</p>
                  {settings.print_header_logo && (
                    <div className="mt-2 p-2 bg-slate-100 rounded inline-block">
                      <img 
                        src={settings.print_header_logo} 
                        alt="Logo preview" 
                        className="h-10"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Additional Header Text</Label>
                  <Input
                    value={settings.print_header_extra}
                    onChange={(e) => setSettings({ ...settings, print_header_extra: e.target.value })}
                    placeholder="e.g. Open Mon-Sat 8AM-5PM"
                    data-testid="print-header-extra-input"
                  />
                </div>
              </div>
              
              {/* Print Header Preview */}
              <div className="mt-6 p-4 border rounded-lg bg-slate-50">
                <p className="text-xs text-slate-500 mb-3">Preview:</p>
                <div className="text-center border-b-2 border-[#0F766E] pb-4 bg-white p-4 rounded">
                  {settings.print_header_logo && (
                    <img 
                      src={settings.print_header_logo} 
                      alt="Clinic Logo" 
                      className="h-12 mx-auto mb-2"
                    />
                  )}
                  <h1 className="text-xl font-bold text-[#0F766E]">
                    {settings.print_header_title || settings.clinic_name || 'Clinic Name'}
                  </h1>
                  {settings.print_header_subtitle && (
                    <p className="text-sm text-slate-600 italic">{settings.print_header_subtitle}</p>
                  )}
                  {settings.address && <p className="text-sm text-slate-600">{settings.address}</p>}
                  {settings.phone && <p className="text-sm text-slate-600">Tel: {settings.phone}</p>}
                  {settings.print_header_extra && (
                    <p className="text-xs text-slate-500 mt-1">{settings.print_header_extra}</p>
                  )}
                </div>
              </div>
              
              <div className="pt-4 border-t mt-4">
                <Button onClick={handleSaveSettings} className="bg-[#0F766E] hover:bg-[#115E59]">
                  <Save className="w-4 h-4 mr-2" />
                  Save Header Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Section */}
          <Card className="bg-white border-slate-100 shadow-sm mt-6">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#0F766E]" />
                Change Password
              </CardTitle>
              <CardDescription>Update your account password. You'll need to login again after changing.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                      placeholder="Enter current password"
                      data-testid="current-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      placeholder="Enter new password (min 8 characters)"
                      data-testid="new-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Password strength meter */}
                  {passwordForm.new_password && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded ${
                              level <= getPasswordStrength(passwordForm.new_password).strength
                                ? getPasswordStrength(passwordForm.new_password).color
                                : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        Password strength: {getPasswordStrength(passwordForm.new_password).text}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      placeholder="Confirm new password"
                      data-testid="confirm-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                  {passwordForm.confirm_password && passwordForm.new_password === passwordForm.confirm_password && (
                    <p className="text-xs text-green-600">Passwords match ✓</p>
                  )}
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password}
                    className="bg-[#0F766E] hover:bg-[#115E59]"
                    data-testid="change-password-btn"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    {changingPassword ? 'Changing...' : 'Change Password'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })}
                    disabled={changingPassword}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Create Receptionist - visible to doctors and admins */}
          {(isDoctor || isAdmin) && (
            <Card className="bg-white border-slate-100 shadow-sm mt-6">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#0F766E]" />
                  Create Receptionist Account
                </CardTitle>
                <CardDescription>Add a receptionist who can register patients and manage appointments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={receptionistForm.full_name}
                      onChange={(e) => setReceptionistForm({ ...receptionistForm, full_name: e.target.value })}
                      placeholder="e.g. Maria Santos"
                      data-testid="receptionist-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={receptionistForm.email}
                      onChange={(e) => setReceptionistForm({ ...receptionistForm, email: e.target.value })}
                      placeholder="receptionist@clinic.com"
                      data-testid="receptionist-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={receptionistForm.password}
                      onChange={(e) => setReceptionistForm({ ...receptionistForm, password: e.target.value })}
                      placeholder="Set a password"
                      data-testid="receptionist-password-input"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    onClick={handleCreateReceptionist}
                    disabled={creatingReceptionist}
                    className="bg-[#0F766E] hover:bg-[#115E59]"
                    data-testid="create-receptionist-btn"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {creatingReceptionist ? 'Creating...' : 'Create Receptionist'}
                  </Button>
                </div>

                {/* List of My Receptionists */}
                {myReceptionists.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#0F766E]" />
                      My Receptionists ({myReceptionists.length})
                    </h3>
                    <div className="space-y-3">
                      {myReceptionists.map((rec) => (
                        <div 
                          key={rec.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{rec.full_name}</p>
                            <p className="text-sm text-slate-500">{rec.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditReceptionist(rec)}
                              className="text-[#0F766E] hover:bg-[#0F766E]/10"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteReceptionist(rec)}
                              className="text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edit Receptionist Dialog */}
                <Dialog open={!!editingReceptionist} onOpenChange={(open) => !open && setEditingReceptionist(null)}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Edit Receptionist</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={editReceptionistForm.full_name}
                          onChange={(e) => setEditReceptionistForm({ ...editReceptionistForm, full_name: e.target.value })}
                          placeholder="Full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={editReceptionistForm.email}
                          onChange={(e) => setEditReceptionistForm({ ...editReceptionistForm, email: e.target.value })}
                          placeholder="Email address"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Key className="w-4 h-4" />
                          New Password (leave blank to keep current)
                        </Label>
                        <Input
                          type="password"
                          value={editReceptionistForm.password}
                          onChange={(e) => setEditReceptionistForm({ ...editReceptionistForm, password: e.target.value })}
                          placeholder="Enter new password"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setEditingReceptionist(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleUpdateReceptionist}
                          className="bg-[#0F766E] hover:bg-[#115E59]"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        {isAdmin && (
          <TabsContent value="users">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-heading flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#0F766E]" />
                    User Management
                  </CardTitle>
                  <CardDescription>{users.length} registered users</CardDescription>
                </div>
                <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#F97316] hover:bg-[#EA580C]" data-testid="add-user-btn">
                      <Plus className="w-4 h-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2 col-span-2">
                          <Label>Full Name</Label>
                          <Input
                            value={newUser.full_name}
                            onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                            placeholder="Dr. Juan Santos"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                            placeholder="user@clinic.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Password</Label>
                          <Input
                            type="password"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            placeholder="••••••••"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="doctor">Doctor</SelectItem>
                              <SelectItem value="receptionist">Receptionist</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Specialization</Label>
                          <Input
                            value={newUser.specialization}
                            onChange={(e) => setNewUser({ ...newUser, specialization: e.target.value })}
                            placeholder="Internal Medicine"
                          />
                        </div>
                      </div>
                      {newUser.role === 'doctor' && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label>S2 No.</Label>
                            <Input
                              value={newUser.license_no}
                              onChange={(e) => setNewUser({ ...newUser, license_no: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>PTR No.</Label>
                            <Input
                              value={newUser.ptr_no}
                              onChange={(e) => setNewUser({ ...newUser, ptr_no: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>PRC No.</Label>
                            <Input
                              value={newUser.prc_no}
                              onChange={(e) => setNewUser({ ...newUser, prc_no: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                      <Button onClick={handleCreateUser} className="w-full bg-[#0F766E] hover:bg-[#115E59]">
                        Create User
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-200"
                      data-testid={`user-${u.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#0F766E]/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-[#0F766E]" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{u.full_name}</p>
                          <p className="text-sm text-slate-500">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={roleColors[u.role]}>{u.role}</Badge>
                        {u.specialization && (
                          <Badge variant="outline" className="text-slate-600">{u.specialization}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Exports - visible to admins and doctors */}
        {(isAdmin || isDoctor) && (
          <TabsContent value="exports">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Download className="w-5 h-5 text-[#0F766E]" />
                  Data Export
                </CardTitle>
                <CardDescription>Export your clinic data for backup or reporting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Patient Registry Export */}
                <div className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900 flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#0F766E]" />
                        Patient Registry
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">Export all your patient records including demographics and contact info</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" onClick={() => handleExportPatients('json')} data-testid="export-patients-json-btn">
                      <Download className="w-4 h-4 mr-2" />
                      Export JSON
                    </Button>
                    <Button variant="outline" onClick={() => handleExportPatients('csv')} data-testid="export-patients-csv-btn">
                      <FileText className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>

                {/* Visit Records Export */}
                <div className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900 flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-[#0F766E]" />
                        Visit Records
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">Export all consultation records including SOAP notes and diagnoses</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" onClick={() => handleExportVisits('json')} data-testid="export-visits-json-btn">
                      <Download className="w-4 h-4 mr-2" />
                      Export JSON
                    </Button>
                    <Button variant="outline" onClick={() => handleExportVisits('csv')} data-testid="export-visits-csv-btn">
                      <FileText className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-4">
                  Note: Exports contain only your own data. JSON format preserves all data structure, CSV is compatible with Excel/Sheets.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Imports - visible to admins and doctors */}
        {(isAdmin || isDoctor) && (
          <TabsContent value="imports">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <FileUp className="w-5 h-5 text-[#0F766E]" />
                  Data Import
                </CardTitle>
                <CardDescription>Import patient and visit data from JSON files</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Import Result Display */}
                {importResult && (
                  <div className={`p-4 rounded-lg border ${importResult.failed > 0 ? 'bg-amber-50 border-amber-200' : importResult.warnings?.length > 0 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {importResult.failed > 0 ? (
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                      <span className="font-medium">
                        Import Complete: {importResult.success} successful, {importResult.failed} failed
                        {importResult.warnings?.length > 0 && `, ${importResult.warnings.length} with warnings`}
                      </span>
                    </div>
                    {importResult.warnings && importResult.warnings.length > 0 && (
                      <div className="mt-2 max-h-48 overflow-y-auto">
                        <p className="text-sm text-amber-700 font-medium mb-1">Warnings (patient not matched):</p>
                        {importResult.warnings.map((warn, idx) => (
                          <p key={idx} className="text-xs text-amber-600 break-words">{warn}</p>
                        ))}
                      </div>
                    )}
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        <p className="text-sm text-amber-700 font-medium mb-1">Errors:</p>
                        {importResult.errors.map((err, idx) => (
                          <p key={idx} className="text-xs text-amber-600">{err}</p>
                        ))}
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 text-slate-500"
                      onClick={() => setImportResult(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}

                {/* Patient Registry Import */}
                <div className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900 flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#0F766E]" />
                        Patient Registry
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">Import patients from a JSON file</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Input
                      type="file"
                      accept=".json"
                      disabled={importingPatients}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        setImportingPatients(true);
                        setImportResult(null);
                        
                        try {
                          const text = await file.text();
                          const data = JSON.parse(text);
                          
                          if (!Array.isArray(data)) {
                            toast.error('JSON file must contain an array of patients');
                            setImportingPatients(false);
                            return;
                          }
                          
                          toast.info(`Importing ${data.length} patients...`);
                          const response = await importAPI.patients(data);
                          setImportResult(response.data);
                          
                          if (response.data.success > 0) {
                            toast.success(`Successfully imported ${response.data.success} patients`);
                          }
                          if (response.data.failed > 0) {
                            toast.warning(`${response.data.failed} patients failed to import`);
                          }
                        } catch (error) {
                          if (error instanceof SyntaxError) {
                            toast.error('Invalid JSON file format');
                          } else {
                            toast.error(getErrorMessage(error, 'Failed to import patients'));
                          }
                        } finally {
                          setImportingPatients(false);
                          e.target.value = ''; // Reset file input
                        }
                      }}
                      data-testid="import-patients-json-input"
                    />
                    {importingPatients && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                        <div className="w-4 h-4 border-2 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
                        Importing patients...
                      </div>
                    )}
                  </div>
                  <div className="mt-3 p-3 bg-slate-50 rounded text-xs text-slate-600">
                    <p className="font-medium mb-1">Expected JSON format:</p>
                    <pre className="bg-slate-100 p-2 rounded overflow-x-auto">{`[
  {
    "full_name": "Juan Dela Cruz",
    "birthdate": "1990-01-15",
    "sex": "Male",
    "mobile": "09171234567",
    "address": "123 Main St",
    "allergies": ["Penicillin"],
    "chronic_conditions": ["Hypertension"]
  }
]`}</pre>
                  </div>
                </div>

                {/* Visit Records Import */}
                <div className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900 flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-[#0F766E]" />
                        Visit Records (SOAP Notes)
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">Import consultation/visit records with SOAP notes</p>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    <strong>Important:</strong> This is for VISIT/CONSULTATION records, NOT patient demographics. 
                    Patient must exist first. Use "Patient Registry" above to import patients.
                  </div>
                  <div className="mt-4">
                    <Input
                      type="file"
                      accept=".json"
                      disabled={importingVisits}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        setImportingVisits(true);
                        setImportResult(null);
                        
                        try {
                          const text = await file.text();
                          const data = JSON.parse(text);
                          
                          if (!Array.isArray(data)) {
                            toast.error('JSON file must contain an array of visits');
                            setImportingVisits(false);
                            return;
                          }
                          
                          toast.info(`Importing ${data.length} visits...`);
                          const response = await importAPI.visits(data);
                          setImportResult(response.data);
                          
                          if (response.data.success > 0) {
                            toast.success(`Successfully imported ${response.data.success} visits`);
                          }
                          if (response.data.warnings && response.data.warnings.length > 0) {
                            toast.info(`${response.data.warnings.length} visits imported without patient match`);
                          }
                          if (response.data.failed > 0) {
                            toast.warning(`${response.data.failed} visits failed to import`);
                          }
                        } catch (error) {
                          if (error instanceof SyntaxError) {
                            toast.error('Invalid JSON file format');
                          } else {
                            toast.error(getErrorMessage(error, 'Failed to import visits'));
                          }
                        } finally {
                          setImportingVisits(false);
                          e.target.value = ''; // Reset file input
                        }
                      }}
                      data-testid="import-visits-json-input"
                    />
                    {importingVisits && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                        <div className="w-4 h-4 border-2 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
                        Importing visits...
                      </div>
                    )}
                  </div>
                  <div className="mt-3 p-3 bg-slate-50 rounded text-xs text-slate-600">
                    <p className="font-medium mb-1">Expected JSON format for VISITS:</p>
                    <pre className="bg-slate-100 p-2 rounded overflow-x-auto">{`[
  {
    "patient_name": "Juan Dela Cruz",
    "soap_subjective": "Chief complaint: Headache x 2 days",
    "soap_objective": "BP 120/80, HR 72, Temp 36.5",
    "soap_assessment": "Tension-type headache",
    "soap_plan": "Paracetamol 500mg TID x 3 days",
    "diagnosis_codes": ["G44.2"]
  }
]`}</pre>
                    <p className="mt-2 text-green-600 font-medium">
                      <CheckCircle2 className="w-3 h-3 inline mr-1" />
                      Required: <strong>patient_name</strong> must match an existing patient exactly.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-4">
                  Note: Imports will create new records. Duplicate detection is not performed. Always backup your data before importing.
                </p>
              </CardContent>
            </Card>

            {/* Restore Backup Card */}
            <Card className="bg-white border-slate-100 shadow-sm mt-6">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Restore Backup
                </CardTitle>
                <CardDescription>Restore patient and visit data from a backup JSON file with merge or replace options</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setShowRestore(true)}
                  data-testid="settings-restore-btn"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Restore from Backup File
                </Button>
              </CardContent>
            </Card>

            <RestoreBackupDialog
              open={showRestore}
              onOpenChange={setShowRestore}
            />
          </TabsContent>
        )}

        {/* Audit Log */}
        {isAdmin && (
          <TabsContent value="audit">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#0F766E]" />
                  Audit Log
                </CardTitle>
                <CardDescription>Recent system activity</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No audit logs yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between p-3 rounded-lg bg-slate-50 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {log.user_name} <span className="text-slate-500 font-normal">{log.action}</span> {log.entity_type}
                          </p>
                          {log.details && <p className="text-slate-500">{log.details}</p>}
                        </div>
                        <p className="text-xs text-slate-400 whitespace-nowrap">
                          {format(parseISO(log.timestamp), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* About Tab */}
        <TabsContent value="about">
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader className="text-center pb-2">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#0F766E] to-[#115E59] flex items-center justify-center shadow-lg mb-4">
                <Stethoscope className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="font-heading text-2xl">Private Clinic EMR</CardTitle>
              <CardDescription className="text-base">Electronic Medical Records System</CardDescription>
              <Badge className="mt-2 bg-[#0F766E]/10 text-[#0F766E] hover:bg-[#0F766E]/20">PWA Enabled</Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4">
                <p className="text-slate-600 max-w-md mx-auto">
                  A comprehensive electronic medical records system designed for private medical clinics. 
                  Streamline patient management, consultations, prescriptions, and medical certificates.
                </p>
              </div>

              <div className="border-t border-b py-6">
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-2">Developed by</p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#0F766E]/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-[#0F766E]" />
                    </div>
                    <div className="text-left">
                      <p className="font-heading font-bold text-lg text-slate-900">Vicente C. Cavalida, Jr. MD</p>
                      <p className="text-sm text-slate-500">Physician & Developer</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div>
                <h3 className="font-heading font-semibold text-slate-900 mb-3 text-center">Key Features</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <Stethoscope className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">SOAP Notes</p>
                    <p className="text-xs text-slate-500">Structured documentation</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 text-center border border-purple-100">
                    <Brain className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">AI Consultation</p>
                    <p className="text-xs text-slate-500">SOAP, Dx, ICD-10, Rx</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 text-center border border-teal-100">
                    <ScanText className="w-5 h-5 text-teal-600 mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">OCR Extract</p>
                    <p className="text-xs text-slate-500">Scan handwritten notes</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <FileText className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Print Forms</p>
                    <p className="text-xs text-slate-500">Rx, MedCert, Referrals</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <Users className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Multi-User</p>
                    <p className="text-xs text-slate-500">Role-based access</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <Upload className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Upload SOAP</p>
                    <p className="text-xs text-slate-500">Scan & extract text</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <FolderOpen className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Draft History</p>
                    <p className="text-xs text-slate-500">Save AI consultations</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <GitCompare className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Compare Drafts</p>
                    <p className="text-xs text-slate-500">Side-by-side view</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <Microscope className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Lab Requests</p>
                    <p className="text-xs text-slate-500">Lab & imaging forms</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <Calendar className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Appointments</p>
                    <p className="text-xs text-slate-500">Queue & scheduling</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <Sparkles className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">AI Assist</p>
                    <p className="text-xs text-slate-500">Smart suggestions</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <Smartphone className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">PWA</p>
                    <p className="text-xs text-slate-500">Install on device</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <Download className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Data Export</p>
                    <p className="text-xs text-slate-500">JSON & CSV formats</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <FileUp className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Data Import</p>
                    <p className="text-xs text-slate-500">Bulk patient & visits</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <BookOpen className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">User Guide</p>
                    <p className="text-xs text-slate-500">Step-by-step help</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 text-center">
                    <Printer className="w-5 h-5 text-[#0F766E] mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Print Settings</p>
                    <p className="text-xs text-slate-500">Customize all forms</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 text-center border border-emerald-100">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Data Backup</p>
                    <p className="text-xs text-slate-500">One-click JSON backup</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-center border border-blue-100">
                    <RotateCcw className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">Restore Backup</p>
                    <p className="text-xs text-slate-500">Merge or replace data</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 text-center border border-indigo-100">
                    <Mic className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                    <p className="font-medium text-sm text-slate-900">AI Dictation</p>
                    <p className="text-xs text-slate-500">Voice-to-SOAP with AI</p>
                  </div>
                </div>
              </div>

              {/* Changelog */}
              <div className="border-t pt-6">
                <h3 className="font-heading font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#0F766E]" />
                  What's New
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  <div className="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-indigo-500"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">AI Doctor Dictation</p>
                      <p className="text-xs text-slate-600">Voice-to-SOAP dictation with AI structuring. Record doctor speech, auto-transcribe via Whisper, and generate structured SOAP notes, prescriptions, orders, instructions, and ICD-10 suggestions. 8 dictation modes with demo samples for testing</p>
                      <p className="text-xs text-slate-400 mt-1">Mar 14, 2026</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-emerald-500"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Data Backup & Restore</p>
                      <p className="text-xs text-slate-600">One-click backup of all patient and visit data to JSON. Restore from backup with merge (add new, skip duplicates) or replace (wipe and reimport) modes. 3-day overdue backup reminder banner on dashboard</p>
                      <p className="text-xs text-slate-400 mt-1">Mar 13, 2026</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-purple-500"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">AI-Assisted Consultation</p>
                      <p className="text-xs text-slate-600">Full AI consultation with SOAP generation, diagnosis suggestions, ICD-10 codes, medication recommendations, red flag alerts, save drafts, and compare drafts side-by-side</p>
                      <p className="text-xs text-slate-400 mt-1">Mar 1, 2026</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-teal-500"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Upload SOAP Notes with OCR</p>
                      <p className="text-xs text-slate-600">Upload scanned/handwritten SOAP notes and extract text using AI vision. Auto-populates SOAP fields. Files carry over to Visit Details</p>
                      <p className="text-xs text-slate-400 mt-1">Mar 1, 2026</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-green-500"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">PWA Support</p>
                      <p className="text-xs text-slate-600">Install app on mobile/desktop, offline caching, app-like experience</p>
                      <p className="text-xs text-slate-400 mt-1">Feb 27, 2026</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-slate-50">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-[#0F766E]"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Local File Storage</p>
                      <p className="text-xs text-slate-600">Files now stored locally for better performance</p>
                      <p className="text-xs text-slate-400 mt-1">Feb 27, 2026</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-slate-50">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-[#0F766E]"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Edit SOAP Notes</p>
                      <p className="text-xs text-slate-600">Edit SOAP notes after visit creation</p>
                      <p className="text-xs text-slate-400 mt-1">Feb 27, 2026</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-slate-50">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-[#0F766E]"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Lab/Imaging Request Forms</p>
                      <p className="text-xs text-slate-600">Create and print lab & imaging request forms with urgency levels</p>
                      <p className="text-xs text-slate-400 mt-1">Feb 26, 2026</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-slate-50">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-[#0F766E]"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Labs & Imaging Module</p>
                      <p className="text-xs text-slate-600">Messenger-style file upload with zoom/pan viewer</p>
                      <p className="text-xs text-slate-400 mt-1">Feb 25, 2026</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-slate-50">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-[#0F766E]"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Receptionist-Doctor Binding</p>
                      <p className="text-xs text-slate-600">Receptionists now tied to specific doctor who created them</p>
                      <p className="text-xs text-slate-400 mt-1">Dec 2025</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-slate-50">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-[#0F766E]"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Private Receptionist Creation</p>
                      <p className="text-xs text-slate-600">Doctors/Admins can create receptionist accounts from Settings</p>
                      <p className="text-xs text-slate-400 mt-1">Dec 2025</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-slate-50">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-[#0F766E]"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">AI-Powered Features</p>
                      <p className="text-xs text-slate-600">SOAP conversion, diagnosis suggestions, patient instructions</p>
                      <p className="text-xs text-slate-400 mt-1">Dec 2025</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center pt-4 border-t">
                <p className="text-xs text-slate-400">
                  Version 2.0.0 • Built with React & FastAPI
                </p>
                <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
                  Made with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> for healthcare professionals
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Guide Tab */}
        <TabsContent value="guide">
          <UserGuidePage />
        </TabsContent>

        {/* Print Settings Tab */}
        {(isAdmin || isDoctor) && (
          <TabsContent value="print-settings">
            <PrescriptionPrintSettings doctor={user} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default SettingsPage;
