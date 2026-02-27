import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../context/AuthContext';
import { visitAPI, patientAPI, prescriptionAPI, certificateAPI, settingsAPI, attachmentAPI, labRequestAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  ArrowLeft, Printer, Activity, FileText, Plus, Trash2,
  Pill, Award, Briefcase, Send, Microscope, FileImage, File,
  Eye, Download, ZoomIn, ZoomOut, Maximize2, RotateCcw, Edit
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

const VisitDetailPage = () => {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const { user, isDoctor } = useAuth();
  
  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [savedPrescriptions, setSavedPrescriptions] = useState([]);
  const [savedCertificates, setSavedCertificates] = useState([]);
  const [savedLabRequests, setSavedLabRequests] = useState([]);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [selectedLabRequest, setSelectedLabRequest] = useState(null);
  const [showViewRx, setShowViewRx] = useState(false);
  const [showViewCert, setShowViewCert] = useState(false);
  const [showViewLabReq, setShowViewLabReq] = useState(false);
  
  // Labs & Imaging state
  const [labAttachments, setLabAttachments] = useState([]);
  const [viewingAttachment, setViewingAttachment] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Print refs
  const prescriptionRef = useRef();
  const medCertRef = useRef();
  const fitToWorkRef = useRef();
  const referralRef = useRef();
  const soapRef = useRef();
  const savedRxRef = useRef();
  const savedCertRef = useRef();
  const labRequestRef = useRef();
  const savedLabReqRef = useRef();
  
  // Form states
  const [showRx, setShowRx] = useState(false);
  const [showMedCert, setShowMedCert] = useState(false);
  const [showFitToWork, setShowFitToWork] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [showLabRequest, setShowLabRequest] = useState(false);
  const [showEditSoap, setShowEditSoap] = useState(false);
  
  const [rxData, setRxData] = useState({ medications: [{ name: '', dosage: '', frequency: '', duration: '' }], notes: '' });
  const [medCertData, setMedCertData] = useState({ diagnosis: '', start_date: '', end_date: '', remarks: '' });
  const [fitToWorkData, setFitToWorkData] = useState({ examined_date: '', fit_date: '', restrictions: '' });
  const [referralData, setReferralData] = useState({ to_doctor: '', to_specialty: '', reason: '', findings: '' });
  const [labRequestData, setLabRequestData] = useState({ 
    request_type: 'lab', 
    tests: [{ name: '', instructions: '' }], 
    clinical_info: '', 
    urgency: 'routine' 
  });
  const [soapEditData, setSoapEditData] = useState({
    soap_subjective: '',
    soap_objective: '',
    soap_assessment: '',
    soap_plan: '',
    follow_up_date: ''
  });

  useEffect(() => {
    fetchData();
  }, [visitId]);

  const fetchData = async () => {
    try {
      const [visitRes, settingsRes, rxRes, certRes, labReqRes] = await Promise.all([
        visitAPI.getOne(visitId),
        settingsAPI.get(),
        prescriptionAPI.getAll({ visit_id: visitId }),
        certificateAPI.getAll({ visit_id: visitId }),
        labRequestAPI.getAll({ visit_id: visitId })
      ]);
      setVisit(visitRes.data);
      setSettings(settingsRes.data);
      setSavedPrescriptions(rxRes.data);
      setSavedCertificates(certRes.data);
      setSavedLabRequests(labReqRes.data);
      
      const patientRes = await patientAPI.getOne(visitRes.data.patient_id);
      setPatient(patientRes.data);
      
      // Fetch lab/imaging attachments uploaded BEFORE this visit but AFTER the previous visit
      try {
        const [attRes, visitsRes] = await Promise.all([
          attachmentAPI.getAll({ patient_id: visitRes.data.patient_id }),
          visitAPI.getAll({ patient_id: visitRes.data.patient_id })
        ]);
        const allLabs = (attRes.data || []).filter(a => ['lab', 'x-ray', 'ultrasound', 'ecg'].includes(a.tag));
        const allVisits = (visitsRes.data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const thisVisitTime = new Date(visitRes.data.created_at).getTime();
        const thisIdx = allVisits.findIndex(v => v.id === visitId);
        const prevVisitTime = thisIdx < allVisits.length - 1 ? new Date(allVisits[thisIdx + 1].created_at).getTime() : 0;
        const filteredLabs = allLabs.filter(a => {
          const t = new Date(a.uploaded_at).getTime();
          return t > prevVisitTime && t <= thisVisitTime;
        });
        setLabAttachments(filteredLabs);
      } catch (e) { /* silent */ }
    } catch (error) {
      toast.error('Failed to load visit');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Print handlers
  const handlePrintRx = useReactToPrint({ contentRef: prescriptionRef, documentTitle: 'Prescription' });
  const handlePrintMedCert = useReactToPrint({ contentRef: medCertRef, documentTitle: 'Medical_Certificate' });
  const handlePrintFitToWork = useReactToPrint({ contentRef: fitToWorkRef, documentTitle: 'Fit_To_Work' });
  const handlePrintReferral = useReactToPrint({ contentRef: referralRef, documentTitle: 'Referral' });
  const handlePrintSOAP = useReactToPrint({ contentRef: soapRef, documentTitle: 'Consultation_Notes' });
  const handlePrintSavedRx = useReactToPrint({ contentRef: savedRxRef, documentTitle: 'Prescription' });
  const handlePrintSavedCert = useReactToPrint({ contentRef: savedCertRef, documentTitle: 'Certificate' });

  const addMedication = () => {
    setRxData({
      ...rxData,
      medications: [...rxData.medications, { name: '', dosage: '', frequency: '', duration: '' }]
    });
  };

  const removeMedication = (index) => {
    setRxData({
      ...rxData,
      medications: rxData.medications.filter((_, i) => i !== index)
    });
  };

  const updateMedication = (index, field, value) => {
    const updated = [...rxData.medications];
    updated[index][field] = value;
    setRxData({ ...rxData, medications: updated });
  };

  const savePrescription = async () => {
    try {
      await prescriptionAPI.create({
        visit_id: visitId,
        patient_id: patient.id,
        medications: rxData.medications,
        notes: rxData.notes
      });
      toast.success('Prescription saved');
      // Close dialog first, then print after a short delay
      setShowRx(false);
      // Use setTimeout to ensure the print template is rendered
      setTimeout(() => {
        handlePrintRx();
        fetchData(); // Refresh to show saved form
      }, 300);
    } catch (error) {
      toast.error('Failed to save prescription');
    }
  };

  const saveCertificate = async (type, data) => {
    try {
      await certificateAPI.create({
        visit_id: visitId,
        patient_id: patient.id,
        certificate_type: type,
        content: data
      });
      toast.success('Certificate saved');
      // Close dialogs first
      setShowMedCert(false);
      setShowFitToWork(false);
      setShowReferral(false);
      // Then print after a short delay
      setTimeout(() => {
        if (type === 'medical_certificate') handlePrintMedCert();
        else if (type === 'fit_to_work') handlePrintFitToWork();
        else if (type === 'referral') handlePrintReferral();
        fetchData(); // Refresh to show saved form
      }, 300);
    } catch (error) {
      toast.error('Failed to save certificate');
    }
  };

  const reprintPrescription = (rx) => {
    setSelectedPrescription(rx);
    setTimeout(() => handlePrintSavedRx(), 100);
  };

  const reprintCertificate = (cert) => {
    setSelectedCertificate(cert);
    setTimeout(() => handlePrintSavedCert(), 100);
  };

  const viewPrescription = (rx) => {
    setSelectedPrescription(rx);
    setShowViewRx(true);
  };

  const viewCertificate = (cert) => {
    setSelectedCertificate(cert);
    setShowViewCert(true);
  };

  const getCertificateTypeName = (type) => {
    const names = {
      'medical_certificate': 'Medical Certificate',
      'fit_to_work': 'Fit-to-Work Certificate',
      'referral': 'Referral Letter'
    };
    return names[type] || type;
  };

  // Lab Request handlers
  const handlePrintLabRequest = useReactToPrint({ contentRef: labRequestRef });
  const handlePrintSavedLabReq = useReactToPrint({ contentRef: savedLabReqRef });

  const addTest = () => {
    setLabRequestData(prev => ({
      ...prev,
      tests: [...prev.tests, { name: '', instructions: '' }]
    }));
  };

  const removeTest = (index) => {
    setLabRequestData(prev => ({
      ...prev,
      tests: prev.tests.filter((_, i) => i !== index)
    }));
  };

  const updateTest = (index, field, value) => {
    setLabRequestData(prev => ({
      ...prev,
      tests: prev.tests.map((t, i) => i === index ? { ...t, [field]: value } : t)
    }));
  };

  const saveLabRequest = async () => {
    try {
      await labRequestAPI.create({
        visit_id: visitId,
        patient_id: patient.id,
        request_type: labRequestData.request_type,
        tests: labRequestData.tests.filter(t => t.name.trim()),
        clinical_info: labRequestData.clinical_info,
        urgency: labRequestData.urgency
      });
      toast.success('Lab/Imaging request saved');
      setShowLabRequest(false);
      setTimeout(() => {
        handlePrintLabRequest();
        fetchData();
      }, 300);
    } catch (error) {
      toast.error('Failed to save request');
    }
  };

  const reprintLabRequest = (req) => {
    setSelectedLabRequest(req);
    setTimeout(() => handlePrintSavedLabReq(), 100);
  };

  const viewLabRequest = (req) => {
    setSelectedLabRequest(req);
    setShowViewLabReq(true);
  };

  // SOAP Edit handlers
  const openEditSoap = () => {
    setSoapEditData({
      soap_subjective: visit.soap_subjective || '',
      soap_objective: visit.soap_objective || '',
      soap_assessment: visit.soap_assessment || '',
      soap_plan: visit.soap_plan || '',
      follow_up_date: visit.follow_up_date || ''
    });
    setShowEditSoap(true);
  };

  const saveSoapEdit = async () => {
    try {
      await visitAPI.update(visitId, soapEditData);
      toast.success('SOAP notes updated');
      setShowEditSoap(false);
      fetchData(); // Refresh data
    } catch (error) {
      toast.error('Failed to update SOAP notes');
    }
  };

  const tagColors = {
    lab: 'bg-purple-100 text-purple-800',
    'x-ray': 'bg-blue-100 text-blue-800',
    ultrasound: 'bg-cyan-100 text-cyan-800',
    ecg: 'bg-rose-100 text-rose-800',
  };

  const handleViewAttachment = async (attachmentId) => {
    try {
      const res = await attachmentAPI.getOne(attachmentId);
      const att = res.data;
      if (att.content_type?.startsWith('image/')) {
        setZoom(1); setPan({ x: 0, y: 0 });
        setViewingAttachment(att);
      } else if (att.content_type === 'application/pdf') {
        const byteChars = atob(att.file_data);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else {
        const byteChars = atob(att.file_data);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: att.content_type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = att.filename; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast.error('Failed to load file');
    }
  };

  const downloadFile = (att) => {
    const byteChars = atob(att.file_data);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: att.content_type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = att.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const resetViewer = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);
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

  if (loading || !visit || !patient) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
      </div>
    );
  }

  const PrintHeader = () => (
    <div className="print-header text-center border-b-2 border-[#0F766E] pb-4 mb-6">
      <h1 className="font-print text-2xl font-bold text-[#0F766E]">{settings.clinic_name || 'Private Clinic EMR'}</h1>
      {settings.address && <p className="text-sm text-slate-600">{settings.address}</p>}
      {settings.phone && <p className="text-sm text-slate-600">Tel: {settings.phone}</p>}
      {settings.license_no && <p className="text-xs text-slate-500">License No: {settings.license_no}</p>}
    </div>
  );

  const DoctorSignature = () => (
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
  );

  return (
    <div className="space-y-6" data-testid="visit-detail-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(`/patients/${patient.id}`)} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold text-slate-900">Visit Details</h1>
          <p className="text-slate-500 font-body">
            {patient.full_name} • {format(parseISO(visit.created_at), 'MMMM d, yyyy h:mm a')}
          </p>
        </div>
        {isDoctor && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintSOAP} data-testid="print-soap-btn">
              <Printer className="w-4 h-4 mr-2" />
              Print SOAP
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Visit Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vitals */}
          {visit.vitals && (
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#0F766E]" />
                  Vital Signs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {visit.vitals.bp_systolic && visit.vitals.bp_diastolic && (
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500">Blood Pressure</p>
                      <p className="text-lg font-semibold">{visit.vitals.bp_systolic}/{visit.vitals.bp_diastolic} mmHg</p>
                    </div>
                  )}
                  {visit.vitals.heart_rate && (
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500">Heart Rate</p>
                      <p className="text-lg font-semibold">{visit.vitals.heart_rate} bpm</p>
                    </div>
                  )}
                  {visit.vitals.respiratory_rate && (
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500">Respiratory Rate</p>
                      <p className="text-lg font-semibold">{visit.vitals.respiratory_rate} cpm</p>
                    </div>
                  )}
                  {visit.vitals.temperature && (
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500">Temperature</p>
                      <p className="text-lg font-semibold">{visit.vitals.temperature}°C</p>
                    </div>
                  )}
                  {visit.vitals.spo2 && (
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500">SpO2</p>
                      <p className="text-lg font-semibold">{visit.vitals.spo2}%</p>
                    </div>
                  )}
                  {visit.vitals.weight && (
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500">Weight</p>
                      <p className="text-lg font-semibold">{visit.vitals.weight} kg</p>
                    </div>
                  )}
                  {visit.vitals.height && (
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500">Height</p>
                      <p className="text-lg font-semibold">{visit.vitals.height} cm</p>
                    </div>
                  )}
                  {visit.vitals.bmi && (
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500">BMI</p>
                      <p className="text-lg font-semibold">{visit.vitals.bmi}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SOAP Notes */}
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0F766E]" />
                SOAP Notes
              </CardTitle>
              {isDoctor && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={openEditSoap}
                  className="text-[#0F766E] hover:bg-[#0F766E]/10"
                  data-testid="edit-soap-btn"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {visit.soap_subjective && (
                <div>
                  <Badge className="mb-2 bg-blue-100 text-blue-800">S - Subjective</Badge>
                  <p className="text-slate-700 whitespace-pre-wrap">{visit.soap_subjective}</p>
                </div>
              )}
              {visit.soap_objective && (
                <div>
                  <Badge className="mb-2 bg-green-100 text-green-800">O - Objective</Badge>
                  <p className="text-slate-700 whitespace-pre-wrap">{visit.soap_objective}</p>
                </div>
              )}
              {visit.soap_assessment && (
                <div>
                  <Badge className="mb-2 bg-amber-100 text-amber-800">A - Assessment</Badge>
                  <p className="text-slate-700 whitespace-pre-wrap">{visit.soap_assessment}</p>
                </div>
              )}
              {visit.soap_plan && (
                <div>
                  <Badge className="mb-2 bg-purple-100 text-purple-800">P - Plan</Badge>
                  <p className="text-slate-700 whitespace-pre-wrap">{visit.soap_plan}</p>
                </div>
              )}
              {visit.follow_up_date && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-slate-500">Follow-up: {format(parseISO(visit.follow_up_date), 'MMMM d, yyyy')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Labs & Imaging */}
          {labAttachments.length > 0 && (
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Microscope className="w-5 h-5 text-[#0F766E]" />
                  Labs & Imaging
                  <Badge variant="outline" className="ml-1 font-mono text-xs">{labAttachments.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="visit-detail-labs-list">
                  {labAttachments.map((att) => (
                    <div key={att.id} className="flex justify-end" data-testid={`detail-lab-item-${att.id}`}>
                      <div className="max-w-[80%] sm:max-w-[70%]">
                        <div
                          className="rounded-2xl rounded-br-md bg-[#0F766E] text-white p-3 cursor-pointer hover:bg-[#115E59] transition-colors group"
                          onClick={() => handleViewAttachment(att.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                              {att.content_type?.startsWith('image/') ? <FileImage className="w-4 h-4 text-white" /> : <File className="w-4 h-4 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{att.filename}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] uppercase tracking-wider bg-white/20 rounded-full px-2 py-0.5">{att.tag}</span>
                                <span className="text-xs opacity-75">{att.content_type?.startsWith('image/') ? 'Tap to view' : 'Tap to open'}</span>
                              </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              {att.content_type?.startsWith('image/') ? <Eye className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                            </div>
                          </div>
                          {att.notes && <p className="text-xs text-white/80 mt-1.5 pl-12">{att.notes}</p>}
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-1 px-1">
                          <span className="text-[11px] text-slate-400">{format(parseISO(att.uploaded_at), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Patient Instructions */}
          {(visit.patient_instructions || visit.warning_signs) && (
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading">Patient Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {visit.patient_instructions && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">Instructions</p>
                    <p className="text-slate-600 whitespace-pre-wrap">{visit.patient_instructions}</p>
                  </div>
                )}
                {visit.warning_signs && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm font-medium text-red-800 mb-1">Warning Signs - Return Immediately If:</p>
                    <p className="text-red-700 whitespace-pre-wrap">{visit.warning_signs}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Print Actions */}
        {isDoctor && (
          <div className="space-y-4">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading text-lg">Print Forms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Prescription */}
                <Dialog open={showRx} onOpenChange={setShowRx}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" data-testid="create-rx-btn">
                      <Pill className="w-4 h-4 mr-2 text-[#0F766E]" />
                      Prescription (Rx)
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Prescription</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      {rxData.medications.map((med, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="font-medium">Medication #{index + 1}</Label>
                            {rxData.medications.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => removeMedication(index)} className="text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Input placeholder="Medication name" value={med.name} onChange={(e) => updateMedication(index, 'name', e.target.value)} />
                            <Input placeholder="Dosage (e.g., 500mg)" value={med.dosage} onChange={(e) => updateMedication(index, 'dosage', e.target.value)} />
                            <Input placeholder="Frequency (e.g., TID)" value={med.frequency} onChange={(e) => updateMedication(index, 'frequency', e.target.value)} />
                            <Input placeholder="Duration (e.g., 7 days)" value={med.duration} onChange={(e) => updateMedication(index, 'duration', e.target.value)} />
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={addMedication} className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Medication
                      </Button>
                      <div className="space-y-2">
                        <Label>Additional Notes</Label>
                        <Textarea value={rxData.notes} onChange={(e) => setRxData({ ...rxData, notes: e.target.value })} placeholder="Special instructions..." />
                      </div>
                      <Button onClick={savePrescription} className="w-full bg-[#0F766E] hover:bg-[#115E59]" data-testid="print-rx-btn">
                        <Printer className="w-4 h-4 mr-2" />
                        Save & Print
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Medical Certificate */}
                <Dialog open={showMedCert} onOpenChange={setShowMedCert}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" data-testid="create-medcert-btn">
                      <Award className="w-4 h-4 mr-2 text-[#0F766E]" />
                      Medical Certificate
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Medical Certificate</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Diagnosis</Label>
                        <Textarea value={medCertData.diagnosis} onChange={(e) => setMedCertData({ ...medCertData, diagnosis: e.target.value })} placeholder="Patient's diagnosis..." />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Rest Period Start</Label>
                          <Input type="date" value={medCertData.start_date} onChange={(e) => setMedCertData({ ...medCertData, start_date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Rest Period End</Label>
                          <Input type="date" value={medCertData.end_date} onChange={(e) => setMedCertData({ ...medCertData, end_date: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Remarks</Label>
                        <Textarea value={medCertData.remarks} onChange={(e) => setMedCertData({ ...medCertData, remarks: e.target.value })} placeholder="Additional remarks..." />
                      </div>
                      <Button onClick={() => saveCertificate('medical_certificate', medCertData)} className="w-full bg-[#0F766E] hover:bg-[#115E59]">
                        <Printer className="w-4 h-4 mr-2" />
                        Save & Print
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Fit to Work */}
                <Dialog open={showFitToWork} onOpenChange={setShowFitToWork}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" data-testid="create-fit-btn">
                      <Briefcase className="w-4 h-4 mr-2 text-[#0F766E]" />
                      Fit-to-Work
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Fit-to-Work Certificate</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Date Examined</Label>
                        <Input type="date" value={fitToWorkData.examined_date} onChange={(e) => setFitToWorkData({ ...fitToWorkData, examined_date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fit to Resume Work Date</Label>
                        <Input type="date" value={fitToWorkData.fit_date} onChange={(e) => setFitToWorkData({ ...fitToWorkData, fit_date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Restrictions (if any)</Label>
                        <Textarea value={fitToWorkData.restrictions} onChange={(e) => setFitToWorkData({ ...fitToWorkData, restrictions: e.target.value })} placeholder="Work restrictions..." />
                      </div>
                      <Button onClick={() => saveCertificate('fit_to_work', fitToWorkData)} className="w-full bg-[#0F766E] hover:bg-[#115E59]">
                        <Printer className="w-4 h-4 mr-2" />
                        Save & Print
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Referral */}
                <Dialog open={showReferral} onOpenChange={setShowReferral}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" data-testid="create-referral-btn">
                      <Send className="w-4 h-4 mr-2 text-[#0F766E]" />
                      Referral Letter
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Referral Letter</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Refer To (Doctor Name)</Label>
                        <Input value={referralData.to_doctor} onChange={(e) => setReferralData({ ...referralData, to_doctor: e.target.value })} placeholder="Dr. Juan Santos" />
                      </div>
                      <div className="space-y-2">
                        <Label>Specialty</Label>
                        <Input value={referralData.to_specialty} onChange={(e) => setReferralData({ ...referralData, to_specialty: e.target.value })} placeholder="Cardiology, Neurology, etc." />
                      </div>
                      <div className="space-y-2">
                        <Label>Reason for Referral</Label>
                        <Textarea value={referralData.reason} onChange={(e) => setReferralData({ ...referralData, reason: e.target.value })} placeholder="Reason for referral..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Clinical Findings</Label>
                        <Textarea value={referralData.findings} onChange={(e) => setReferralData({ ...referralData, findings: e.target.value })} placeholder="Relevant findings..." />
                      </div>
                      <Button onClick={() => saveCertificate('referral', referralData)} className="w-full bg-[#0F766E] hover:bg-[#115E59]">
                        <Printer className="w-4 h-4 mr-2" />
                        Save & Print
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Lab/Imaging Request */}
                <Dialog open={showLabRequest} onOpenChange={setShowLabRequest}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" data-testid="create-labreq-btn">
                      <Microscope className="w-4 h-4 mr-2 text-[#0F766E]" />
                      Lab/Imaging Request
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Lab/Imaging Request</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Request Type</Label>
                          <Select value={labRequestData.request_type} onValueChange={(v) => setLabRequestData({ ...labRequestData, request_type: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lab">Laboratory</SelectItem>
                              <SelectItem value="imaging">Imaging/Radiology</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Urgency</Label>
                          <Select value={labRequestData.urgency} onValueChange={(v) => setLabRequestData({ ...labRequestData, urgency: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="routine">Routine</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                              <SelectItem value="stat">STAT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Clinical Information</Label>
                        <Textarea 
                          value={labRequestData.clinical_info} 
                          onChange={(e) => setLabRequestData({ ...labRequestData, clinical_info: e.target.value })} 
                          placeholder="Relevant clinical history, symptoms, diagnosis..."
                        />
                      </div>
                      <div className="space-y-3">
                        <Label>Tests/Procedures Requested</Label>
                        {labRequestData.tests.map((test, index) => (
                          <div key={index} className="p-3 border rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Test #{index + 1}</span>
                              {labRequestData.tests.length > 1 && (
                                <Button variant="ghost" size="sm" onClick={() => removeTest(index)} className="text-red-500 h-6 px-2">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            <Input 
                              placeholder="Test name (e.g., CBC, Chest X-Ray, ECG)" 
                              value={test.name} 
                              onChange={(e) => updateTest(index, 'name', e.target.value)} 
                            />
                            <Input 
                              placeholder="Special instructions (optional)" 
                              value={test.instructions} 
                              onChange={(e) => updateTest(index, 'instructions', e.target.value)} 
                            />
                          </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addTest} className="w-full">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Test
                        </Button>
                      </div>
                      <Button onClick={saveLabRequest} className="w-full bg-[#0F766E] hover:bg-[#115E59]" data-testid="print-labreq-btn">
                        <Printer className="w-4 h-4 mr-2" />
                        Save & Print
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Saved Forms Section */}
            {(savedPrescriptions.length > 0 || savedCertificates.length > 0 || savedLabRequests.length > 0) && (
              <Card className="bg-white border-slate-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#0F766E]" />
                    Saved Forms
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {savedPrescriptions.map((rx) => (
                    <div 
                      key={rx.id} 
                      className="p-3 rounded-lg border border-slate-200 hover:border-[#0F766E]/30 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => viewPrescription(rx)}
                      data-testid={`saved-rx-${rx.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Pill className="w-4 h-4 text-[#0F766E]" />
                          <span className="font-medium text-sm">Prescription</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); reprintPrescription(rx); }}
                          className="h-8 px-2 text-[#0F766E] hover:bg-[#0F766E]/10"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {rx.medications?.length || 0} medication(s) • {format(parseISO(rx.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  ))}
                  {savedCertificates.map((cert) => (
                    <div 
                      key={cert.id} 
                      className="p-3 rounded-lg border border-slate-200 hover:border-[#0F766E]/30 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => viewCertificate(cert)}
                      data-testid={`saved-cert-${cert.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {cert.certificate_type === 'medical_certificate' && <Award className="w-4 h-4 text-[#0F766E]" />}
                          {cert.certificate_type === 'fit_to_work' && <Briefcase className="w-4 h-4 text-[#0F766E]" />}
                          {cert.certificate_type === 'referral' && <Send className="w-4 h-4 text-[#0F766E]" />}
                          <span className="font-medium text-sm">{getCertificateTypeName(cert.certificate_type)}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); reprintCertificate(cert); }}
                          className="h-8 px-2 text-[#0F766E] hover:bg-[#0F766E]/10"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {format(parseISO(cert.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  ))}
                  {savedLabRequests.map((req) => (
                    <div 
                      key={req.id} 
                      className="p-3 rounded-lg border border-slate-200 hover:border-[#0F766E]/30 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => viewLabRequest(req)}
                      data-testid={`saved-labreq-${req.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Microscope className="w-4 h-4 text-[#0F766E]" />
                          <span className="font-medium text-sm">{req.request_type === 'lab' ? 'Laboratory' : 'Imaging'} Request</span>
                          {req.urgency !== 'routine' && (
                            <Badge className={req.urgency === 'stat' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>
                              {req.urgency.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); reprintLabRequest(req); }}
                          className="h-8 px-2 text-[#0F766E] hover:bg-[#0F766E]/10"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {req.tests?.length || 0} test(s) • {format(parseISO(req.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* View Prescription Modal */}
            <Dialog open={showViewRx} onOpenChange={setShowViewRx}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Pill className="w-5 h-5 text-[#0F766E]" />
                    Prescription Details
                  </DialogTitle>
                </DialogHeader>
                {selectedPrescription && (
                  <div className="space-y-4 mt-4">
                    <div className="p-3 rounded-lg bg-slate-50 space-y-1">
                      <p className="text-sm"><strong>Patient:</strong> {patient?.full_name}</p>
                      <p className="text-sm"><strong>Date:</strong> {format(parseISO(selectedPrescription.created_at), 'MMMM d, yyyy h:mm a')}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 mb-2">Medications</h4>
                      <div className="space-y-2">
                        {selectedPrescription.medications?.map((med, i) => (
                          <div key={i} className="p-3 rounded-lg border border-slate-200">
                            <p className="font-medium text-slate-900">{i + 1}. {med.name} {med.dosage}</p>
                            <p className="text-sm text-slate-600">Sig: {med.frequency} for {med.duration}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {selectedPrescription.notes && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-sm text-amber-800"><strong>Notes:</strong> {selectedPrescription.notes}</p>
                      </div>
                    )}
                    <Button 
                      onClick={() => { setShowViewRx(false); reprintPrescription(selectedPrescription); }}
                      className="w-full bg-[#0F766E] hover:bg-[#115E59]"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print Prescription
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* View Certificate Modal */}
            <Dialog open={showViewCert} onOpenChange={setShowViewCert}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selectedCertificate?.certificate_type === 'medical_certificate' && <Award className="w-5 h-5 text-[#0F766E]" />}
                    {selectedCertificate?.certificate_type === 'fit_to_work' && <Briefcase className="w-5 h-5 text-[#0F766E]" />}
                    {selectedCertificate?.certificate_type === 'referral' && <Send className="w-5 h-5 text-[#0F766E]" />}
                    {selectedCertificate && getCertificateTypeName(selectedCertificate.certificate_type)}
                  </DialogTitle>
                </DialogHeader>
                {selectedCertificate && (
                  <div className="space-y-4 mt-4">
                    <div className="p-3 rounded-lg bg-slate-50 space-y-1">
                      <p className="text-sm"><strong>Patient:</strong> {patient?.full_name}</p>
                      <p className="text-sm"><strong>Date:</strong> {format(parseISO(selectedCertificate.created_at), 'MMMM d, yyyy h:mm a')}</p>
                    </div>
                    
                    {selectedCertificate.certificate_type === 'medical_certificate' && (
                      <div className="space-y-3">
                        {selectedCertificate.content?.diagnosis && (
                          <div className="p-3 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Diagnosis</p>
                            <p className="font-medium text-slate-900">{selectedCertificate.content.diagnosis}</p>
                          </div>
                        )}
                        {selectedCertificate.content?.start_date && selectedCertificate.content?.end_date && (
                          <div className="p-3 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Rest Period</p>
                            <p className="font-medium text-slate-900">
                              {format(parseISO(selectedCertificate.content.start_date), 'MMM d, yyyy')} to {format(parseISO(selectedCertificate.content.end_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        )}
                        {selectedCertificate.content?.remarks && (
                          <div className="p-3 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Remarks</p>
                            <p className="text-slate-900">{selectedCertificate.content.remarks}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedCertificate.certificate_type === 'fit_to_work' && (
                      <div className="space-y-3">
                        {selectedCertificate.content?.examined_date && (
                          <div className="p-3 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Date Examined</p>
                            <p className="font-medium text-slate-900">{format(parseISO(selectedCertificate.content.examined_date), 'MMMM d, yyyy')}</p>
                          </div>
                        )}
                        {selectedCertificate.content?.fit_date && (
                          <div className="p-3 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Fit to Resume Work</p>
                            <p className="font-medium text-slate-900">{format(parseISO(selectedCertificate.content.fit_date), 'MMMM d, yyyy')}</p>
                          </div>
                        )}
                        {selectedCertificate.content?.restrictions && (
                          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <p className="text-xs text-amber-600 mb-1">Restrictions</p>
                            <p className="text-amber-800">{selectedCertificate.content.restrictions}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedCertificate.certificate_type === 'referral' && (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border border-slate-200">
                          <p className="text-xs text-slate-500 mb-1">Referred To</p>
                          <p className="font-medium text-slate-900">{selectedCertificate.content?.to_doctor}</p>
                          <p className="text-sm text-slate-600">{selectedCertificate.content?.to_specialty}</p>
                        </div>
                        {selectedCertificate.content?.reason && (
                          <div className="p-3 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Reason for Referral</p>
                            <p className="text-slate-900">{selectedCertificate.content.reason}</p>
                          </div>
                        )}
                        {selectedCertificate.content?.findings && (
                          <div className="p-3 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Clinical Findings</p>
                            <p className="text-slate-900">{selectedCertificate.content.findings}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <Button 
                      onClick={() => { setShowViewCert(false); reprintCertificate(selectedCertificate); }}
                      className="w-full bg-[#0F766E] hover:bg-[#115E59]"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print Certificate
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* View Lab Request Modal */}
            <Dialog open={showViewLabReq} onOpenChange={setShowViewLabReq}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Microscope className="w-5 h-5 text-[#0F766E]" />
                    {selectedLabRequest?.request_type === 'lab' ? 'Laboratory' : 'Imaging'} Request Details
                  </DialogTitle>
                </DialogHeader>
                {selectedLabRequest && (
                  <div className="space-y-4 mt-4">
                    <div className="p-3 rounded-lg bg-slate-50 space-y-1">
                      <p className="text-sm"><strong>Patient:</strong> {patient?.full_name}</p>
                      <p className="text-sm"><strong>Date:</strong> {format(parseISO(selectedLabRequest.created_at), 'MMMM d, yyyy h:mm a')}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm"><strong>Urgency:</strong></span>
                        <Badge className={
                          selectedLabRequest.urgency === 'stat' ? 'bg-red-100 text-red-800' :
                          selectedLabRequest.urgency === 'urgent' ? 'bg-amber-100 text-amber-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {selectedLabRequest.urgency.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    {selectedLabRequest.clinical_info && (
                      <div className="p-3 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Clinical Information</p>
                        <p className="text-slate-900">{selectedLabRequest.clinical_info}</p>
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-slate-900 mb-2">Tests Requested</h4>
                      <div className="space-y-2">
                        {selectedLabRequest.tests?.map((test, i) => (
                          <div key={i} className="p-3 rounded-lg border border-slate-200">
                            <p className="font-medium text-slate-900">{i + 1}. {test.name}</p>
                            {test.instructions && (
                              <p className="text-sm text-slate-600 mt-1">Instructions: {test.instructions}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button 
                      onClick={() => { setShowViewLabReq(false); reprintLabRequest(selectedLabRequest); }}
                      className="w-full bg-[#0F766E] hover:bg-[#115E59]"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print Request
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

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
              <div
                className="relative bg-slate-950 overflow-hidden select-none"
                style={{ height: '55vh', cursor: isPanning ? 'grabbing' : 'grab' }}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                data-testid="detail-lab-image-viewer-area"
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
                />
              </div>
              <div className="px-5 py-3 bg-white border-t border-slate-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={`${tagColors[viewingAttachment.tag]} text-xs flex-shrink-0`}>{viewingAttachment.tag}</Badge>
                    {viewingAttachment.notes && <span className="text-sm text-slate-500 truncate">{viewingAttachment.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} disabled={zoom <= 0.25}><ZoomOut className="w-4 h-4" /></Button>
                    <input type="range" min="25" max="500" step="5" value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} className="w-24 h-1.5 accent-[#0F766E] cursor-pointer" />
                    <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(5, z + 0.25))} disabled={zoom >= 5}><ZoomIn className="w-4 h-4" /></Button>
                    <span className="text-xs text-slate-500 w-12 text-center font-mono">{Math.round(zoom * 100)}%</span>
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    <Button variant="ghost" size="sm" onClick={resetViewer}><RotateCcw className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Maximize2 className="w-4 h-4" /></Button>
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    <Button variant="outline" size="sm" onClick={() => downloadFile(viewingAttachment)}><Download className="w-4 h-4 mr-1" />Download</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden Print Templates */}
      <div className="hidden">
        {/* Prescription Print */}
        <div ref={prescriptionRef} className="p-8 bg-white print-container">
          <PrintHeader />
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">PRESCRIPTION</h2>
          </div>
          <div className="mb-6">
            <p><strong>Patient:</strong> {patient.full_name}</p>
            <p><strong>Age/Sex:</strong> {patient.age} years / {patient.sex}</p>
            <p><strong>Date:</strong> {format(new Date(), 'MMMM d, yyyy')}</p>
          </div>
          <div className="mb-8">
            <p className="text-2xl font-bold mb-4">Rx</p>
            {rxData.medications.map((med, i) => (
              <div key={i} className="mb-4 pl-4">
                <p className="font-medium">{i + 1}. {med.name} {med.dosage}</p>
                <p className="pl-4 text-slate-600">Sig: {med.frequency} for {med.duration}</p>
              </div>
            ))}
            {rxData.notes && <p className="mt-4 text-sm italic">Note: {rxData.notes}</p>}
          </div>
          <DoctorSignature />
        </div>

        {/* Medical Certificate Print */}
        <div ref={medCertRef} className="p-8 bg-white print-container">
          <PrintHeader />
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">MEDICAL CERTIFICATE</h2>
          </div>
          <div className="mb-6 space-y-4">
            <p>This is to certify that <strong>{patient.full_name}</strong>, {patient.age} years old, {patient.sex}, was seen and examined on <strong>{format(parseISO(visit.created_at), 'MMMM d, yyyy')}</strong>.</p>
            {medCertData.diagnosis && <p><strong>Diagnosis:</strong> {medCertData.diagnosis}</p>}
            {medCertData.start_date && medCertData.end_date && (
              <p><strong>Rest Period:</strong> {format(parseISO(medCertData.start_date), 'MMMM d, yyyy')} to {format(parseISO(medCertData.end_date), 'MMMM d, yyyy')}</p>
            )}
            {medCertData.remarks && <p><strong>Remarks:</strong> {medCertData.remarks}</p>}
          </div>
          <DoctorSignature />
        </div>

        {/* Fit to Work Print */}
        <div ref={fitToWorkRef} className="p-8 bg-white print-container">
          <PrintHeader />
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">FIT-TO-WORK CERTIFICATE</h2>
          </div>
          <div className="mb-6 space-y-4">
            <p>This is to certify that <strong>{patient.full_name}</strong>, {patient.age} years old, {patient.sex}, was examined on {fitToWorkData.examined_date && format(parseISO(fitToWorkData.examined_date), 'MMMM d, yyyy')}.</p>
            <p>The above-named patient is deemed <strong>FIT TO RESUME WORK</strong> effective {fitToWorkData.fit_date && format(parseISO(fitToWorkData.fit_date), 'MMMM d, yyyy')}.</p>
            {fitToWorkData.restrictions && <p><strong>Restrictions:</strong> {fitToWorkData.restrictions}</p>}
          </div>
          <DoctorSignature />
        </div>

        {/* Referral Print */}
        <div ref={referralRef} className="p-8 bg-white print-container">
          <PrintHeader />
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">REFERRAL LETTER</h2>
          </div>
          <div className="mb-6 space-y-4">
            <p><strong>To:</strong> {referralData.to_doctor} ({referralData.to_specialty})</p>
            <p><strong>Re:</strong> {patient.full_name}, {patient.age} years old, {patient.sex}</p>
            <p><strong>Date:</strong> {format(new Date(), 'MMMM d, yyyy')}</p>
            <div className="mt-6">
              <p>Dear Colleague,</p>
              <p className="mt-4">I am referring the above-named patient for your expert evaluation and management.</p>
              {referralData.reason && <p className="mt-4"><strong>Reason for Referral:</strong> {referralData.reason}</p>}
              {referralData.findings && <p className="mt-4"><strong>Clinical Findings:</strong> {referralData.findings}</p>}
              <p className="mt-4">Thank you for your kind attention to this patient.</p>
            </div>
          </div>
          <DoctorSignature />
        </div>

        {/* Lab Request Print */}
        <div ref={labRequestRef} className="p-8 bg-white print-container">
          <PrintHeader />
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">{labRequestData.request_type === 'lab' ? 'LABORATORY' : 'IMAGING'} REQUEST</h2>
            {labRequestData.urgency !== 'routine' && (
              <span className="inline-block mt-1 px-3 py-1 bg-red-100 text-red-800 font-bold rounded">
                {labRequestData.urgency.toUpperCase()}
              </span>
            )}
          </div>
          <div className="mb-6">
            <p><strong>Patient:</strong> {patient.full_name}</p>
            <p><strong>Age/Sex:</strong> {patient.age} years / {patient.sex}</p>
            <p><strong>Date:</strong> {format(new Date(), 'MMMM d, yyyy')}</p>
          </div>
          {labRequestData.clinical_info && (
            <div className="mb-4 p-3 border rounded">
              <p className="font-bold text-sm">Clinical Information:</p>
              <p>{labRequestData.clinical_info}</p>
            </div>
          )}
          <div className="mb-8">
            <p className="font-bold mb-2">Tests/Procedures Requested:</p>
            {labRequestData.tests.filter(t => t.name.trim()).map((test, i) => (
              <div key={i} className="mb-2 pl-4">
                <p>☐ {test.name}</p>
                {test.instructions && <p className="pl-4 text-sm text-slate-600">({test.instructions})</p>}
              </div>
            ))}
          </div>
          <DoctorSignature />
        </div>

        {/* SOAP Print */}
        <div ref={soapRef} className="p-8 bg-white print-container">
          <PrintHeader />
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">CONSULTATION NOTES</h2>
          </div>
          <div className="mb-6">
            <p><strong>Patient:</strong> {patient.full_name} ({patient.patient_id})</p>
            <p><strong>Age/Sex:</strong> {patient.age} years / {patient.sex}</p>
            <p><strong>Date:</strong> {format(parseISO(visit.created_at), 'MMMM d, yyyy h:mm a')}</p>
          </div>
          {visit.vitals && (
            <div className="mb-4">
              <p className="font-bold">VITAL SIGNS:</p>
              <p>
                {visit.vitals.bp_systolic && `BP: ${visit.vitals.bp_systolic}/${visit.vitals.bp_diastolic} mmHg `}
                {visit.vitals.heart_rate && `HR: ${visit.vitals.heart_rate} bpm `}
                {visit.vitals.temperature && `Temp: ${visit.vitals.temperature}°C `}
                {visit.vitals.spo2 && `SpO2: ${visit.vitals.spo2}% `}
              </p>
            </div>
          )}
          <div className="space-y-4">
            {visit.soap_subjective && <div><p className="font-bold">SUBJECTIVE:</p><p>{visit.soap_subjective}</p></div>}
            {visit.soap_objective && <div><p className="font-bold">OBJECTIVE:</p><p>{visit.soap_objective}</p></div>}
            {visit.soap_assessment && <div><p className="font-bold">ASSESSMENT:</p><p>{visit.soap_assessment}</p></div>}
            {visit.soap_plan && <div><p className="font-bold">PLAN:</p><p>{visit.soap_plan}</p></div>}
          </div>
          <DoctorSignature />
        </div>

        {/* Saved Prescription Reprint */}
        {selectedPrescription && (
          <div ref={savedRxRef} className="p-8 bg-white print-container">
            <PrintHeader />
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">PRESCRIPTION</h2>
            </div>
            <div className="mb-6">
              <p><strong>Patient:</strong> {patient.full_name}</p>
              <p><strong>Age/Sex:</strong> {patient.age} years / {patient.sex}</p>
              <p><strong>Date:</strong> {format(parseISO(selectedPrescription.created_at), 'MMMM d, yyyy')}</p>
            </div>
            <div className="mb-8">
              <p className="text-2xl font-bold mb-4">Rx</p>
              {selectedPrescription.medications?.map((med, i) => (
                <div key={i} className="mb-4 pl-4">
                  <p className="font-medium">{i + 1}. {med.name} {med.dosage}</p>
                  <p className="pl-4 text-slate-600">Sig: {med.frequency} for {med.duration}</p>
                </div>
              ))}
              {selectedPrescription.notes && <p className="mt-4 text-sm italic">Note: {selectedPrescription.notes}</p>}
            </div>
            <DoctorSignature />
          </div>
        )}

        {/* Saved Certificate Reprint */}
        {selectedCertificate && (
          <div ref={savedCertRef} className="p-8 bg-white print-container">
            <PrintHeader />
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">{getCertificateTypeName(selectedCertificate.certificate_type).toUpperCase()}</h2>
            </div>
            <div className="mb-6 space-y-4">
              {selectedCertificate.certificate_type === 'medical_certificate' && (
                <>
                  <p>This is to certify that <strong>{patient.full_name}</strong>, {patient.age} years old, {patient.sex}, was seen and examined on <strong>{format(parseISO(selectedCertificate.created_at), 'MMMM d, yyyy')}</strong>.</p>
                  {selectedCertificate.content?.diagnosis && <p><strong>Diagnosis:</strong> {selectedCertificate.content.diagnosis}</p>}
                  {selectedCertificate.content?.start_date && selectedCertificate.content?.end_date && (
                    <p><strong>Rest Period:</strong> {format(parseISO(selectedCertificate.content.start_date), 'MMMM d, yyyy')} to {format(parseISO(selectedCertificate.content.end_date), 'MMMM d, yyyy')}</p>
                  )}
                  {selectedCertificate.content?.remarks && <p><strong>Remarks:</strong> {selectedCertificate.content.remarks}</p>}
                </>
              )}
              {selectedCertificate.certificate_type === 'fit_to_work' && (
                <>
                  <p>This is to certify that <strong>{patient.full_name}</strong>, {patient.age} years old, {patient.sex}, was examined on {selectedCertificate.content?.examined_date && format(parseISO(selectedCertificate.content.examined_date), 'MMMM d, yyyy')}.</p>
                  <p>The above-named patient is deemed <strong>FIT TO RESUME WORK</strong> effective {selectedCertificate.content?.fit_date && format(parseISO(selectedCertificate.content.fit_date), 'MMMM d, yyyy')}.</p>
                  {selectedCertificate.content?.restrictions && <p><strong>Restrictions:</strong> {selectedCertificate.content.restrictions}</p>}
                </>
              )}
              {selectedCertificate.certificate_type === 'referral' && (
                <>
                  <p><strong>To:</strong> {selectedCertificate.content?.to_doctor} ({selectedCertificate.content?.to_specialty})</p>
                  <p><strong>Re:</strong> {patient.full_name}, {patient.age} years old, {patient.sex}</p>
                  <p><strong>Date:</strong> {format(parseISO(selectedCertificate.created_at), 'MMMM d, yyyy')}</p>
                  <div className="mt-6">
                    <p>Dear Colleague,</p>
                    <p className="mt-4">I am referring the above-named patient for your expert evaluation and management.</p>
                    {selectedCertificate.content?.reason && <p className="mt-4"><strong>Reason for Referral:</strong> {selectedCertificate.content.reason}</p>}
                    {selectedCertificate.content?.findings && <p className="mt-4"><strong>Clinical Findings:</strong> {selectedCertificate.content.findings}</p>}
                    <p className="mt-4">Thank you for your kind attention to this patient.</p>
                  </div>
                </>
              )}
            </div>
            <DoctorSignature />
          </div>
        )}

        {/* Saved Lab Request Reprint */}
        {selectedLabRequest && (
          <div ref={savedLabReqRef} className="p-8 bg-white print-container">
            <PrintHeader />
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">{selectedLabRequest.request_type === 'lab' ? 'LABORATORY' : 'IMAGING'} REQUEST</h2>
              {selectedLabRequest.urgency !== 'routine' && (
                <span className="inline-block mt-1 px-3 py-1 bg-red-100 text-red-800 font-bold rounded">
                  {selectedLabRequest.urgency.toUpperCase()}
                </span>
              )}
            </div>
            <div className="mb-6">
              <p><strong>Patient:</strong> {patient.full_name}</p>
              <p><strong>Age/Sex:</strong> {patient.age} years / {patient.sex}</p>
              <p><strong>Date:</strong> {format(parseISO(selectedLabRequest.created_at), 'MMMM d, yyyy')}</p>
            </div>
            {selectedLabRequest.clinical_info && (
              <div className="mb-4 p-3 border rounded">
                <p className="font-bold text-sm">Clinical Information:</p>
                <p>{selectedLabRequest.clinical_info}</p>
              </div>
            )}
            <div className="mb-8">
              <p className="font-bold mb-2">Tests/Procedures Requested:</p>
              {selectedLabRequest.tests?.map((test, i) => (
                <div key={i} className="mb-2 pl-4">
                  <p>☐ {test.name}</p>
                  {test.instructions && <p className="pl-4 text-sm text-slate-600">({test.instructions})</p>}
                </div>
              ))}
            </div>
            <DoctorSignature />
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitDetailPage;
