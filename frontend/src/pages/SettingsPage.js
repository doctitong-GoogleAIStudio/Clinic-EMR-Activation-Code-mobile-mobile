import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { settingsAPI, userAPI, auditAPI, exportAPI } from '../lib/api';
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
  Plus, Download, Clock, User, Edit, Info, Stethoscope, Heart, Code, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

const SettingsPage = () => {
  const { user, isAdmin, isDoctor } = useAuth();
  const [receptionistForm, setReceptionistForm] = useState({ full_name: '', email: '', password: '' });
  const [creatingReceptionist, setCreatingReceptionist] = useState(false);
  const [settings, setSettings] = useState({
    clinic_name: '',
    address: '',
    phone: '',
    email: '',
    license_no: '',
    ptr_no: '',
    prc_no: '',
    specialization: ''
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
      const [settingsRes, usersRes, auditRes] = await Promise.all([
        settingsAPI.get(),
        isAdmin ? userAPI.getAll() : Promise.resolve({ data: [] }),
        isAdmin ? auditAPI.getAll(50) : Promise.resolve({ data: [] })
      ]);
      setSettings(settingsRes.data);
      setUsers(usersRes.data);
      setAuditLogs(auditRes.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await settingsAPI.update(settings);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
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
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleExportPatients = async () => {
    try {
      const response = await exportAPI.patients();
      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_export_${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  const handleExportVisits = async () => {
    try {
      const response = await exportAPI.visits({});
      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visits_export_${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Failed to export');
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
              <TabsTrigger value="exports" data-testid="tab-exports">
                <Download className="w-4 h-4 mr-2" />
                Exports
              </TabsTrigger>
              <TabsTrigger value="audit" data-testid="tab-audit">
                <Shield className="w-4 h-4 mr-2" />
                Audit Log
              </TabsTrigger>
            </>
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
                  <Label>License Number</Label>
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
        </TabsContent>

        {/* Users Management */}
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
                            <Label>License No.</Label>
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

        {/* Exports */}
        {isAdmin && (
          <TabsContent value="exports">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Download className="w-5 h-5 text-[#0F766E]" />
                  Data Export
                </CardTitle>
                <CardDescription>Export clinic data for backup or reporting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Card className="border-slate-200">
                    <CardContent className="p-4">
                      <h3 className="font-medium text-slate-900 mb-2">Patient Registry</h3>
                      <p className="text-sm text-slate-500 mb-4">Export all patient records</p>
                      <Button variant="outline" onClick={handleExportPatients} data-testid="export-patients-btn">
                        <Download className="w-4 h-4 mr-2" />
                        Export Patients
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200">
                    <CardContent className="p-4">
                      <h3 className="font-medium text-slate-900 mb-2">Visit Records</h3>
                      <p className="text-sm text-slate-500 mb-4">Export all consultation records</p>
                      <Button variant="outline" onClick={handleExportVisits} data-testid="export-visits-btn">
                        <Download className="w-4 h-4 mr-2" />
                        Export Visits
                      </Button>
                    </CardContent>
                  </Card>
                </div>
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

              <div className="grid sm:grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-xl bg-slate-50">
                  <Stethoscope className="w-6 h-6 text-[#0F766E] mx-auto mb-2" />
                  <p className="font-medium text-slate-900">SOAP Notes</p>
                  <p className="text-xs text-slate-500">Structured documentation</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <FileText className="w-6 h-6 text-[#0F766E] mx-auto mb-2" />
                  <p className="font-medium text-slate-900">Print Forms</p>
                  <p className="text-xs text-slate-500">Rx, MedCert, Referrals</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <Users className="w-6 h-6 text-[#0F766E] mx-auto mb-2" />
                  <p className="font-medium text-slate-900">Multi-User</p>
                  <p className="text-xs text-slate-500">Role-based access</p>
                </div>
              </div>

              <div className="text-center pt-4 border-t">
                <p className="text-xs text-slate-400">
                  Version 1.0.0 • Built with React & FastAPI
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
