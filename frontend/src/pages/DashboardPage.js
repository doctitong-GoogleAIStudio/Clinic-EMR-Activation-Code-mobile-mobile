import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, appointmentAPI, patientAPI, exportAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Users, Calendar, Clock, Activity, Search, Plus, 
  Phone, Play, CheckCircle, XCircle, UserPlus, Stethoscope, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getErrorMessage } from '../lib/utils';
import VitalsTooltip from '../components/VitalsTooltip';

const DashboardPage = () => {
  const { user, isDoctor } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [queue, setQueue] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newPatient, setNewPatient] = useState({ full_name: '', birthdate: '', sex: 'male', mobile: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Get local date in YYYY-MM-DD format
  const getLocalDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const fetchDashboardData = async () => {
    try {
      const localDate = getLocalDate();
      const [statsRes, queueRes, aptsRes] = await Promise.all([
        dashboardAPI.getStats(localDate),
        appointmentAPI.getQueue(localDate),
        appointmentAPI.getToday(localDate)
      ]);
      setStats(statsRes.data);
      setQueue(queueRes.data);
      setAppointments(aptsRes.data);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      try {
        const response = await patientAPI.getAll(query);
        setSearchResults(response.data.slice(0, 5));
      } catch (error) {
        console.error('Search error:', error);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleQuickRegister = async (e) => {
    e.preventDefault();
    try {
      // Clean up empty strings to null
      const cleanData = {
        ...newPatient,
        mobile: newPatient.mobile?.trim() || null,
      };
      const response = await patientAPI.create(cleanData);
      toast.success(`Patient ${response.data.full_name} registered`);
      setShowQuickAdd(false);
      setNewPatient({ full_name: '', birthdate: '', sex: 'male', mobile: '' });
      navigate(`/patients/${response.data.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to register patient'));
    }
  };

  const updateQueueStatus = async (appointmentId, status) => {
    try {
      await appointmentAPI.update(appointmentId, { status });
      toast.success(`Status updated to ${status.replace('_', ' ')}`);
      fetchDashboardData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update status'));
    }
  };

  // Backup data function
  const handleBackupNow = async () => {
    try {
      toast.info('Starting backup...', { duration: 2000 });
      
      const [patientsRes, visitsRes] = await Promise.all([
        exportAPI.patients(),
        exportAPI.visits({})
      ]);
      
      const patients = patientsRes.data?.data || patientsRes.data || [];
      const visits = visitsRes.data?.data || visitsRes.data || [];
      
      if (patients.length === 0 && visits.length === 0) {
        toast.info('No data to backup');
        return;
      }
      
      const backup = {
        exportedAt: new Date().toISOString(),
        exportType: 'manual_backup',
        patientsCount: patients.length,
        visitsCount: visits.length,
        patients: patients,
        visits: visits
      };
      
      // Create and download file
      const jsonString = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `EMR_Backup_${date}_${time}.json`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // Record backup time for the reminder system
      localStorage.setItem('emr_last_auto_export', Date.now().toString());
      
      toast.success(`Backup complete: ${patients.length} patients, ${visits.length} visits`, {
        duration: 5000,
        description: `Downloaded: ${filename}`
      });
    } catch (error) {
      console.error('Backup failed:', error);
      toast.error('Backup failed: ' + getErrorMessage(error));
    }
  };

  const statusColors = {
    waiting: 'bg-amber-100 text-amber-800 border-amber-200',
    in_consultation: 'bg-blue-100 text-blue-800 border-blue-200',
    done: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    no_show: 'bg-red-100 text-red-800 border-red-200'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-slate-500 font-body">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 h-11 bg-white border-slate-200"
              data-testid="patient-search-input"
            />

            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                {searchResults.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => {
                      navigate(`/patients/${patient.id}`);
                      setSearchResults([]);
                      setSearchQuery('');
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b last:border-b-0"
                    data-testid={`search-result-${patient.id}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#0F766E]/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-[#0F766E]" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{patient.full_name}</p>
                      <p className="text-sm text-slate-500 font-mono">{patient.patient_id}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="border-[#0F766E] text-[#0F766E] hover:bg-[#0F766E]/10 h-11 px-4"
            onClick={handleBackupNow}
            data-testid="backup-now-btn"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Backup</span>
          </Button>
          <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
            <DialogTrigger asChild>
              <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white shadow-md h-11 px-4" data-testid="quick-add-patient-btn">
                <UserPlus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Quick Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Quick Register Patient</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleQuickRegister} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={newPatient.full_name}
                    onChange={(e) => setNewPatient({ ...newPatient, full_name: e.target.value })}
                    placeholder="Juan Dela Cruz"
                    required
                    data-testid="quick-add-name-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Birthdate *</Label>
                    <Input
                      type="date"
                      value={newPatient.birthdate}
                      onChange={(e) => setNewPatient({ ...newPatient, birthdate: e.target.value })}
                      required
                      data-testid="quick-add-birthdate-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sex *</Label>
                    <Select value={newPatient.sex} onValueChange={(v) => setNewPatient({ ...newPatient, sex: v })}>
                      <SelectTrigger data-testid="quick-add-sex-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mobile Number</Label>
                  <Input
                    value={newPatient.mobile}
                    onChange={(e) => setNewPatient({ ...newPatient, mobile: e.target.value })}
                    placeholder="09123456789"
                    data-testid="quick-add-mobile-input"
                  />
                </div>
                <Button type="submit" className="w-full bg-[#0F766E] hover:bg-[#115E59]" data-testid="quick-add-submit-btn">
                  Register Patient
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">Total Patients</p>
                <p className="text-2xl font-heading font-bold text-slate-900">{stats.total_patients || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#0F766E]/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-[#0F766E]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">Today's Appointments</p>
                <p className="text-2xl font-heading font-bold text-slate-900">{stats.today_appointments || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">In Queue</p>
                <p className="text-2xl font-heading font-bold text-slate-900">{stats.waiting || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">Week's Visits</p>
                <p className="text-2xl font-heading font-bold text-slate-900">{stats.week_visits || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Activity className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Queue Management - Takes 2 columns */}
        <Card className="lg:col-span-2 bg-white border-slate-100 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#0F766E]" />
                Today's Queue
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  {stats.waiting || 0} waiting
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {stats.in_consultation || 0} in consultation
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {queue.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No patients in queue</p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((apt, index) => (
                  <div
                    key={apt.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                      apt.vitals && Object.keys(apt.vitals).length > 0
                        ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                        : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                    }`}
                    data-testid={`queue-item-${apt.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold ${
                        apt.vitals && Object.keys(apt.vitals).length > 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-[#0F766E]/10 text-[#0F766E]'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{apt.patient_name}</p>
                          {apt.vitals && Object.keys(apt.vitals).length > 0 && (
                            <VitalsTooltip 
                              vitals={apt.vitals} 
                              variant="badge" 
                              size="sm"
                              testId={`queue-vitals-${apt.id}`}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Clock className="w-3 h-3" />
                          {apt.time}
                          {apt.reason && <span>• {apt.reason}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[apt.status]}>
                        {apt.status.replace('_', ' ')}
                      </Badge>
                      <div className="flex gap-1">
                        {apt.status === 'waiting' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateQueueStatus(apt.id, 'in_consultation')}
                              className="h-8 px-2 text-blue-600 hover:bg-blue-50"
                              data-testid={`start-consultation-${apt.id}`}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateQueueStatus(apt.id, 'no_show')}
                              className="h-8 px-2 text-red-600 hover:bg-red-50"
                              data-testid={`no-show-${apt.id}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {apt.status === 'in_consultation' && (
                          <>
                            {isDoctor && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/visits/new?patient=${apt.patient_id}&appointment=${apt.id}`)}
                                className="h-8 px-2 text-[#0F766E] hover:bg-[#0F766E]/10"
                                data-testid={`create-visit-${apt.id}`}
                              >
                                <Stethoscope className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateQueueStatus(apt.id, 'done')}
                              className="h-8 px-2 text-emerald-600 hover:bg-emerald-50"
                              data-testid={`mark-done-${apt.id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#0F766E]" />
                Appointments
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/appointments')}
                className="text-[#0F766E] hover:bg-[#0F766E]/10"
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {appointments.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No appointments today</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      apt.vitals && Object.keys(apt.vitals).length > 0
                        ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                    onClick={() => navigate(`/patients/${apt.patient_id}`)}
                    data-testid={`appointment-${apt.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 text-sm">{apt.patient_name}</p>
                        {apt.vitals && Object.keys(apt.vitals).length > 0 && (
                          <VitalsTooltip 
                            vitals={apt.vitals} 
                            variant="icon" 
                            size="sm"
                            testId={`sidebar-vitals-${apt.id}`}
                          />
                        )}
                      </div>
                      <Badge variant="outline" className={`${statusColors[apt.status]} text-xs`}>
                        {apt.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {apt.time} {apt.reason && `• ${apt.reason}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Button
              className="w-full mt-4 bg-[#0F766E] hover:bg-[#115E59]"
              onClick={() => navigate('/appointments')}
              data-testid="view-all-appointments-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Appointment
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
