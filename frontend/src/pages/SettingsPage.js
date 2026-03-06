import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { settingsAPI, userAPI, auditAPI, exportAPI, authAPI } from '../lib/api';
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
  Sparkles, Microscope, Calendar, Upload, Smartphone, Brain, ScanText, FolderOpen, GitCompare, Printer, Trash2, Key, Eye, EyeOff, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { getErrorMessage } from '../lib/utils';

const SettingsPage = () => {
  const { user, isAdmin, isDoctor } = useAuth();
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
                </div>
              </div>

              {/* Changelog */}
              <div className="border-t pt-6">
                <h3 className="font-heading font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#0F766E]" />
                  What's New
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
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
      </Tabs>
    </div>
  );
};

export default SettingsPage;
