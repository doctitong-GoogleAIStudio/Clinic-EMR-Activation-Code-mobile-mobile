import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { patientAPI, visitAPI, dictationAPI, settingsAPI } from '../lib/api';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Mic, MicOff, Pause, Play, Square, Trash2, RotateCcw, Wand2,
  ChevronLeft, ChevronDown, ChevronUp, User, AlertTriangle,
  FileText, Pill, ClipboardList, MessageSquare, CalendarCheck,
  Loader2, Copy, Check, ArrowDownToLine, Stethoscope, Activity,
  Save, Send, FlaskConical
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../lib/utils';

// Format seconds to mm:ss
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Status badge config
const STATUS_CONFIG = {
  idle: { label: 'Ready', color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  recording: { label: 'Recording', color: 'bg-red-100 text-red-700', dot: 'bg-red-500 animate-pulse' },
  paused: { label: 'Paused', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  stopped: { label: 'Stopped', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  transcribing: { label: 'Transcribing', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500 animate-pulse' },
  ai_processing: { label: 'AI Processing', color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500 animate-pulse' },
  review: { label: 'Review Required', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  error: { label: 'Error', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

const DICTATION_MODES = [
  { value: 'full_consultation', label: 'Full Consultation', icon: FileText },
  { value: 'subjective', label: 'Subjective', icon: MessageSquare },
  { value: 'objective', label: 'Objective', icon: Activity },
  { value: 'assessment', label: 'Assessment', icon: Stethoscope },
  { value: 'plan', label: 'Plan', icon: ClipboardList },
  { value: 'prescription', label: 'Prescription', icon: Pill },
  { value: 'orders', label: 'Orders', icon: ClipboardList },
  { value: 'instructions', label: 'Instructions', icon: MessageSquare },
];

const DEMO_SAMPLES = [
  {
    id: 'pneumonia',
    label: 'Respiratory Infection',
    mode: 'full_consultation',
    badge: 'Full SOAP',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    text: 'Patient came in for cough for five days with fever. No chest pain, no dyspnea. Temperature thirty eight degrees Celsius. Crackles heard at the right lower lung field. Impression community acquired pneumonia. Start amoxicillin clavulanate six hundred twenty five milligrams one tablet three times daily for seven days. Advise increase oral fluids. Request chest x ray if not improving. Follow up in three days.',
  },
  {
    id: 'hypertension',
    label: 'Hypertension Follow-up',
    mode: 'full_consultation',
    badge: 'Full SOAP',
    color: 'text-red-700 bg-red-50 border-red-200',
    text: 'Follow up for hypertension. No headache, no dizziness, no chest pain. Blood pressure one hundred fifty over ninety. Patient admits poor compliance with medications. Continue amlodipine five milligrams once daily. Advise low salt diet and home blood pressure monitoring. Return in two weeks.',
  },
  {
    id: 'gastroenteritis',
    label: 'Acute Gastroenteritis',
    mode: 'full_consultation',
    badge: 'Full SOAP',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    text: 'Patient with vomiting and loose stools since yesterday. No blood in stool. Mild dehydration noted. Abdomen soft, no rebound tenderness. Impression acute gastroenteritis. Start oral rehydration solution and zinc. May take ondansetron as needed for vomiting. Return immediately if unable to tolerate fluids or if symptoms worsen.',
  },
  {
    id: 'prescription',
    label: 'Prescription Only',
    mode: 'prescription',
    badge: 'Rx Mode',
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    text: 'Azithromycin five hundred milligrams tablet, take one tablet once daily for three days.',
  },
  {
    id: 'orders',
    label: 'Lab Orders',
    mode: 'orders',
    badge: 'Orders Mode',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    text: 'Request CBC, urinalysis, fasting blood sugar, lipid profile, chest x ray PA view.',
  },
  {
    id: 'dermatology',
    label: 'Dermatology Follow-up',
    mode: 'full_consultation',
    badge: 'Full SOAP',
    color: 'text-pink-700 bg-pink-50 border-pink-200',
    text: 'Follow up for pruritic erythematous rash on both forearms, improving with treatment. No fever. Continue cetirizine and topical steroid for five more days.',
  },
  {
    id: 'uncertain',
    label: 'Uncertain Medication',
    mode: 'full_consultation',
    badge: 'Review Flags',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
    text: 'Start something like co amoxiclav six twenty five one tablet three times a day for one week.',
  },
];

export default function AIConsultationPage() {
  const { patientId } = useParams();
  const [searchParams] = useSearchParams();
  const visitId = searchParams.get('visit');
  const navigate = useNavigate();
  const { user } = useAuth();

  // Data state
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  // SOAP editor state
  const [soap, setSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [prescriptions, setPrescriptions] = useState('');
  const [orders, setOrders] = useState('');
  const [instructions, setInstructions] = useState('');
  const [followUp, setFollowUp] = useState('');

  // Dictation state
  const [dictMode, setDictMode] = useState('full_consultation');
  const [pipelineStatus, setPipelineStatus] = useState('idle');
  const [sessionId, setSessionId] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [structured, setStructured] = useState(null);
  const [reviewFlags, setReviewFlags] = useState([]);
  const [uncertainties, setUncertainties] = useState([]);

  // UI state
  const [expandTranscript, setExpandTranscript] = useState(true);
  const [expandOutput, setExpandOutput] = useState(true);
  const [insertDialog, setInsertDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [demoMode, setDemoMode] = useState(false);

  const recorder = useAudioRecorder();
  const transcriptEndRef = useRef(null);

  // Load patient data
  useEffect(() => {
    async function load() {
      try {
        const [pRes, vRes] = await Promise.all([
          patientAPI.getOne(patientId),
          visitAPI.getAll({ patient_id: patientId, limit: 5 })
        ]);
        setPatient(pRes.data);
        setVisits(Array.isArray(vRes.data) ? vRes.data : vRes.data?.data || []);

        // If editing an existing visit, pre-fill SOAP
        if (visitId) {
          const vDetail = await visitAPI.getOne(visitId);
          const v = vDetail.data;
          setSoap({
            subjective: v.soap_subjective || '',
            objective: v.soap_objective || '',
            assessment: v.soap_assessment || '',
            plan: v.soap_plan || '',
          });
          setInstructions(v.patient_instructions || '');
          setFollowUp(v.follow_up_date || '');
        }
      } catch (e) {
        toast.error(getErrorMessage(e, 'Failed to load patient'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId, visitId]);

  // Calculate age
  const calcAge = (bd) => {
    if (!bd) return '';
    const diff = Date.now() - new Date(bd).getTime();
    return Math.floor(diff / 31557600000);
  };

  // ─── RECORDING CONTROLS ───
  const handleStart = async () => {
    try {
      // Create dictation session
      const res = await dictationAPI.createSession({
        patient_id: patientId,
        visit_id: visitId,
        dictation_mode: dictMode,
      });
      setSessionId(res.data.id);
      setTranscript('');
      setStructured(null);
      setReviewFlags([]);
      setUncertainties([]);
      setPipelineStatus('recording');
      await recorder.startRecording();
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to start recording'));
      setPipelineStatus('error');
    }
  };

  const handlePause = () => {
    recorder.pauseRecording();
    setPipelineStatus('paused');
    if (sessionId) dictationAPI.updateSession(sessionId, { status: 'paused' }).catch(() => {});
  };

  const handleResume = () => {
    recorder.resumeRecording();
    setPipelineStatus('recording');
    if (sessionId) dictationAPI.updateSession(sessionId, { status: 'recording' }).catch(() => {});
  };

  const handleStop = async () => {
    await recorder.stopRecording();
    // Wait for final speech results
    await new Promise(resolve => setTimeout(resolve, 1000));
    recorder.stopSpeechRecognition?.();

    const browserTranscript = recorder.getTranscript();
    if (browserTranscript) {
      setTranscript(browserTranscript);
      // Auto-process if we got text from speech
      processTranscript(browserTranscript);
    } else {
      // Text area is already visible — user can type and click "Process with AI"
      setPipelineStatus('idle');
      toast.info('Type or paste your dictation in the text area, then click "Process with AI"');
    }
  };

  // Process transcript through AI (shared by live recording and manual input)
  const processTranscript = async (text) => {
    setPipelineStatus('ai_processing');

    if (sessionId) {
      dictationAPI.updateSession(sessionId, { raw_transcript: text, status: 'transcribed' }).catch(() => {});
      dictationAPI.logAudit({ session_id: sessionId, action_type: 'transcript_generated', notes: `${text.length} chars` }).catch(() => {});
    }

    try {
      const sRes = await dictationAPI.structure({
        transcript: text,
        mode: dictMode,
        session_id: sessionId,
        patient_context: patient ? {
          name: patient.full_name,
          age: calcAge(patient.birthdate),
          sex: patient.sex,
          allergies: patient.allergies || [],
          chronic_conditions: patient.chronic_conditions || [],
        } : {},
      });

      if (sRes.data.structured) {
        setStructured(sRes.data.structured);
        setReviewFlags(sRes.data.structured.review_flags || []);
        setUncertainties(sRes.data.structured.uncertainties || []);
        setPipelineStatus('review');
        toast.success('AI processing complete — review the output');
      } else {
        toast.warning('AI returned unstructured response');
        setPipelineStatus('review');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'AI processing failed'));
      setPipelineStatus('error');
    }
  };

  const handleClear = () => {
    recorder.clearRecording();
    setTranscript('');
    setStructured(null);
    setReviewFlags([]);
    setUncertainties([]);
    setPipelineStatus('idle');
    setSessionId(null);
  };

  const handleReprocess = async () => {
    if (!transcript.trim()) return;
    setPipelineStatus('ai_processing');
    try {
      const sRes = await dictationAPI.structure({
        transcript,
        mode: dictMode,
        session_id: sessionId,
        patient_context: patient ? {
          name: patient.full_name,
          age: calcAge(patient.birthdate),
          sex: patient.sex,
          allergies: patient.allergies || [],
          chronic_conditions: patient.chronic_conditions || [],
        } : {},
      });
      if (sRes.data.structured) {
        setStructured(sRes.data.structured);
        setReviewFlags(sRes.data.structured.review_flags || []);
        setUncertainties(sRes.data.structured.uncertainties || []);
        setPipelineStatus('review');
        toast.success('Reprocessed successfully');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Reprocess failed'));
      setPipelineStatus('error');
    }
  };

  // ─── DEMO MODE ───
  const handleDemoSelect = async (sample) => {
    // Set the mode to match the sample
    setDictMode(sample.mode);
    setTranscript(sample.text);
    setStructured(null);
    setReviewFlags([]);
    setUncertainties([]);
    setPipelineStatus('ai_processing');
    toast.info(`Demo: ${sample.label} — processing...`);

    try {
      // Create a session for audit trail
      const sessRes = await dictationAPI.createSession({
        patient_id: patientId,
        visit_id: visitId,
        dictation_mode: sample.mode,
      });
      const demoSessionId = sessRes.data.id;
      setSessionId(demoSessionId);

      // Update session with the demo transcript
      await dictationAPI.updateSession(demoSessionId, {
        raw_transcript: sample.text,
        status: 'transcribed',
      });

      // AI Structure
      const sRes = await dictationAPI.structure({
        transcript: sample.text,
        mode: sample.mode,
        session_id: demoSessionId,
        patient_context: patient ? {
          name: patient.full_name,
          age: calcAge(patient.birthdate),
          sex: patient.sex,
          allergies: patient.allergies || [],
          chronic_conditions: patient.chronic_conditions || [],
        } : {},
      });

      if (sRes.data.structured) {
        setStructured(sRes.data.structured);
        setReviewFlags(sRes.data.structured.review_flags || []);
        setUncertainties(sRes.data.structured.uncertainties || []);
        setPipelineStatus('review');
        toast.success(`Demo complete — review the AI output`);
      } else {
        toast.warning('AI returned unstructured response');
        setPipelineStatus('review');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Demo processing failed'));
      setPipelineStatus('error');
    }
  };

  // ─── INSERT LOGIC ───
  const requestInsert = (target, content) => {
    const currentVal = target === 'subjective' ? soap.subjective
      : target === 'objective' ? soap.objective
      : target === 'assessment' ? soap.assessment
      : target === 'plan' ? soap.plan
      : target === 'prescriptions' ? prescriptions
      : target === 'orders' ? orders
      : target === 'instructions' ? instructions : '';

    if (currentVal.trim()) {
      setInsertDialog({ target, content, existing: currentVal });
    } else {
      doInsert(target, content, 'replace');
    }
  };

  const doInsert = (target, content, action) => {
    if (['subjective', 'objective', 'assessment', 'plan'].includes(target)) {
      setSoap(s => ({
        ...s,
        [target]: action === 'replace' ? content : (s[target] + '\n\n' + content),
      }));
    } else if (target === 'prescriptions') {
      setPrescriptions(prev => action === 'replace' ? content : prev + '\n\n' + content);
    } else if (target === 'orders') {
      setOrders(prev => action === 'replace' ? content : prev + '\n\n' + content);
    } else if (target === 'instructions') {
      setInstructions(prev => action === 'replace' ? content : prev + '\n\n' + content);
    }

    // Audit
    if (sessionId) {
      dictationAPI.logAudit({ session_id: sessionId, action_type: action === 'replace' ? 'section_overwritten' : 'section_inserted', notes: target });
    }
    setInsertDialog(null);
    toast.success(`Inserted into ${target}`);
  };

  const insertFullSOAP = () => {
    if (!structured) return;
    const s = structured;
    const subj = [s.subjective?.chief_complaint, s.subjective?.hpi, ...(s.subjective?.ros || [])].filter(Boolean).join('\n');
    const obj = [s.objective?.physical_exam, ...(s.objective?.diagnostics || [])].filter(Boolean).join('\n');
    const vitals = s.objective?.vitals;
    let objText = '';
    if (vitals) {
      const vParts = Object.entries(vitals).filter(([, v]) => v).map(([k, v]) => `${k.toUpperCase()}: ${v}`);
      if (vParts.length) objText += vParts.join(', ') + '\n';
    }
    objText += obj;
    const assess = (s.assessment || []).join('\n');
    const plan = (s.plan || []).join('\n');

    setSoap({ subjective: subj, objective: objText, assessment: assess, plan: plan });

    if (s.prescriptions?.length) {
      setPrescriptions(s.prescriptions.map(rx =>
        `${rx.drug || rx.generic_name || ''} ${rx.strength || ''} — ${rx.dose || ''} ${rx.route || ''} ${rx.frequency || ''} x ${rx.duration || ''} ${rx.prn ? '(PRN)' : ''} ${rx.notes || ''}`.trim()
      ).join('\n'));
    }
    if (s.orders?.length) {
      setOrders(s.orders.map(o => `${o.type?.toUpperCase() || ''}: ${o.name} ${o.details || ''} [${o.priority || 'routine'}]`.trim()).join('\n'));
    }
    if (s.patient_instructions?.length) {
      setInstructions(s.patient_instructions.join('\n'));
    }
    if (s.follow_up) setFollowUp(s.follow_up);

    if (sessionId) dictationAPI.logAudit({ session_id: sessionId, action_type: 'section_inserted', notes: 'full_soap' });
    toast.success('Full SOAP inserted into chart');
  };

  // ─── SAVE VISIT ───
  const handleSave = async () => {
    setSaving(true);
    try {
      // Combine plan with prescriptions and orders
      let fullPlan = soap.plan || '';
      if (prescriptions.trim()) {
        fullPlan += (fullPlan ? '\n\n' : '') + '--- Prescriptions ---\n' + prescriptions.trim();
      }
      if (orders.trim()) {
        fullPlan += (fullPlan ? '\n\n' : '') + '--- Orders ---\n' + orders.trim();
      }

      // Combine instructions with follow-up
      let fullInstructions = instructions || '';
      if (followUp.trim()) {
        fullInstructions += (fullInstructions ? '\n\n' : '') + 'Follow-up: ' + followUp.trim();
      }

      const visitData = {
        patient_id: patientId,
        soap_subjective: soap.subjective,
        soap_objective: soap.objective,
        soap_assessment: soap.assessment,
        soap_plan: fullPlan,
        patient_instructions: fullInstructions,
        follow_up_date: followUp || null,
      };

      let savedVisit;
      if (visitId) {
        savedVisit = await visitAPI.update(visitId, visitData);
      } else {
        savedVisit = await visitAPI.create(visitData);
      }

      if (sessionId) {
        await dictationAPI.updateSession(sessionId, {
          status: 'saved_to_chart',
          physician_reviewed: true,
          visit_id: savedVisit.data?.id || visitId,
        });
        dictationAPI.logAudit({ session_id: sessionId, action_type: 'saved_to_chart', notes: `Visit: ${savedVisit.data?.id || visitId}` });
      }

      toast.success(visitId ? 'Visit updated' : 'Visit saved');
      navigate(`/visits/${savedVisit.data?.id || visitId}`);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  // Copy helper
  const copyText = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const statusCfg = STATUS_CONFIG[pipelineStatus] || STATUS_CONFIG.idle;
  const isRecording = recorder.state === 'recording';
  const isPaused = recorder.state === 'paused';
  const isBusy = pipelineStatus === 'transcribing' || pipelineStatus === 'ai_processing';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F766E]" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col" data-testid="ai-consultation-page">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 bg-white shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="back-btn">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Stethoscope className="w-5 h-5 text-[#0F766E] shrink-0" />
          <h1 className="font-heading font-bold text-slate-900 truncate">AI Consultation</h1>
          {patient && <span className="text-sm text-slate-500 truncate">— {patient.full_name}</span>}
        </div>
        <Badge className={`${statusCfg.color} gap-1.5`} data-testid="pipeline-status">
          <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </Badge>
        <Button onClick={handleSave} disabled={saving} className="bg-[#0F766E] hover:bg-[#115E59]" data-testid="save-visit-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {visitId ? 'Update Visit' : 'Save Visit'}
        </Button>
      </div>

      {/* 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Patient Snapshot */}
        <aside className="w-64 border-r border-slate-200 bg-slate-50 overflow-y-auto shrink-0 hidden lg:block" data-testid="patient-snapshot">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#0F766E]/10 flex items-center justify-center">
                <User className="w-6 h-6 text-[#0F766E]" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate text-sm">{patient?.full_name}</p>
                <p className="text-xs text-slate-500">{calcAge(patient?.birthdate)}yo {patient?.sex} &middot; {patient?.patient_id}</p>
              </div>
            </div>

            {patient?.allergies?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Allergies</p>
                <div className="flex flex-wrap gap-1">
                  {patient.allergies.map((a, i) => <Badge key={i} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">{a}</Badge>)}
                </div>
              </div>
            )}

            {patient?.chronic_conditions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Conditions</p>
                <div className="flex flex-wrap gap-1">
                  {patient.chronic_conditions.map((c, i) => <Badge key={i} variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">{c}</Badge>)}
                </div>
              </div>
            )}

            {visits.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Recent Visits</p>
                <div className="space-y-1">
                  {visits.slice(0, 3).map(v => (
                    <button key={v.id} onClick={() => navigate(`/visits/${v.id}`)}
                      className="w-full text-left p-2 rounded-lg bg-white border border-slate-100 hover:border-[#0F766E]/30 text-xs transition-colors">
                      <p className="font-medium text-slate-700 truncate">{v.soap_assessment || 'No assessment'}</p>
                      <p className="text-slate-400">{v.created_at?.split('T')[0]}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: SOAP Editor */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="soap-editor">
          {/* SOAP Sections */}
          {[
            { key: 'subjective', label: 'Subjective', placeholder: 'Chief complaint, HPI, ROS...' },
            { key: 'objective', label: 'Objective', placeholder: 'Vitals, physical exam findings...' },
            { key: 'assessment', label: 'Assessment', placeholder: 'Diagnoses, impressions...' },
            { key: 'plan', label: 'Plan', placeholder: 'Treatment plan, medications, follow-up...' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <Label className="text-sm font-semibold text-slate-700">{label}</Label>
              <Textarea
                value={soap[key]}
                onChange={(e) => setSoap(s => ({ ...s, [key]: e.target.value }))}
                placeholder={placeholder}
                className="mt-1 min-h-[100px] font-mono text-sm bg-white"
                data-testid={`soap-${key}`}
              />
            </div>
          ))}

          {/* Prescriptions */}
          <div>
            <Label className="text-sm font-semibold text-slate-700">Prescriptions</Label>
            <Textarea
              value={prescriptions}
              onChange={(e) => setPrescriptions(e.target.value)}
              placeholder="Medication details..."
              className="mt-1 min-h-[80px] font-mono text-sm bg-white"
              data-testid="soap-prescriptions"
            />
          </div>

          {/* Orders */}
          <div>
            <Label className="text-sm font-semibold text-slate-700">Orders (Labs / Imaging)</Label>
            <Textarea
              value={orders}
              onChange={(e) => setOrders(e.target.value)}
              placeholder="Lab and imaging orders..."
              className="mt-1 min-h-[60px] font-mono text-sm bg-white"
              data-testid="soap-orders"
            />
          </div>

          {/* Patient Instructions */}
          <div>
            <Label className="text-sm font-semibold text-slate-700">Patient Instructions</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Discharge instructions, return precautions..."
              className="mt-1 min-h-[60px] font-mono text-sm bg-white"
              data-testid="soap-instructions"
            />
          </div>

          {/* Follow-up */}
          <div>
            <Label className="text-sm font-semibold text-slate-700">Follow-up</Label>
            <Input
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="e.g., Return in 3 days, Follow up in 2 weeks"
              className="mt-1 bg-white"
              data-testid="soap-followup"
            />
          </div>
        </main>

        {/* RIGHT: AI Dictation Panel */}
        <aside className="w-96 border-l border-slate-200 bg-white overflow-y-auto shrink-0 hidden md:flex flex-col" data-testid="dictation-panel">
          <div className="p-4 space-y-4 flex-1">
            {/* Mode Selector */}
            <div>
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dictation Mode</Label>
              <Select value={dictMode} onValueChange={setDictMode} disabled={isRecording || isPaused}>
                <SelectTrigger className="mt-1" data-testid="dictation-mode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DICTATION_MODES.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="flex items-center gap-2"><m.icon className="w-3.5 h-3.5" />{m.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Demo Mode Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Demo Mode</Label>
              <button
                onClick={() => { setDemoMode(!demoMode); if (demoMode) handleClear(); }}
                className={`relative w-10 h-5 rounded-full transition-colors ${demoMode ? 'bg-indigo-500' : 'bg-slate-200'}`}
                data-testid="demo-mode-toggle"
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${demoMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Demo Sample Cards */}
            {demoMode && !isBusy && pipelineStatus !== 'review' && (
              <div className="space-y-2" data-testid="demo-samples">
                <p className="text-xs text-slate-500">Select a sample dictation to test the AI pipeline:</p>
                {DEMO_SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleDemoSelect(sample)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all hover:shadow-sm ${sample.color}`}
                    data-testid={`demo-sample-${sample.id}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold">{sample.label}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{sample.badge}</Badge>
                    </div>
                    <p className="text-[11px] opacity-75 line-clamp-2">{sample.text}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Mic Device Selector */}
            {recorder.devices.length > 1 && !demoMode && (
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Microphone</Label>
                <Select value={recorder.selectedDevice} onValueChange={recorder.setSelectedDevice} disabled={isRecording}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {recorder.devices.map(d => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* === DICTATION INPUT (always visible when not in demo mode) === */}
            {!demoMode && (
              <div className="space-y-3">
                {/* Voice Recording Bar */}
                <Card className="border-slate-200">
                  <CardContent className="p-3 space-y-2">
                    {/* Audio Level + Timer row */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-100 rounded-full" style={{ width: `${recorder.audioLevel * 100}%` }} data-testid="audio-level-meter" />
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-700 w-12 text-right" data-testid="recording-timer">{fmtTime(recorder.duration)}</span>
                    </div>
                    {/* Control Buttons */}
                    <div className="flex items-center justify-center gap-2">
                      {(!isRecording && !isPaused) ? (
                        <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white rounded-full h-10 w-10 p-0" onClick={handleStart} disabled={isBusy} data-testid="start-dictation-btn">
                          <Mic className="w-5 h-5" />
                        </Button>
                      ) : isRecording ? (
                        <>
                          <Button variant="outline" size="sm" onClick={handlePause} className="rounded-full h-9 w-9 p-0" data-testid="pause-btn"><Pause className="w-4 h-4" /></Button>
                          <Button size="sm" className="bg-slate-800 hover:bg-slate-900 text-white rounded-full h-10 w-10 p-0" onClick={handleStop} data-testid="stop-btn"><Square className="w-4 h-4" /></Button>
                        </>
                      ) : isPaused ? (
                        <>
                          <Button variant="outline" size="sm" onClick={handleResume} className="rounded-full h-9 w-9 p-0 border-green-300 text-green-600" data-testid="resume-btn"><Play className="w-4 h-4" /></Button>
                          <Button size="sm" className="bg-slate-800 hover:bg-slate-900 text-white rounded-full h-10 w-10 p-0" onClick={handleStop} data-testid="stop-btn"><Square className="w-4 h-4" /></Button>
                        </>
                      ) : null}
                    </div>
                    {recorder.error && <p className="text-xs text-red-600 text-center">{recorder.error}</p>}
                  </CardContent>
                </Card>

                {/* Live Transcript (during recording) */}
                {(isRecording || isPaused) && (recorder.liveTranscript || recorder.interimText) && (
                  <div className="p-3 bg-red-50/50 rounded-lg border border-red-200 max-h-28 overflow-y-auto text-sm text-slate-700 leading-relaxed" data-testid="live-transcript-panel">
                    <p className="text-xs font-semibold text-red-500 mb-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live</p>
                    {recorder.liveTranscript}
                    {recorder.interimText && <span className="text-slate-400 italic"> {recorder.interimText}</span>}
                  </div>
                )}

                {/* Dictation Text Area (always visible) */}
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dictation Text</Label>
                  <Textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Speak using the mic above, or type/paste your clinical dictation here..."
                    className="mt-1 min-h-[100px] text-sm bg-white"
                    data-testid="dictation-text-area"
                  />
                </div>

                {/* Process / Clear buttons */}
                <div className="flex gap-2">
                  {transcript.trim() && !isBusy && (
                    <Button className="flex-1 bg-[#0F766E] hover:bg-[#115E59] text-xs" onClick={() => processTranscript(transcript.trim())} data-testid="process-ai-btn">
                      <Wand2 className="w-3.5 h-3.5 mr-1" /> Process with AI
                    </Button>
                  )}
                  {isBusy && (
                    <div className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-indigo-600">
                      <Loader2 className="w-4 h-4 animate-spin" /> AI processing...
                    </div>
                  )}
                  {(transcript || structured) && !isBusy && (
                    <>
                      <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs text-slate-500" data-testid="clear-btn">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                      </Button>
                      {transcript && structured && (
                        <Button variant="ghost" size="sm" onClick={handleReprocess} className="text-xs text-indigo-600" data-testid="reprocess-btn">
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reprocess
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Demo mode: processing indicator */}
            {demoMode && isBusy && (
              <Card className="border-indigo-200 bg-indigo-50">
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-sm font-medium text-indigo-700">
                    {pipelineStatus === 'ai_processing' ? 'AI structuring transcript...' : 'Processing...'}
                  </p>
                  <p className="text-xs text-indigo-500">This may take 10-20 seconds</p>
                </CardContent>
              </Card>
            )}

            {/* Demo mode: clear & reprocess for demo results */}
            {demoMode && (transcript || structured) && !isBusy && (
              <div className="flex gap-2 justify-center">
                <Button variant="ghost" size="sm" onClick={() => { handleClear(); }} className="text-xs text-slate-500" data-testid="demo-clear-btn">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                </Button>
                {transcript && (
                  <Button variant="ghost" size="sm" onClick={handleReprocess} className="text-xs text-indigo-600" data-testid="demo-reprocess-btn">
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reprocess
                  </Button>
                )}
              </div>
            )}

            {/* Review Flags & Uncertainties */}
            {(reviewFlags.length > 0 || uncertainties.length > 0) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Review Required
                </p>
                {reviewFlags.map((f, i) => <p key={`rf-${i}`} className="text-xs text-amber-600">- {f}</p>)}
                {uncertainties.map((u, i) => <p key={`uc-${i}`} className="text-xs text-amber-600">- {u}</p>)}
              </div>
            )}

            {/* Structured Output */}
            {structured && (
              <div>
                <button onClick={() => setExpandOutput(!expandOutput)}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider w-full">
                  {expandOutput ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  AI Structured Output
                </button>
                {expandOutput && (
                  <div className="mt-1 space-y-2" data-testid="structured-output">
                    {/* Insert Full SOAP */}
                    <Button size="sm" className="w-full bg-[#0F766E] hover:bg-[#115E59] text-xs" onClick={insertFullSOAP} data-testid="insert-full-soap">
                      <ArrowDownToLine className="w-3.5 h-3.5 mr-1" /> Insert Full SOAP
                    </Button>

                    {/* Subjective */}
                    {(structured.subjective?.chief_complaint || structured.subjective?.hpi) && (
                      <OutputCard title="Subjective" target="subjective"
                        content={[structured.subjective.chief_complaint, structured.subjective.hpi, ...(structured.subjective.ros || [])].filter(Boolean).join('\n')}
                        onInsert={requestInsert} />
                    )}
                    {/* Objective */}
                    {structured.objective?.physical_exam && (
                      <OutputCard title="Objective" target="objective"
                        content={structured.objective.physical_exam}
                        onInsert={requestInsert} />
                    )}
                    {/* Assessment */}
                    {structured.assessment?.length > 0 && (
                      <OutputCard title="Assessment" target="assessment"
                        content={structured.assessment.join('\n')}
                        onInsert={requestInsert} />
                    )}
                    {/* Plan */}
                    {structured.plan?.length > 0 && (
                      <OutputCard title="Plan" target="plan"
                        content={structured.plan.join('\n')}
                        onInsert={requestInsert} />
                    )}
                    {/* Prescriptions */}
                    {structured.prescriptions?.length > 0 && (
                      <OutputCard title="Prescriptions" target="prescriptions"
                        content={structured.prescriptions.map(rx =>
                          `${rx.drug || rx.generic_name || ''} ${rx.strength || ''} — ${rx.dose || ''} ${rx.route || ''} ${rx.frequency || ''} x ${rx.duration || ''} ${rx.prn ? '(PRN)' : ''} ${rx.confidence === 'low' ? '[REVIEW]' : ''}`.trim()
                        ).join('\n')}
                        onInsert={requestInsert}
                        warn={structured.prescriptions.some(rx => rx.confidence === 'low')} />
                    )}
                    {/* Orders */}
                    {structured.orders?.length > 0 && (
                      <OutputCard title="Orders" target="orders"
                        content={structured.orders.map(o => `${o.type?.toUpperCase()}: ${o.name} ${o.details || ''} [${o.priority}]`.trim()).join('\n')}
                        onInsert={requestInsert} />
                    )}
                    {/* Instructions */}
                    {structured.patient_instructions?.length > 0 && (
                      <OutputCard title="Patient Instructions" target="instructions"
                        content={structured.patient_instructions.join('\n')}
                        onInsert={requestInsert} />
                    )}
                    {/* Follow-up */}
                    {structured.follow_up && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                        <p className="font-semibold text-blue-700">Follow-up: {structured.follow_up}</p>
                      </div>
                    )}
                    {/* ICD-10 Suggestions */}
                    {structured.icd10_suggestions?.length > 0 && (
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="text-xs font-semibold text-slate-500 mb-1">ICD-10 Suggestions (for reference only)</p>
                        {structured.icd10_suggestions.map((c, i) => (
                          <p key={i} className="text-xs text-slate-600"><span className="font-mono font-medium">{c.code}</span> — {c.label}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Insert Confirmation Dialog */}
      <Dialog open={!!insertDialog} onOpenChange={() => setInsertDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert into {insertDialog?.target}</DialogTitle>
            <DialogDescription>This section already has content. How would you like to proceed?</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="p-2 bg-slate-50 rounded text-xs text-slate-600 max-h-24 overflow-y-auto">
              <p className="font-semibold mb-1">Existing:</p>
              {insertDialog?.existing?.substring(0, 200)}{insertDialog?.existing?.length > 200 ? '...' : ''}
            </div>
            <div className="p-2 bg-blue-50 rounded text-xs text-blue-700 max-h-24 overflow-y-auto">
              <p className="font-semibold mb-1">New content:</p>
              {insertDialog?.content?.substring(0, 200)}{insertDialog?.content?.length > 200 ? '...' : ''}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setInsertDialog(null)} data-testid="insert-cancel">Cancel</Button>
            <Button variant="outline" className="border-blue-300 text-blue-700" onClick={() => doInsert(insertDialog.target, insertDialog.content, 'append')} data-testid="insert-append">Append</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={() => doInsert(insertDialog.target, insertDialog.content, 'replace')} data-testid="insert-replace">Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Output Card Component ───
function OutputCard({ title, target, content, onInsert, warn }) {
  return (
    <div className={`p-2.5 rounded-lg border text-xs ${warn ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`font-semibold ${warn ? 'text-amber-700' : 'text-slate-700'}`}>
          {warn && <AlertTriangle className="w-3 h-3 inline mr-1" />}{title}
        </span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[#0F766E] text-xs" onClick={() => onInsert(target, content)} data-testid={`insert-${target}`}>
          <ArrowDownToLine className="w-3 h-3 mr-1" /> Insert
        </Button>
      </div>
      <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}
