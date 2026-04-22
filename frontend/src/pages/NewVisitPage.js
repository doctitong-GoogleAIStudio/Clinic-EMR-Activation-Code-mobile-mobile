import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { patientAPI, visitAPI, appointmentAPI, aiAPI, attachmentAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  ArrowLeft, Save, Activity, Stethoscope, Sparkles, 
  Thermometer, Heart, Loader2, Microscope, Upload, Send,
  FileImage, File, Eye, Download, Trash2, Edit, X,
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Paperclip, Brain,
  FileText, Plus, ScanText
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { getErrorMessage } from '../lib/utils';
import AIConsultation from '../components/AIConsultation';
import SOAPDictation from '../components/SOAPDictation';

const NewVisitPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();
  const patientId = searchParams.get('patient');
  const appointmentId = searchParams.get('appointment');

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(null);
  const [showAIConsultation, setShowAIConsultation] = useState(false);
  
  // Labs & Imaging state
  const [labAttachments, setLabAttachments] = useState([]);
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

  // SOAP Attachments state
  const [soapAttachments, setSoapAttachments] = useState([]);
  const [soapFile, setSoapFile] = useState(null);
  const [soapUploading, setSoapUploading] = useState(false);
  const [editingSoapId, setEditingSoapId] = useState(null);
  const [editSoapData, setEditSoapData] = useState({ filename: '', notes: '' });
  const [extractingOCR, setExtractingOCR] = useState(null); // holds attachment id being processed
  const soapFileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    patient_id: patientId,
    vitals: {
      bp_systolic: '',
      bp_diastolic: '',
      heart_rate: '',
      respiratory_rate: '',
      temperature: '',
      spo2: '',
      weight: '',
      height: ''
    },
    soap_subjective: '',
    soap_objective: '',
    soap_assessment: '',
    soap_plan: '',
    diagnosis_codes: [],
    follow_up_date: '',
    patient_instructions: '',
    warning_signs: ''
  });

  useEffect(() => {
    if (patientId) {
      fetchPatient();
    }
    // Load vitals from appointment if appointmentId is provided
    if (appointmentId) {
      fetchAppointmentVitals();
    }
  }, [patientId, appointmentId]);

  const fetchAppointmentVitals = async () => {
    try {
      const response = await appointmentAPI.getOne(appointmentId);
      const appointment = response.data;
      
      if (appointment.vitals) {
        setFormData(prev => ({
          ...prev,
          vitals: {
            bp_systolic: appointment.vitals.bp_systolic?.toString() || '',
            bp_diastolic: appointment.vitals.bp_diastolic?.toString() || '',
            heart_rate: appointment.vitals.heart_rate?.toString() || '',
            respiratory_rate: appointment.vitals.respiratory_rate?.toString() || '',
            temperature: appointment.vitals.temperature?.toString() || '',
            spo2: appointment.vitals.spo2?.toString() || '',
            weight: appointment.vitals.weight?.toString() || '',
            height: appointment.vitals.height?.toString() || ''
          }
        }));
        toast.success('Vitals loaded from appointment');
      }
    } catch (error) {
      console.error('Failed to load appointment vitals:', error);
    }
  };

  const fetchPatient = async () => {
    try {
      const response = await patientAPI.getOne(patientId);
      setPatient(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load patient'));
      navigate('/patients');
    }
  };

  const tagColors = {
    lab: 'bg-purple-100 text-purple-800',
    'x-ray': 'bg-blue-100 text-blue-800',
    ultrasound: 'bg-cyan-100 text-cyan-800',
    ecg: 'bg-rose-100 text-rose-800',
  };

  // Labs handlers
  const handleLabUpload = async () => {
    if (!labFile || labUploading) return;
    const fileToUpload = labFile;
    const tagToUpload = labUploadData.tag;
    const notesToUpload = labUploadData.notes;
    setLabFile(null);
    setLabUploadData({ tag: 'lab', notes: '' });
    if (labFileInputRef.current) labFileInputRef.current.value = '';
    setLabUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('patient_id', patientId);
      formData.append('tag', tagToUpload);
      formData.append('notes', notesToUpload);
      const res = await attachmentAPI.upload(formData);
      toast.success('File uploaded');
      setLabAttachments(prev => [res.data, ...prev]);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to upload file'));
    } finally {
      setLabUploading(false);
    }
  };

  const handleViewAttachment = async (attachmentId) => {
    try {
      const metaRes = await attachmentAPI.getOne(attachmentId);
      const att = metaRes.data;
      
      const fileRes = await attachmentAPI.getFile(attachmentId, token);
      const blob = fileRes.data;
      const fileUrl = URL.createObjectURL(blob);
      
      if (att.content_type?.startsWith('image/')) {
        setZoom(1); setPan({ x: 0, y: 0 });
        setViewingAttachment({ ...att, fileUrl });
      } else if (att.content_type === 'application/pdf') {
        window.open(fileUrl, '_blank');
      } else {
        const a = document.createElement('a'); a.href = fileUrl; a.download = att.filename; a.click();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load file'));
    }
  };

  const handleDeleteAttachment = async (id) => {
    try {
      await attachmentAPI.delete(id);
      toast.success('File deleted');
      setLabAttachments(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete file'));
    }
  };

  const startEditLab = (att) => {
    setEditingLabId(att.id);
    setEditLabData({ filename: att.filename, tag: att.tag, notes: att.notes || '' });
  };

  const cancelEditLab = () => { setEditingLabId(null); };

  const saveEditLab = async () => {
    try {
      const res = await attachmentAPI.update(editingLabId, editLabData);
      toast.success('File updated');
      setLabAttachments(prev => prev.map(a => a.id === editingLabId ? { ...a, ...res.data } : a));
      setEditingLabId(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update file'));
    }
  };

  // Viewer pan/zoom
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

  const downloadFile = (att) => {
    if (att.fileUrl) {
      const a = document.createElement('a'); a.href = att.fileUrl; a.download = att.filename; a.click();
    }
  };

  // SOAP Attachments handlers
  const handleSoapFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || soapUploading) return;
    
    setSoapUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('patient_id', patientId);
      formDataUpload.append('tag', 'soap');
      formDataUpload.append('notes', '');
      
      const res = await attachmentAPI.upload(formDataUpload);
      toast.success('SOAP file uploaded');
      setSoapAttachments(prev => [res.data, ...prev]);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to upload file'));
    } finally {
      setSoapUploading(false);
      if (soapFileInputRef.current) soapFileInputRef.current.value = '';
    }
  };

  const handleViewSoapAttachment = async (attachmentId) => {
    try {
      const metaRes = await attachmentAPI.getOne(attachmentId);
      const att = metaRes.data;
      
      const fileRes = await attachmentAPI.getFile(attachmentId, token);
      const blob = fileRes.data;
      const fileUrl = URL.createObjectURL(blob);
      
      if (att.content_type?.startsWith('image/')) {
        setZoom(1); setPan({ x: 0, y: 0 });
        setViewingAttachment({ ...att, fileUrl, type: 'image' });
      } else if (att.content_type === 'application/pdf') {
        window.open(fileUrl, '_blank');
      } else {
        setViewingAttachment({ ...att, fileUrl, type: 'other' });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load file'));
    }
  };

  const startEditSoap = (att) => {
    setEditingSoapId(att.id);
    setEditSoapData({ filename: att.filename, notes: att.notes || '' });
  };

  const cancelEditSoap = () => {
    setEditingSoapId(null);
    setEditSoapData({ filename: '', notes: '' });
  };

  const saveEditSoap = async () => {
    try {
      const res = await attachmentAPI.update(editingSoapId, editSoapData);
      toast.success('File updated');
      setSoapAttachments(prev => prev.map(a => a.id === editingSoapId ? { ...a, ...res.data } : a));
      setEditingSoapId(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update file'));
    }
  };

  const handleDeleteSoapAttachment = async (attId) => {
    if (!confirm('Delete this SOAP file?')) return;
    try {
      await attachmentAPI.delete(attId);
      toast.success('File deleted');
      setSoapAttachments(prev => prev.filter(a => a.id !== attId));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete file'));
    }
  };

  // OCR - Extract text from SOAP image
  const handleExtractText = async (attachmentId, contentType) => {
    if (!contentType?.startsWith('image/')) {
      toast.error('OCR only works with image files (JPG, PNG, etc.)');
      return;
    }
    
    setExtractingOCR(attachmentId);
    try {
      const response = await aiAPI.extractText(attachmentId);
      const result = response.data.result;
      
      if (result.confidence === 'low' && !result.raw_text) {
        toast.error(result.notes || 'Could not extract text from image');
        return;
      }
      
      // Pre-fill SOAP fields with extracted text
      const soap = result.soap;
      if (soap) {
        setFormData(prev => ({
          ...prev,
          soap_subjective: soap.subjective || prev.soap_subjective,
          soap_objective: soap.objective || prev.soap_objective,
          soap_assessment: soap.assessment || prev.soap_assessment,
          soap_plan: soap.plan || prev.soap_plan
        }));
        
        const filledFields = [
          soap.subjective && 'Subjective',
          soap.objective && 'Objective',
          soap.assessment && 'Assessment',
          soap.plan && 'Plan'
        ].filter(Boolean);
        
        if (filledFields.length > 0) {
          toast.success(`Extracted: ${filledFields.join(', ')} (${result.confidence} confidence)`);
        } else if (result.raw_text) {
          // If no SOAP sections found but raw text exists, put in subjective
          setFormData(prev => ({
            ...prev,
            soap_subjective: result.raw_text
          }));
          toast.success('Text extracted and added to Subjective');
        } else {
          toast.info('No SOAP content found in image');
        }
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to extract text'));
    } finally {
      setExtractingOCR(null);
    }
  };

  const calculateBMI = () => {
    const { weight, height } = formData.vitals;
    if (weight && height) {
      const heightM = parseFloat(height) / 100;
      return (parseFloat(weight) / (heightM * heightM)).toFixed(1);
    }
    return null;
  };

  const handleAIAssist = async (type) => {
    setAiLoading(type);
    try {
      let text = '';
      if (type === 'soap_convert') {
        text = [formData.soap_subjective, formData.soap_objective, formData.soap_assessment, formData.soap_plan].filter(Boolean).join('\n') || 'Patient complains of...';
      } else if (type === 'diagnosis_suggest') {
        text = `${formData.soap_subjective}\n${formData.soap_objective}`;
      } else if (type === 'patient_instructions') {
        text = `${formData.soap_assessment}\n${formData.soap_plan}`;
      }

      const response = await aiAPI.assist({ text, request_type: type });
      
      if (type === 'soap_convert') {
        const result = response.data.result;
        // Parse S/O/A/P sections - handles multiple formats:
        // "S:", "S -", "## S (Subjective)", "**S:**", "Subjective:", etc.
        const sectionRegexes = [
          { key: 'subjective', regex: /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\*{0,2})?\s*S(?:ubjective)?[\s(:.\-]+/i },
          { key: 'objective', regex: /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\*{0,2})?\s*O(?:bjective)?[\s(:.\-]+/i },
          { key: 'assessment', regex: /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\*{0,2})?\s*A(?:ssessment)?[\s(:.\-]+/i },
          { key: 'plan', regex: /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\*{0,2})?\s*P(?:lan)?[\s(:.\-]+/i },
        ];
        const positions = sectionRegexes.map(p => {
          const match = result.match(p.regex);
          return { key: p.key, index: match ? result.indexOf(match[0]) : -1, matchLen: match ? match[0].length : 0 };
        }).filter(p => p.index >= 0).sort((a, b) => a.index - b.index);

        const sections = { subjective: '', objective: '', assessment: '', plan: '' };
        if (positions.length >= 2) {
          for (let i = 0; i < positions.length; i++) {
            const start = positions[i].index + positions[i].matchLen;
            const end = i + 1 < positions.length ? positions[i + 1].index : result.length;
            // Clean markdown artifacts like **, ##, trailing ), header labels
            sections[positions[i].key] = result.slice(start, end)
              .replace(/^[\s\)]*(?:Subjective|Objective|Assessment|Plan)\)?\*{0,2}\s*/i, '')
              .replace(/\*\*/g, '')
              .trim();
          }
          setFormData(prev => ({
            ...prev,
            soap_subjective: sections.subjective || prev.soap_subjective,
            soap_objective: sections.objective || prev.soap_objective,
            soap_assessment: sections.assessment || prev.soap_assessment,
            soap_plan: sections.plan || prev.soap_plan,
          }));
        } else {
          setFormData(prev => ({ ...prev, soap_subjective: result }));
        }
        toast.success('AI generated SOAP notes');
      } else if (type === 'diagnosis_suggest') {
        setFormData(prev => ({ ...prev, soap_assessment: response.data.result }));
        toast.success('AI suggested diagnoses');
      } else if (type === 'patient_instructions') {
        setFormData(prev => ({ ...prev, patient_instructions: response.data.result }));
        toast.success('AI generated patient instructions');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'AI assist failed. Please try again.'));
    } finally {
      setAiLoading(null);
    }
  };

  // Handler for AI Consultation to apply SOAP notes
  const handleApplySOAP = (soap) => {
    setFormData(prev => ({
      ...prev,
      soap_subjective: soap.subjective || prev.soap_subjective,
      soap_objective: soap.objective || prev.soap_objective,
      soap_assessment: soap.assessment || prev.soap_assessment,
      soap_plan: soap.plan || prev.soap_plan
    }));
  };

  // Handler for AI Consultation to apply medications
  const handleApplyMedications = (medications) => {
    // Format medications for the plan section
    const medsText = medications.map(m => 
      `• ${m.name} ${m.dose} ${m.frequency} for ${m.duration}${m.notes ? ` (${m.notes})` : ''}`
    ).join('\n');
    
    setFormData(prev => ({
      ...prev,
      soap_plan: prev.soap_plan 
        ? `${prev.soap_plan}\n\nMedications:\n${medsText}`
        : `Medications:\n${medsText}`
    }));
  };

  // Get current vitals for AI red flag checking
  const getCurrentVitals = () => ({
    bp: formData.vitals.bp_systolic && formData.vitals.bp_diastolic 
      ? `${formData.vitals.bp_systolic}/${formData.vitals.bp_diastolic}`
      : null,
    hr: formData.vitals.heart_rate || null,
    temp: formData.vitals.temperature || null,
    spo2: formData.vitals.spo2 || null,
    rr: formData.vitals.respiratory_rate || null
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const vitals = {};
      Object.entries(formData.vitals).forEach(([key, value]) => {
        if (value !== '' && value !== null) {
          vitals[key] = ['temperature', 'weight', 'height'].includes(key) 
            ? parseFloat(value) 
            : parseInt(value);
        }
      });

      const visitData = {
        ...formData,
        vitals: Object.keys(vitals).length > 0 ? vitals : null
      };

      const response = await visitAPI.create(visitData);
      const visitId = response.data.id;
      
      // Link SOAP attachments to the newly created visit
      if (soapAttachments.length > 0) {
        await Promise.all(
          soapAttachments.map(att => 
            attachmentAPI.update(att.id, { visit_id: visitId })
          )
        );
      }
      
      if (appointmentId) {
        await appointmentAPI.update(appointmentId, { status: 'done' });
      }

      toast.success('Visit recorded successfully');
      navigate(`/visits/${visitId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save visit'));
    } finally {
      setLoading(false);
    }
  };

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
      </div>
    );
  }

  const bmi = calculateBMI();

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="new-visit-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(`/patients/${patientId}`)} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold text-slate-900">New Visit</h1>
          <p className="text-slate-500 font-body">
            {patient.full_name} • {patient.patient_id} • {patient.age}y {patient.sex}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vitals */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#0F766E]" />
              Vital Signs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">BP (mmHg)</Label>
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="120"
                    value={formData.vitals.bp_systolic}
                    onChange={(e) => setFormData({
                      ...formData,
                      vitals: { ...formData.vitals, bp_systolic: e.target.value }
                    })}
                    className="text-center"
                    data-testid="bp-systolic-input"
                  />
                  <span className="text-slate-400">/</span>
                  <Input
                    placeholder="80"
                    value={formData.vitals.bp_diastolic}
                    onChange={(e) => setFormData({
                      ...formData,
                      vitals: { ...formData.vitals, bp_diastolic: e.target.value }
                    })}
                    className="text-center"
                    data-testid="bp-diastolic-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1">
                  <Heart className="w-3 h-3" /> HR (bpm)
                </Label>
                <Input
                  placeholder="72"
                  value={formData.vitals.heart_rate}
                  onChange={(e) => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, heart_rate: e.target.value }
                  })}
                  data-testid="heart-rate-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">RR (cpm)</Label>
                <Input
                  placeholder="16"
                  value={formData.vitals.respiratory_rate}
                  onChange={(e) => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, respiratory_rate: e.target.value }
                  })}
                  data-testid="respiratory-rate-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1">
                  <Thermometer className="w-3 h-3" /> Temp (°C)
                </Label>
                <Input
                  placeholder="36.5"
                  value={formData.vitals.temperature}
                  onChange={(e) => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, temperature: e.target.value }
                  })}
                  data-testid="temperature-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">SpO2 (%)</Label>
                <Input
                  placeholder="98"
                  value={formData.vitals.spo2}
                  onChange={(e) => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, spo2: e.target.value }
                  })}
                  data-testid="spo2-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Weight (kg)</Label>
                <Input
                  placeholder="70"
                  value={formData.vitals.weight}
                  onChange={(e) => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, weight: e.target.value }
                  })}
                  data-testid="weight-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Height (cm)</Label>
                <Input
                  placeholder="170"
                  value={formData.vitals.height}
                  onChange={(e) => setFormData({
                    ...formData,
                    vitals: { ...formData.vitals, height: e.target.value }
                  })}
                  data-testid="height-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">BMI</Label>
                <Input
                  value={bmi || '-'}
                  disabled
                  className="bg-slate-50"
                  data-testid="bmi-display"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI-Assisted Consultation */}
        <AIConsultation 
          patient={patient}
          vitals={getCurrentVitals()}
          onApplySOAP={handleApplySOAP}
          onApplyMedications={handleApplyMedications}
        />

        {/* SOAP Notes */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-[#0F766E]" />
                SOAP Notes
              </CardTitle>
              <div className="flex items-center gap-2">
                <SOAPDictation patient={patient} onApplySOAP={handleApplySOAP} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAIAssist('soap_convert')}
                  disabled={aiLoading === 'soap_convert'}
                  className="text-[#0F766E] border-[#0F766E]/30 hover:bg-[#0F766E]/10"
                  data-testid="ai-soap-btn"
                >
                  {aiLoading === 'soap_convert' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  AI Convert to SOAP
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium">S - Subjective</Label>
              <p className="text-xs text-slate-500">Chief complaint, HPI, ROS</p>
              <Textarea
                value={formData.soap_subjective}
                onChange={(e) => setFormData({ ...formData, soap_subjective: e.target.value })}
                placeholder="Patient complains of..."
                rows={3}
                data-testid="soap-subjective-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">O - Objective</Label>
              <p className="text-xs text-slate-500">Physical examination findings</p>
              <Textarea
                value={formData.soap_objective}
                onChange={(e) => setFormData({ ...formData, soap_objective: e.target.value })}
                placeholder="General appearance, HEENT, Chest, Abdomen..."
                rows={3}
                data-testid="soap-objective-input"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">A - Assessment</Label>
                  <p className="text-xs text-slate-500">Diagnosis / Differential diagnoses</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAIAssist('diagnosis_suggest')}
                  disabled={aiLoading === 'diagnosis_suggest'}
                  className="text-[#0F766E] hover:bg-[#0F766E]/10"
                  data-testid="ai-diagnosis-btn"
                >
                  {aiLoading === 'diagnosis_suggest' ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-1" />
                  )}
                  Suggest
                </Button>
              </div>
              <Textarea
                value={formData.soap_assessment}
                onChange={(e) => setFormData({ ...formData, soap_assessment: e.target.value })}
                placeholder="1. Primary diagnosis&#10;2. Differential..."
                rows={3}
                data-testid="soap-assessment-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">P - Plan</Label>
              <p className="text-xs text-slate-500">Treatment, medications, labs, follow-up</p>
              <Textarea
                value={formData.soap_plan}
                onChange={(e) => setFormData({ ...formData, soap_plan: e.target.value })}
                placeholder="1. Medications&#10;2. Laboratory&#10;3. Follow-up..."
                rows={3}
                data-testid="soap-plan-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Follow-up Date</Label>
              <Input
                type="date"
                value={formData.follow_up_date}
                onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                className="max-w-xs"
                data-testid="follow-up-date-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Upload SOAP Notes */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#0F766E]" />
              Upload SOAP Notes
              {soapAttachments.length > 0 && (
                <Badge variant="outline" className="ml-1 font-mono text-xs">{soapAttachments.length}</Badge>
              )}
            </CardTitle>
            <div>
              <input
                type="file"
                ref={soapFileInputRef}
                onChange={handleSoapFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
                data-testid="soap-file-input"
              />
              <Button 
                type="button"
                variant="outline" 
                size="sm" 
                onClick={() => soapFileInputRef.current?.click()}
                disabled={soapUploading}
                className="text-[#0F766E] border-[#0F766E]/30 hover:bg-[#0F766E]/10"
                data-testid="upload-soap-btn"
              >
                <Plus className="w-4 h-4 mr-1" />
                {soapUploading ? 'Uploading...' : 'Upload File'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {soapAttachments.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No SOAP files uploaded yet</p>
                <p className="text-xs mt-1">Upload scanned notes, handwritten SOAP, or related documents</p>
              </div>
            ) : (
              <div className="space-y-3">
                {soapAttachments.map((att) => (
                  <div 
                    key={att.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-[#0F766E]/30 hover:bg-slate-50 transition-colors"
                    data-testid={`soap-attachment-${att.id}`}
                  >
                    {editingSoapId === att.id ? (
                      // Edit mode
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editSoapData.filename}
                          onChange={(e) => setEditSoapData({ ...editSoapData, filename: e.target.value })}
                          placeholder="Filename"
                          className="h-8"
                          data-testid="soap-edit-filename"
                        />
                        <Input
                          value={editSoapData.notes}
                          onChange={(e) => setEditSoapData({ ...editSoapData, notes: e.target.value })}
                          placeholder="Notes (optional)"
                          className="h-8"
                          data-testid="soap-edit-notes"
                        />
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={saveEditSoap} className="bg-[#0F766E] hover:bg-[#115E59]">
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={cancelEditSoap}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div 
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => handleViewSoapAttachment(att.id)}
                        >
                          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                            {att.content_type?.startsWith('image/') ? (
                              <FileImage className="w-5 h-5 text-teal-600" />
                            ) : (
                              <File className="w-5 h-5 text-teal-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 truncate">{att.filename}</p>
                            {att.notes && <p className="text-xs text-slate-500 truncate">{att.notes}</p>}
                            <p className="text-xs text-slate-400">{att.uploaded_at ? format(parseISO(att.uploaded_at), 'MMM d, h:mm a') : 'Just now'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* OCR Extract Text - only for images */}
                          {att.content_type?.startsWith('image/') && (
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleExtractText(att.id, att.content_type)}
                              disabled={extractingOCR === att.id}
                              className="h-8 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              title="Extract text from image (OCR)"
                              data-testid={`soap-ocr-btn-${att.id}`}
                            >
                              {extractingOCR === att.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ScanText className="w-4 h-4" />
                              )}
                              <span className="ml-1 text-xs">Extract</span>
                            </Button>
                          )}
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleViewSoapAttachment(att.id)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-[#0F766E]"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            onClick={() => startEditSoap(att)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-[#0F766E]"
                            data-testid={`soap-edit-btn-${att.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); handleDeleteSoapAttachment(att.id); }}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
                            data-testid={`soap-delete-btn-${att.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Labs & Imaging */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Microscope className="w-5 h-5 text-[#0F766E]" />
              Labs & Imaging
              {labAttachments.length > 0 && (
                <Badge variant="outline" className="ml-1 font-mono text-xs">{labAttachments.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col max-h-[400px]">
              {/* File list (messenger bubbles) */}
              <div className="flex-1 overflow-y-auto space-y-3 pb-3" data-testid="visit-labs-file-list">
                {labAttachments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Microscope className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm text-slate-500">No lab results or imaging files</p>
                    <p className="text-xs mt-0.5">Upload patient's labs below</p>
                  </div>
                ) : (
                  labAttachments.map((att) => (
                    <div key={att.id} className="flex justify-end" data-testid={`visit-lab-item-${att.id}`}>
                      <div className="max-w-[80%] sm:max-w-[65%]">
                        {editingLabId === att.id ? (
                          <div className="rounded-2xl rounded-br-md bg-white border-2 border-[#0F766E] p-3 space-y-2" data-testid={`visit-lab-edit-form-${att.id}`}>
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-500">Filename</Label>
                              <Input value={editLabData.filename} onChange={(e) => setEditLabData({ ...editLabData, filename: e.target.value })} className="text-sm h-8" data-testid={`visit-lab-edit-filename-${att.id}`} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-500">Tag</Label>
                              <Select value={editLabData.tag} onValueChange={(v) => setEditLabData({ ...editLabData, tag: v })}>
                                <SelectTrigger className="h-8 text-sm" data-testid={`visit-lab-edit-tag-${att.id}`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="lab">Lab Result</SelectItem>
                                  <SelectItem value="x-ray">X-Ray</SelectItem>
                                  <SelectItem value="ultrasound">Ultrasound</SelectItem>
                                  <SelectItem value="ecg">ECG</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-500">Notes</Label>
                              <Input value={editLabData.notes} onChange={(e) => setEditLabData({ ...editLabData, notes: e.target.value })} placeholder="Optional notes..." className="text-sm h-8" data-testid={`visit-lab-edit-notes-${att.id}`} />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button type="button" variant="ghost" size="sm" onClick={cancelEditLab} className="h-7 text-xs"><X className="w-3 h-3 mr-1" />Cancel</Button>
                              <Button type="button" size="sm" onClick={saveEditLab} className="h-7 text-xs bg-[#0F766E] hover:bg-[#115E59]" data-testid={`visit-lab-edit-save-${att.id}`}><Save className="w-3 h-3 mr-1" />Save</Button>
                            </div>
                          </div>
                        ) : (
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
                        )}
                        {editingLabId !== att.id && (
                          <div className="flex items-center justify-end gap-3 mt-1 px-1">
                            <span className="text-[11px] text-slate-400">{format(parseISO(att.uploaded_at), 'MMM d, yyyy h:mm a')}</span>
                            <button type="button" onClick={(e) => { e.stopPropagation(); startEditLab(att); }} className="p-1 rounded text-slate-400 hover:text-[#0F766E] hover:bg-slate-100 transition-colors" data-testid={`visit-lab-edit-${att.id}`} title="Edit"><Edit className="w-4 h-4" /></button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(att.id); }} className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" data-testid={`visit-lab-delete-${att.id}`} title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Upload bar */}
              <div className="border-t border-slate-200 pt-3 mt-auto">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input type="file" ref={labFileInputRef} onChange={(e) => setLabFile(e.target.files[0])} accept="image/*,.pdf,.doc,.docx" className="text-sm" data-testid="visit-lab-file-input" />
                      </div>
                      <Select value={labUploadData.tag} onValueChange={(v) => setLabUploadData({ ...labUploadData, tag: v })}>
                        <SelectTrigger className="w-[130px]" data-testid="visit-lab-tag-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lab">Lab Result</SelectItem>
                          <SelectItem value="x-ray">X-Ray</SelectItem>
                          <SelectItem value="ultrasound">Ultrasound</SelectItem>
                          <SelectItem value="ecg">ECG</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input value={labUploadData.notes} onChange={(e) => setLabUploadData({ ...labUploadData, notes: e.target.value })} placeholder="Add a note (optional)..." className="text-sm" data-testid="visit-lab-notes-input" />
                  </div>
                  <Button type="button" onClick={handleLabUpload} disabled={!labFile || labUploading} className="bg-[#0F766E] hover:bg-[#115E59] h-11 px-4" data-testid="visit-lab-upload-btn">
                    {labUploading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
                  </Button>
                </div>
                {labFile && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="truncate flex-1">{labFile.name}</span>
                    <button type="button" onClick={() => { setLabFile(null); if (labFileInputRef.current) labFileInputRef.current.value = ''; }} className="text-slate-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Instructions */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading">Patient Instructions</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAIAssist('patient_instructions')}
                disabled={aiLoading === 'patient_instructions'}
                className="text-[#0F766E] hover:bg-[#0F766E]/10"
                data-testid="ai-instructions-btn"
              >
                {aiLoading === 'patient_instructions' ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1" />
                )}
                Generate
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Instructions (Diet, Medications, Activity)</Label>
              <Textarea
                value={formData.patient_instructions}
                onChange={(e) => setFormData({ ...formData, patient_instructions: e.target.value })}
                placeholder="Take medications as prescribed..."
                rows={3}
                data-testid="patient-instructions-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Warning Signs (Return Precautions)</Label>
              <Textarea
                value={formData.warning_signs}
                onChange={(e) => setFormData({ ...formData, warning_signs: e.target.value })}
                placeholder="Return immediately if you experience..."
                rows={2}
                data-testid="warning-signs-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(`/patients/${patientId}`)}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="bg-[#0F766E] hover:bg-[#115E59]"
            data-testid="save-visit-btn"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Visit
              </span>
            )}
          </Button>
        </div>
      </form>

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
                data-testid="visit-lab-image-viewer-area"
              >
                <img
                  src={viewingAttachment.fileUrl}
                  alt={viewingAttachment.filename}
                  draggable={false}
                  className="absolute top-1/2 left-1/2 max-w-none"
                  style={{
                    transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                  }}
                  data-testid="visit-lab-image-viewer"
                />
              </div>
              <div className="px-5 py-3 bg-white border-t border-slate-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={`${tagColors[viewingAttachment.tag]} text-xs flex-shrink-0`}>{viewingAttachment.tag}</Badge>
                    {viewingAttachment.notes && <span className="text-sm text-slate-500 truncate">{viewingAttachment.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} disabled={zoom <= 0.25} data-testid="visit-zoom-out-btn"><ZoomOut className="w-4 h-4" /></Button>
                    <input type="range" min="25" max="500" step="5" value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} className="w-24 h-1.5 accent-[#0F766E] cursor-pointer" data-testid="visit-zoom-slider" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(5, z + 0.25))} disabled={zoom >= 5} data-testid="visit-zoom-in-btn"><ZoomIn className="w-4 h-4" /></Button>
                    <span className="text-xs text-slate-500 w-12 text-center font-mono">{Math.round(zoom * 100)}%</span>
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    <Button type="button" variant="ghost" size="sm" onClick={resetViewer} title="Reset"><RotateCcw className="w-4 h-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Fit"><Maximize2 className="w-4 h-4" /></Button>
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    <Button type="button" variant="outline" size="sm" onClick={() => downloadFile(viewingAttachment)} data-testid="visit-lab-download-btn"><Download className="w-4 h-4 mr-1" />Download</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewVisitPage;
