import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { patientAPI, visitAPI, attachmentAPI, appointmentAPI, prescriptionAPI, certificateAPI, settingsAPI } from '../lib/api';
import { useReactToPrint } from 'react-to-print';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  User, Phone, Mail, MapPin, Calendar, Heart, AlertTriangle, 
  Edit, Save, Plus, FileText, Image, Upload, Trash2, 
  Stethoscope, Clock, ArrowLeft, Paperclip, X, Pill, Award, Briefcase, Send, Printer, AlertCircle,
  Microscope, Download, Eye, FileImage, File, ZoomIn, ZoomOut, Maximize2, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

const PatientProfilePage = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { isDoctor, isAdmin, user } = useAuth();
  const fileInputRef = useRef(null);
  const docPrintRef = useRef(null);
  
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [settings, setSettings] = useState({});
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showUpload, setShowUpload] = useState(false);
  const [uploadData, setUploadData] = useState({ tag: 'other', notes: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [showAppointment, setShowAppointment] = useState(false);
  const [appointmentData, setAppointmentData] = useState({ date: '', time: '', reason: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [labFile, setLabFile] = useState(null);
  const [labUploadData, setLabUploadData] = useState({ tag: 'lab', notes: '' });
  const [labUploading, setLabUploading] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState(null);
  const [editingLabId, setEditingLabId] = useState(null);
  const [editLabData, setEditLabData] = useState({ filename: '', tag: '', notes: '' });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const labFileInputRef = useRef(null);
  const viewerContainerRef = useRef(null);

  const handlePrintDoc = useReactToPrint({ contentRef: docPrintRef, documentTitle: 'Document' });

  useEffect(() => {
    fetchPatientData();
  }, [patientId]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const [patientRes, visitsRes, attachmentsRes, rxRes, certRes, settingsRes] = await Promise.all([
        patientAPI.getOne(patientId),
        visitAPI.getAll({ patient_id: patientId }),
        attachmentAPI.getAll({ patient_id: patientId }),
        prescriptionAPI.getAll({ patient_id: patientId }),
        certificateAPI.getAll({ patient_id: patientId }),
        settingsAPI.get()
      ]);
      setPatient(patientRes.data);
      setEditData(patientRes.data);
      setVisits(visitsRes.data);
      setAttachments(attachmentsRes.data);
      setPrescriptions(rxRes.data);
      setCertificates(certRes.data);
      setSettings(settingsRes.data);
    } catch (error) {
      toast.error('Failed to load patient');
      navigate('/patients');
    } finally {
      setLoading(false);
    }
  };

  const getCertificateTypeName = (type) => {
    const names = {
      'medical_certificate': 'Medical Certificate',
      'fit_to_work': 'Fit-to-Work Certificate',
      'referral': 'Referral Letter'
    };
    return names[type] || type;
  };

  const reprintDocument = (doc, type) => {
    setSelectedDoc({ ...doc, docType: type });
    setTimeout(() => handlePrintDoc(), 100);
  };

  const handleSave = async () => {
    try {
      const response = await patientAPI.update(patientId, editData);
      setPatient(response.data);
      setEditing(false);
      toast.success('Patient updated');
    } catch (error) {
      toast.error('Failed to update patient');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('patient_id', patientId);
      formData.append('tag', uploadData.tag);
      formData.append('notes', uploadData.notes);
      
      await attachmentAPI.upload(formData);
      toast.success('File uploaded');
      setShowUpload(false);
      setUploadFile(null);
      setUploadData({ tag: 'other', notes: '' });
      fetchPatientData();
    } catch (error) {
      toast.error('Failed to upload file');
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Delete this attachment?')) return;
    try {
      await attachmentAPI.delete(attachmentId);
      toast.success('Attachment deleted');
      fetchPatientData();
    } catch (error) {
      toast.error('Failed to delete attachment');
    }
  };

  const handleCreateAppointment = async () => {
    try {
      await appointmentAPI.create({
        patient_id: patientId,
        patient_name: patient.full_name,
        ...appointmentData,
        status: 'waiting'
      });
      toast.success('Appointment scheduled');
      setShowAppointment(false);
      setAppointmentData({ date: '', time: '', reason: '' });
    } catch (error) {
      toast.error('Failed to create appointment');
    }
  };

  const handleDeletePatient = async () => {
    setDeleting(true);
    try {
      await patientAPI.delete(patientId);
      toast.success('Patient deleted successfully');
      navigate('/patients');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete patient');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLabUpload = async () => {
    if (!labFile) return;
    setLabUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', labFile);
      formData.append('patient_id', patientId);
      formData.append('tag', labUploadData.tag);
      formData.append('notes', labUploadData.notes);
      await attachmentAPI.upload(formData);
      toast.success('File uploaded');
      setLabFile(null);
      setLabUploadData({ tag: 'lab', notes: '' });
      if (labFileInputRef.current) labFileInputRef.current.value = '';
      fetchPatientData();
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setLabUploading(false);
    }
  };

  const startEditLab = (att) => {
    setEditingLabId(att.id);
    setEditLabData({ filename: att.filename, tag: att.tag, notes: att.notes || '' });
  };

  const cancelEditLab = () => {
    setEditingLabId(null);
    setEditLabData({ filename: '', tag: '', notes: '' });
  };

  const saveEditLab = async () => {
    try {
      await attachmentAPI.update(editingLabId, editLabData);
      toast.success('File updated');
      cancelEditLab();
      fetchPatientData();
    } catch (error) {
      toast.error('Failed to update file');
    }
  };

  const handleViewAttachment = async (attachmentId) => {
    try {
      const res = await attachmentAPI.getOne(attachmentId);
      const att = res.data;
      if (att.content_type?.startsWith('image/')) {
        openAttachmentViewer(att);
      } else if (att.content_type === 'application/pdf') {
        // Open PDF in new tab
        const byteChars = atob(att.file_data);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        // Download other files
        const byteChars = atob(att.file_data);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: att.content_type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = att.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast.error('Failed to load file');
    }
  };

  const labImagingAttachments = attachments.filter(a => 
    ['lab', 'x-ray', 'ultrasound', 'ecg'].includes(a.tag)
  );

  const resetViewer = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const openAttachmentViewer = (att) => {
    resetViewer();
    setViewingAttachment(att);
  };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.min(5, Math.max(0.25, z + (e.deltaY > 0 ? -0.15 : 0.15))));
  }, []);

  const handlePointerDown = useCallback((e) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handlePointerUp = useCallback(() => { setIsPanning(false); }, []);

  const tagColors = {
    lab: 'bg-purple-100 text-purple-800',
    'x-ray': 'bg-blue-100 text-blue-800',
    ultrasound: 'bg-cyan-100 text-cyan-800',
    ecg: 'bg-rose-100 text-rose-800',
    other: 'bg-slate-100 text-slate-800'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="space-y-6" data-testid="patient-profile-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/patients')} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold text-slate-900">{patient.full_name}</h1>
            <Badge variant="outline" className="font-mono bg-slate-50">{patient.patient_id}</Badge>
          </div>
          <p className="text-slate-500 font-body">{patient.age} years old, {patient.sex}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAppointment} onOpenChange={setShowAppointment}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="schedule-appointment-btn">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Appointment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={appointmentData.date}
                      onChange={(e) => setAppointmentData({ ...appointmentData, date: e.target.value })}
                      data-testid="appointment-date-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={appointmentData.time}
                      onChange={(e) => setAppointmentData({ ...appointmentData, time: e.target.value })}
                      data-testid="appointment-time-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    value={appointmentData.reason}
                    onChange={(e) => setAppointmentData({ ...appointmentData, reason: e.target.value })}
                    placeholder="Follow-up, Consultation, etc."
                    data-testid="appointment-reason-input"
                  />
                </div>
                <Button onClick={handleCreateAppointment} className="w-full bg-[#0F766E] hover:bg-[#115E59]" data-testid="confirm-appointment-btn">
                  Schedule Appointment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {isDoctor && (
            <Button className="bg-[#F97316] hover:bg-[#EA580C]" onClick={() => navigate(`/visits/new?patient=${patientId}`)} data-testid="new-visit-btn">
              <Stethoscope className="w-4 h-4 mr-2" />
              New Visit
            </Button>
          )}
          {(isDoctor || isAdmin) && (
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" data-testid="delete-patient-btn">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    Delete Patient
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-red-800 font-medium">Are you sure you want to delete this patient?</p>
                    <p className="text-red-600 text-sm mt-2">
                      This will permanently delete <strong>{patient?.full_name}</strong> and all associated records including visits, prescriptions, certificates, and attachments.
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">This action cannot be undone.</p>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleDeletePatient}
                      disabled={deleting}
                      data-testid="confirm-delete-patient-btn"
                    >
                      {deleting ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Deleting...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Trash2 className="w-4 h-4" />
                          Delete Patient
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
          <TabsTrigger value="visits" data-testid="tab-visits">Visits ({visits.length})</TabsTrigger>
          <TabsTrigger value="labs" data-testid="tab-labs">Labs & Imaging ({labImagingAttachments.length})</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents ({prescriptions.length + certificates.length})</TabsTrigger>
          <TabsTrigger value="attachments" data-testid="tab-attachments">Attachments ({attachments.length})</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading">Patient Information</CardTitle>
              {!editing ? (
                <Button variant="outline" onClick={() => setEditing(true)} data-testid="edit-patient-btn">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setEditing(false); setEditData(patient); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} className="bg-[#0F766E] hover:bg-[#115E59]" data-testid="save-patient-btn">
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Demographics */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-500">Full Name</Label>
                  {editing ? (
                    <Input value={editData.full_name} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} />
                  ) : (
                    <p className="font-medium text-slate-900">{patient.full_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500">Birthdate</Label>
                  {editing ? (
                    <Input type="date" value={editData.birthdate} onChange={(e) => setEditData({ ...editData, birthdate: e.target.value })} />
                  ) : (
                    <p className="font-medium text-slate-900">{patient.birthdate && format(parseISO(patient.birthdate), 'MMMM d, yyyy')}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500">Sex</Label>
                  {editing ? (
                    <Select value={editData.sex} onValueChange={(v) => setEditData({ ...editData, sex: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-slate-900 capitalize">{patient.sex}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500">Mobile</Label>
                  {editing ? (
                    <Input value={editData.mobile || ''} onChange={(e) => setEditData({ ...editData, mobile: e.target.value })} />
                  ) : (
                    <p className="font-medium text-slate-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {patient.mobile || '-'}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500">Email</Label>
                  {editing ? (
                    <Input type="email" value={editData.email || ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                  ) : (
                    <p className="font-medium text-slate-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {patient.email || '-'}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500">Address</Label>
                  {editing ? (
                    <Input value={editData.address || ''} onChange={(e) => setEditData({ ...editData, address: e.target.value })} />
                  ) : (
                    <p className="font-medium text-slate-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {patient.address || '-'}
                    </p>
                  )}
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="border-t pt-4">
                <h3 className="font-heading font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  Emergency Contact
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-500">Contact Name</Label>
                    {editing ? (
                      <Input value={editData.emergency_contact_name || ''} onChange={(e) => setEditData({ ...editData, emergency_contact_name: e.target.value })} />
                    ) : (
                      <p className="font-medium text-slate-900">{patient.emergency_contact_name || '-'}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-500">Contact Phone</Label>
                    {editing ? (
                      <Input value={editData.emergency_contact_phone || ''} onChange={(e) => setEditData({ ...editData, emergency_contact_phone: e.target.value })} />
                    ) : (
                      <p className="font-medium text-slate-900">{patient.emergency_contact_phone || '-'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Medical Info */}
              <div className="border-t pt-4">
                <h3 className="font-heading font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Medical Information
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-500">Allergies</Label>
                    {editing ? (
                      <Textarea 
                        value={editData.allergies?.join(', ') || ''} 
                        onChange={(e) => setEditData({ ...editData, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="Separate with commas"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {patient.allergies?.length > 0 ? patient.allergies.map((allergy, i) => (
                          <Badge key={i} variant="destructive" className="bg-red-100 text-red-700">{allergy}</Badge>
                        )) : <span className="text-slate-500">None</span>}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-500">Chronic Conditions</Label>
                    {editing ? (
                      <Textarea 
                        value={editData.chronic_conditions?.join(', ') || ''} 
                        onChange={(e) => setEditData({ ...editData, chronic_conditions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="Separate with commas"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {patient.chronic_conditions?.length > 0 ? patient.chronic_conditions.map((condition, i) => (
                          <Badge key={i} variant="outline" className="bg-amber-50 text-amber-700">{condition}</Badge>
                        )) : <span className="text-slate-500">None</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visits Tab */}
        <TabsContent value="visits">
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading">Visit History</CardTitle>
              {isDoctor && (
                <Button className="bg-[#F97316] hover:bg-[#EA580C]" onClick={() => navigate(`/visits/new?patient=${patientId}`)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Visit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {visits.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No visits recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visits.map((visit) => (
                    <div 
                      key={visit.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-[#0F766E]/30 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => navigate(`/visits/${visit.id}`)}
                      data-testid={`visit-${visit.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-slate-900">
                            {format(parseISO(visit.created_at), 'MMMM d, yyyy')} at {format(parseISO(visit.created_at), 'h:mm a')}
                          </p>
                          <p className="text-sm text-slate-500">Dr. {visit.created_by_name}</p>
                          {visit.soap_assessment && (
                            <p className="text-sm text-slate-700 mt-2 line-clamp-2">{visit.soap_assessment}</p>
                          )}
                        </div>
                        {visit.vitals && (
                          <div className="text-right text-sm text-slate-500">
                            {visit.vitals.bp_systolic && visit.vitals.bp_diastolic && (
                              <p>BP: {visit.vitals.bp_systolic}/{visit.vitals.bp_diastolic}</p>
                            )}
                            {visit.vitals.temperature && <p>Temp: {visit.vitals.temperature}°C</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Labs & Imaging Tab */}
        <TabsContent value="labs">
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Microscope className="w-5 h-5 text-[#0F766E]" />
                Labs & Imaging
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Messenger-style file list */}
              <div className="flex flex-col min-h-[300px] max-h-[520px]">
                <div className="flex-1 overflow-y-auto space-y-3 pb-4" data-testid="labs-file-list">
                  {labImagingAttachments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Microscope className="w-14 h-14 mb-3 opacity-40" />
                      <p className="font-medium text-slate-500">No lab results or imaging files yet</p>
                      <p className="text-sm mt-1">Upload files below to get started</p>
                    </div>
                  ) : (
                    labImagingAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex justify-end"
                        data-testid={`lab-item-${att.id}`}
                      >
                        <div className="max-w-[80%] sm:max-w-[65%]">
                          {/* Chat bubble */}
                          <div
                            className="rounded-2xl rounded-br-md bg-[#0F766E] text-white p-3 cursor-pointer hover:bg-[#115E59] transition-colors group"
                            onClick={() => handleViewAttachment(att.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                {att.content_type?.startsWith('image/') ? (
                                  <FileImage className="w-5 h-5 text-white" />
                                ) : (
                                  <File className="w-5 h-5 text-white" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{att.filename}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] uppercase tracking-wider bg-white/20 rounded-full px-2 py-0.5">{att.tag}</span>
                                  <span className="text-xs opacity-75">
                                    {att.content_type?.startsWith('image/') ? 'Tap to view' : 'Tap to download'}
                                  </span>
                                </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                {att.content_type?.startsWith('image/') ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </div>
                            </div>
                            {att.notes && (
                              <p className="text-xs text-white/80 mt-2 pl-[52px]">{att.notes}</p>
                            )}
                          </div>
                          {/* Timestamp + delete */}
                          <div className="flex items-center justify-end gap-2 mt-1 px-1">
                            <span className="text-[11px] text-slate-400">
                              {format(parseISO(att.uploaded_at), 'MMM d, yyyy h:mm a')}
                            </span>
                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                              data-testid={`lab-delete-${att.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Upload bar (messenger-style input) */}
                <div className="border-t border-slate-200 pt-4 mt-auto">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            type="file"
                            ref={labFileInputRef}
                            onChange={(e) => setLabFile(e.target.files[0])}
                            accept="image/*,.pdf,.doc,.docx"
                            className="text-sm"
                            data-testid="lab-file-input"
                          />
                        </div>
                        <Select value={labUploadData.tag} onValueChange={(v) => setLabUploadData({ ...labUploadData, tag: v })}>
                          <SelectTrigger className="w-[130px]" data-testid="lab-tag-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lab">Lab Result</SelectItem>
                            <SelectItem value="x-ray">X-Ray</SelectItem>
                            <SelectItem value="ultrasound">Ultrasound</SelectItem>
                            <SelectItem value="ecg">ECG</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        value={labUploadData.notes}
                        onChange={(e) => setLabUploadData({ ...labUploadData, notes: e.target.value })}
                        placeholder="Add a note (optional)..."
                        className="text-sm"
                        data-testid="lab-notes-input"
                      />
                    </div>
                    <Button
                      onClick={handleLabUpload}
                      disabled={!labFile || labUploading}
                      className="bg-[#0F766E] hover:bg-[#115E59] h-11 px-4"
                      data-testid="lab-upload-btn"
                    >
                      {labUploading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  {labFile && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="truncate flex-1">{labFile.name}</span>
                      <button
                        onClick={() => { setLabFile(null); if (labFileInputRef.current) labFileInputRef.current.value = ''; }}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Image Viewer Modal */}
          <Dialog open={!!viewingAttachment} onOpenChange={(open) => { if (!open) { setViewingAttachment(null); resetViewer(); } }}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden">
              <DialogHeader className="px-5 pt-5 pb-3">
                <DialogTitle className="flex items-center gap-2">
                  <FileImage className="w-5 h-5 text-[#0F766E]" />
                  {viewingAttachment?.filename}
                </DialogTitle>
              </DialogHeader>
              {viewingAttachment && (
                <div className="flex flex-col">
                  {/* Zoom/pan image area */}
                  <div
                    ref={viewerContainerRef}
                    className="relative bg-slate-950 overflow-hidden select-none"
                    style={{ height: '60vh', cursor: isPanning ? 'grabbing' : 'grab' }}
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    data-testid="lab-image-viewer-area"
                  >
                    <img
                      src={`data:${viewingAttachment.content_type};base64,${viewingAttachment.file_data}`}
                      alt={viewingAttachment.filename}
                      draggable={false}
                      className="absolute top-1/2 left-1/2 max-w-none"
                      style={{
                        transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                        transformOrigin: 'center center',
                        transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                      }}
                      data-testid="lab-image-viewer"
                    />
                  </div>

                  {/* Controls bar */}
                  <div className="px-5 py-3 bg-white border-t border-slate-200">
                    <div className="flex items-center justify-between gap-4">
                      {/* Tag + notes */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className={`${tagColors[viewingAttachment.tag]} text-xs flex-shrink-0`}>{viewingAttachment.tag}</Badge>
                        {viewingAttachment.notes && <span className="text-sm text-slate-500 truncate">{viewingAttachment.notes}</span>}
                      </div>

                      {/* Zoom controls */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
                          disabled={zoom <= 0.25}
                          data-testid="zoom-out-btn"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </Button>
                        <input
                          type="range"
                          min="25" max="500" step="5"
                          value={Math.round(zoom * 100)}
                          onChange={(e) => setZoom(Number(e.target.value) / 100)}
                          className="w-28 h-1.5 accent-[#0F766E] cursor-pointer"
                          data-testid="zoom-slider"
                        />
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setZoom(z => Math.min(5, z + 0.25))}
                          disabled={zoom >= 5}
                          data-testid="zoom-in-btn"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </Button>
                        <span className="text-xs text-slate-500 w-12 text-center font-mono" data-testid="zoom-level">{Math.round(zoom * 100)}%</span>
                        <div className="w-px h-5 bg-slate-200 mx-1" />
                        <Button
                          variant="ghost" size="sm"
                          onClick={resetViewer}
                          title="Reset view"
                          data-testid="zoom-reset-btn"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                          title="Fit to screen"
                          data-testid="zoom-fit-btn"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </Button>
                        <div className="w-px h-5 bg-slate-200 mx-1" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const byteChars = atob(viewingAttachment.file_data);
                            const byteNumbers = new Array(byteChars.length);
                            for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: viewingAttachment.content_type });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = viewingAttachment.filename;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          data-testid="lab-download-btn"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>


        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0F766E]" />
                Medical Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prescriptions.length === 0 && certificates.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No documents saved yet</p>
                  <p className="text-sm mt-1">Prescriptions and certificates will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Prescriptions */}
                  {prescriptions.length > 0 && (
                    <div>
                      <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                        <Pill className="w-4 h-4 text-[#0F766E]" />
                        Prescriptions ({prescriptions.length})
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {prescriptions.map((rx) => (
                          <div 
                            key={rx.id}
                            className="p-4 rounded-xl border border-slate-200 hover:border-[#0F766E]/30 transition-colors"
                            data-testid={`doc-rx-${rx.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-slate-900">
                                  {format(parseISO(rx.created_at), 'MMMM d, yyyy')}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {rx.medications?.length || 0} medication(s)
                                </p>
                                <div className="mt-2 space-y-1">
                                  {rx.medications?.slice(0, 2).map((med, i) => (
                                    <p key={i} className="text-xs text-slate-600">
                                      • {med.name} {med.dosage}
                                    </p>
                                  ))}
                                  {rx.medications?.length > 2 && (
                                    <p className="text-xs text-slate-400">+{rx.medications.length - 2} more</p>
                                  )}
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => reprintDocument(rx, 'prescription')}
                                className="text-[#0F766E] hover:bg-[#0F766E]/10"
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certificates */}
                  {certificates.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#0F766E]" />
                        Certificates ({certificates.length})
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {certificates.map((cert) => (
                          <div 
                            key={cert.id}
                            className="p-4 rounded-xl border border-slate-200 hover:border-[#0F766E]/30 transition-colors"
                            data-testid={`doc-cert-${cert.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  {cert.certificate_type === 'medical_certificate' && <Award className="w-4 h-4 text-blue-600" />}
                                  {cert.certificate_type === 'fit_to_work' && <Briefcase className="w-4 h-4 text-green-600" />}
                                  {cert.certificate_type === 'referral' && <Send className="w-4 h-4 text-purple-600" />}
                                  <span className="font-medium text-slate-900">{getCertificateTypeName(cert.certificate_type)}</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-1">
                                  {format(parseISO(cert.created_at), 'MMMM d, yyyy')}
                                </p>
                                {cert.certificate_type === 'medical_certificate' && cert.content?.diagnosis && (
                                  <p className="text-xs text-slate-600 mt-2 line-clamp-1">{cert.content.diagnosis}</p>
                                )}
                                {cert.certificate_type === 'referral' && cert.content?.to_specialty && (
                                  <p className="text-xs text-slate-600 mt-2">To: {cert.content.to_specialty}</p>
                                )}
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => reprintDocument(cert, 'certificate')}
                                className="text-[#0F766E] hover:bg-[#0F766E]/10"
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments">
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading">Attachments</CardTitle>
              <Dialog open={showUpload} onOpenChange={setShowUpload}>
                <DialogTrigger asChild>
                  <Button className="bg-[#0F766E] hover:bg-[#115E59]" data-testid="upload-attachment-btn">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Attachment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>File</Label>
                      <Input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => setUploadFile(e.target.files[0])}
                        accept="image/*,.pdf"
                        data-testid="file-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tag</Label>
                      <Select value={uploadData.tag} onValueChange={(v) => setUploadData({ ...uploadData, tag: v })}>
                        <SelectTrigger data-testid="tag-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lab">Lab Result</SelectItem>
                          <SelectItem value="x-ray">X-Ray</SelectItem>
                          <SelectItem value="ultrasound">Ultrasound</SelectItem>
                          <SelectItem value="ecg">ECG</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={uploadData.notes}
                        onChange={(e) => setUploadData({ ...uploadData, notes: e.target.value })}
                        placeholder="Optional notes..."
                        data-testid="notes-input"
                      />
                    </div>
                    <Button onClick={handleUpload} className="w-full bg-[#0F766E] hover:bg-[#115E59]" disabled={!uploadFile} data-testid="confirm-upload-btn">
                      Upload File
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Paperclip className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No attachments</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attachments.map((attachment) => (
                    <div 
                      key={attachment.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
                      data-testid={`attachment-${attachment.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {attachment.content_type?.startsWith('image/') ? (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                              <FileImage className="w-6 h-6 text-slate-500" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                              <FileText className="w-6 h-6 text-slate-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900 text-sm line-clamp-1">{attachment.filename}</p>
                            <Badge className={`${tagColors[attachment.tag]} text-xs mt-1`}>{attachment.tag}</Badge>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {attachment.notes && (
                        <p className="text-xs text-slate-500 mt-2">{attachment.notes}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        {format(parseISO(attachment.uploaded_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hidden Print Template */}
      {selectedDoc && (
        <div className="hidden">
          <div ref={docPrintRef} className="p-8 bg-white print-container">
            {/* Print Header */}
            <div className="print-header text-center border-b-2 border-[#0F766E] pb-4 mb-6">
              <h1 className="font-print text-2xl font-bold text-[#0F766E]">{settings.clinic_name || 'Private Clinic EMR'}</h1>
              {settings.address && <p className="text-sm text-slate-600">{settings.address}</p>}
              {settings.phone && <p className="text-sm text-slate-600">Tel: {settings.phone}</p>}
              {settings.license_no && <p className="text-xs text-slate-500">License No: {settings.license_no}</p>}
            </div>

            {/* Prescription Print */}
            {selectedDoc.docType === 'prescription' && (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">PRESCRIPTION</h2>
                </div>
                <div className="mb-6">
                  <p><strong>Patient:</strong> {patient.full_name}</p>
                  <p><strong>Age/Sex:</strong> {patient.age} years / {patient.sex}</p>
                  <p><strong>Date:</strong> {format(parseISO(selectedDoc.created_at), 'MMMM d, yyyy')}</p>
                </div>
                <div className="mb-8">
                  <p className="text-2xl font-bold mb-4">Rx</p>
                  {selectedDoc.medications?.map((med, i) => (
                    <div key={i} className="mb-4 pl-4">
                      <p className="font-medium">{i + 1}. {med.name} {med.dosage}</p>
                      <p className="pl-4 text-slate-600">Sig: {med.frequency} for {med.duration}</p>
                    </div>
                  ))}
                  {selectedDoc.notes && <p className="mt-4 text-sm italic">Note: {selectedDoc.notes}</p>}
                </div>
              </>
            )}

            {/* Certificate Print */}
            {selectedDoc.docType === 'certificate' && (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">{getCertificateTypeName(selectedDoc.certificate_type).toUpperCase()}</h2>
                </div>
                <div className="mb-6 space-y-4">
                  {selectedDoc.certificate_type === 'medical_certificate' && (
                    <>
                      <p>This is to certify that <strong>{patient.full_name}</strong>, {patient.age} years old, {patient.sex}, was seen and examined on <strong>{format(parseISO(selectedDoc.created_at), 'MMMM d, yyyy')}</strong>.</p>
                      {selectedDoc.content?.diagnosis && <p><strong>Diagnosis:</strong> {selectedDoc.content.diagnosis}</p>}
                      {selectedDoc.content?.start_date && selectedDoc.content?.end_date && (
                        <p><strong>Rest Period:</strong> {format(parseISO(selectedDoc.content.start_date), 'MMMM d, yyyy')} to {format(parseISO(selectedDoc.content.end_date), 'MMMM d, yyyy')}</p>
                      )}
                      {selectedDoc.content?.remarks && <p><strong>Remarks:</strong> {selectedDoc.content.remarks}</p>}
                    </>
                  )}
                  {selectedDoc.certificate_type === 'fit_to_work' && (
                    <>
                      <p>This is to certify that <strong>{patient.full_name}</strong>, {patient.age} years old, {patient.sex}, was examined on {selectedDoc.content?.examined_date && format(parseISO(selectedDoc.content.examined_date), 'MMMM d, yyyy')}.</p>
                      <p>The above-named patient is deemed <strong>FIT TO RESUME WORK</strong> effective {selectedDoc.content?.fit_date && format(parseISO(selectedDoc.content.fit_date), 'MMMM d, yyyy')}.</p>
                      {selectedDoc.content?.restrictions && <p><strong>Restrictions:</strong> {selectedDoc.content.restrictions}</p>}
                    </>
                  )}
                  {selectedDoc.certificate_type === 'referral' && (
                    <>
                      <p><strong>To:</strong> {selectedDoc.content?.to_doctor} ({selectedDoc.content?.to_specialty})</p>
                      <p><strong>Re:</strong> {patient.full_name}, {patient.age} years old, {patient.sex}</p>
                      <p><strong>Date:</strong> {format(parseISO(selectedDoc.created_at), 'MMMM d, yyyy')}</p>
                      <div className="mt-6">
                        <p>Dear Colleague,</p>
                        <p className="mt-4">I am referring the above-named patient for your expert evaluation and management.</p>
                        {selectedDoc.content?.reason && <p className="mt-4"><strong>Reason for Referral:</strong> {selectedDoc.content.reason}</p>}
                        {selectedDoc.content?.findings && <p className="mt-4"><strong>Clinical Findings:</strong> {selectedDoc.content.findings}</p>}
                        <p className="mt-4">Thank you for your kind attention to this patient.</p>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Doctor Signature */}
            <div className="mt-12 pt-6 border-t">
              <div className="text-right">
                <div className="inline-block text-center">
                  <div className="w-48 border-b border-slate-900 mb-1"></div>
                  <p className="font-medium">{user?.full_name}</p>
                  {user?.license_no && <p className="text-sm text-slate-600">License No: {user.license_no}</p>}
                  {user?.ptr_no && <p className="text-sm text-slate-600">PTR No: {user.ptr_no}</p>}
                  {user?.prc_no && <p className="text-sm text-slate-600">PRC No: {user.prc_no}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProfilePage;
