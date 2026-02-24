import React, { useState, useEffect, useRef } from 'react';
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
  Stethoscope, Clock, ArrowLeft, Paperclip, X, Pill, Award, Briefcase, Send, Printer, AlertCircle
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
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
          <TabsTrigger value="visits" data-testid="tab-visits">Visits ({visits.length})</TabsTrigger>
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
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                              <img 
                                src={`data:${attachment.content_type};base64,${attachment.file_data}`} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
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
