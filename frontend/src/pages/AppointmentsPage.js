import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentAPI, patientAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Calendar } from '../components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Calendar as CalendarIcon, Clock, Plus, Search, 
  ChevronLeft, ChevronRight, Trash2, Edit, User
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { getErrorMessage } from '../lib/utils';

const AppointmentsPage = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [newApt, setNewApt] = useState({ date: '', time: '', reason: '' });

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await appointmentAPI.getAll({ date: dateStr });
      setAppointments(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load appointments'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearchPatient = async (query) => {
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

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchQuery(patient.full_name);
    setSearchResults([]);
  };

  const handleCreateAppointment = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    try {
      await appointmentAPI.create({
        patient_id: selectedPatient.id,
        patient_name: selectedPatient.full_name,
        date: newApt.date || format(selectedDate, 'yyyy-MM-dd'),
        time: newApt.time,
        reason: newApt.reason,
        status: 'waiting'
      });
      toast.success('Appointment scheduled');
      setShowNew(false);
      setSelectedPatient(null);
      setSearchQuery('');
      setNewApt({ date: '', time: '', reason: '' });
      fetchAppointments();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create appointment'));
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await appointmentAPI.update(id, { status });
      toast.success('Status updated');
      fetchAppointments();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update status'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this appointment?')) return;
    try {
      await appointmentAPI.delete(id);
      toast.success('Appointment deleted');
      fetchAppointments();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete appointment'));
    }
  };

  const statusColors = {
    waiting: 'bg-amber-100 text-amber-800 border-amber-200',
    in_consultation: 'bg-blue-100 text-blue-800 border-blue-200',
    done: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    no_show: 'bg-red-100 text-red-800 border-red-200'
  };

  // Get week days for the week view
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(selectedDate, { weekStartsOn: 1 })
  });

  return (
    <div className="space-y-6" data-testid="appointments-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900">Appointments</h1>
          <p className="text-slate-500 font-body">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white shadow-md" data-testid="new-appointment-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search patient..."
                    value={searchQuery}
                    onChange={(e) => handleSearchPatient(e.target.value)}
                    className="pl-10"
                    data-testid="apt-patient-search"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                      {searchResults.map((patient) => (
                        <button
                          key={patient.id}
                          onClick={() => handleSelectPatient(patient)}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                        >
                          <User className="w-4 h-4 text-slate-400" />
                          <span>{patient.full_name}</span>
                          <span className="text-xs text-slate-500 font-mono">{patient.patient_id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedPatient && (
                  <Badge className="bg-[#0F766E]/10 text-[#0F766E]">
                    Selected: {selectedPatient.full_name}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newApt.date || format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => setNewApt({ ...newApt, date: e.target.value })}
                    data-testid="apt-date-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={newApt.time}
                    onChange={(e) => setNewApt({ ...newApt, time: e.target.value })}
                    data-testid="apt-time-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input
                  value={newApt.reason}
                  onChange={(e) => setNewApt({ ...newApt, reason: e.target.value })}
                  placeholder="Consultation, Follow-up, etc."
                  data-testid="apt-reason-input"
                />
              </div>
              <Button 
                onClick={handleCreateAppointment} 
                className="w-full bg-[#0F766E] hover:bg-[#115E59]"
                data-testid="confirm-apt-btn"
              >
                Schedule Appointment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md"
            />
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card className="lg:col-span-2 bg-white border-slate-100 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#0F766E]" />
                {format(selectedDate, 'MMMM d')} Appointments
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Today
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No appointments for this date</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowNew(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Appointment
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
                    data-testid={`apt-item-${apt.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 text-center">
                        <p className="text-lg font-semibold text-slate-900">{apt.time}</p>
                      </div>
                      <div>
                        <p 
                          className="font-medium text-slate-900 hover:text-[#0F766E] cursor-pointer"
                          onClick={() => navigate(`/patients/${apt.patient_id}`)}
                        >
                          {apt.patient_name}
                        </p>
                        {apt.reason && <p className="text-sm text-slate-500">{apt.reason}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select 
                        value={apt.status} 
                        onValueChange={(v) => handleUpdateStatus(apt.id, v)}
                      >
                        <SelectTrigger className={`w-36 ${statusColors[apt.status]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="waiting">Waiting</SelectItem>
                          <SelectItem value="in_consultation">In Consultation</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="no_show">No Show</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(apt.id)}
                        className="text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppointmentsPage;
