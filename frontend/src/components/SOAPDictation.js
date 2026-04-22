import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Mic, MicOff, Loader2, Sparkles, Trash2, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { dictationAPI } from '../lib/api';
import { getErrorMessage } from '../lib/utils';

const DEMO_CASES = [
  { label: 'Cough & Fever', text: 'Patient is a 45-year-old male presenting with 3 days of productive cough with yellowish sputum, low-grade fever at 38.2 degrees, and body malaise. No chest pain, no shortness of breath. Denies any travel history. On physical exam: alert, not in distress. Throat is slightly hyperemic. Lungs with crackles on the right lower lobe. Heart sounds normal. Assessment is community-acquired pneumonia. Plan: Amoxicillin 500mg every 8 hours for 7 days, Paracetamol 500mg every 6 hours as needed for fever, chest x-ray PA view, follow up in 3 days.' },
  { label: 'Headache', text: 'A 32-year-old female comes in for recurrent headache for the past 2 weeks, described as throbbing, bilateral, rated 6 out of 10, worsened by stress and lack of sleep. She denies visual changes, nausea, or vomiting. No history of head trauma. Physical exam is essentially normal, neurological exam intact. Impression: tension-type headache. Plan: Ibuprofen 400mg PRN for pain, lifestyle modification, adequate sleep, stress management. Return if symptoms worsen or new neurological symptoms develop.' },
];

const SOAPDictation = ({ patient, onApplySOAP }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dictText, setDictText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 1000) {
          setIsTranscribing(true);
          try {
            const formData = new FormData();
            formData.append('audio', blob, 'recording.webm');
            formData.append('language', 'en');
            formData.append('prompt', 'Medical clinic consultation dictation.');
            const res = await dictationAPI.transcribe(formData);
            const text = res.data?.transcript;
            if (text?.trim()) {
              setDictText(prev => prev ? `${prev} ${text.trim()}` : text.trim());
              toast.success('Voice transcribed');
            } else {
              toast.info('No speech detected. Please try again or type your notes.');
            }
          } catch (err) {
            const msg = err?.response?.data?.detail || '';
            if (msg.includes('API key not configured')) {
              toast.error('OpenAI API key not configured. Go to Settings to add your key.');
            } else {
              toast.error('Transcription failed: ' + (msg || 'Unknown error'));
            }
          } finally {
            setIsTranscribing(false);
          }
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      toast.success('Recording... Speak now');
    } catch (err) {
      toast.error('Microphone access denied. Please allow microphone access or type your notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processWithAI = async () => {
    if (!dictText.trim()) {
      toast.error('Please record or type your clinical notes first');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await dictationAPI.structure({
        transcript: dictText,
        mode: 'full_visit',
        patient_context: patient ? {
          name: patient.full_name,
          age: patient.age,
          sex: patient.sex,
        } : {},
      });
      const s = res.data?.structured;
      if (s) {
        // Extract SOAP text from structured response
        const subjective = [
          s.subjective?.chief_complaint,
          s.subjective?.hpi,
          ...(s.subjective?.ros || [])
        ].filter(Boolean).join('\n');

        const objective = [
          s.objective?.physical_exam,
          ...(s.objective?.diagnostics || [])
        ].filter(Boolean).join('\n');

        const assessment = Array.isArray(s.assessment)
          ? s.assessment.map((a, i) => `${i + 1}. ${a}`).join('\n')
          : (s.assessment || '');

        const planItems = Array.isArray(s.plan) ? s.plan : [];
        let planText = planItems.map((p, i) => `${i + 1}. ${p}`).join('\n');

        // Append medications if present
        if (s.prescriptions?.length) {
          const medsText = s.prescriptions.map(m =>
            `- ${m.name || m.medication || ''} ${m.dose || m.dosage || ''} ${m.frequency || ''} ${m.duration ? 'for ' + m.duration : ''}`.trim()
          ).join('\n');
          planText = planText
            ? `${planText}\n\nMedications:\n${medsText}`
            : `Medications:\n${medsText}`;
        }

        onApplySOAP({
          subjective: subjective || '',
          objective: objective || '',
          assessment: assessment || '',
          plan: planText || '',
        });
        toast.success('SOAP notes filled from AI dictation');
        setDictText('');
        setIsOpen(false);
      } else {
        toast.warning('AI could not structure the notes. Try adding more detail.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'AI processing failed'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-[#0F766E] border-[#0F766E]/30 hover:bg-[#0F766E]/10"
        data-testid="open-dictation-btn"
      >
        <Mic className="w-4 h-4 mr-2" />
        AI Dictation
      </Button>
    );
  }

  return (
    <div className="mb-4 p-4 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-lg border border-teal-200" data-testid="soap-dictation-panel">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#0F766E]" />
          <span className="text-sm font-semibold text-[#0F766E]">AI Dictation</span>
          {isRecording && <Badge className="bg-red-100 text-red-700 animate-pulse text-xs">Recording</Badge>}
          {isTranscribing && <Badge className="bg-amber-100 text-amber-700 text-xs">Transcribing...</Badge>}
          {isProcessing && <Badge className="bg-blue-100 text-blue-700 text-xs">Processing...</Badge>}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setIsOpen(false); stopRecording(); }} className="h-7 w-7 p-0">
          <span className="sr-only">Close</span>&times;
        </Button>
      </div>

      {/* Demo cases */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="text-xs text-slate-500">Demo:</span>
        {DEMO_CASES.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setDictText(c.text)}
            className="text-xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-[#0F766E] hover:text-[#0F766E] transition-colors"
            data-testid={`demo-case-${i}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Text area */}
      <Textarea
        value={dictText}
        onChange={(e) => setDictText(e.target.value)}
        placeholder="Speak or type your clinical notes here... The AI will structure them into SOAP format."
        rows={4}
        className="bg-white mb-3 text-sm"
        data-testid="dictation-text-input"
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startRecording}
            disabled={isTranscribing || isProcessing}
            className="text-[#0F766E] border-[#0F766E]/30 hover:bg-[#0F766E]/10"
            data-testid="mic-record-btn"
          >
            <Mic className="w-4 h-4 mr-1" />
            Record
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={stopRecording}
            className="bg-red-600 hover:bg-red-700 text-white"
            data-testid="mic-stop-btn"
          >
            <MicOff className="w-4 h-4 mr-1" />
            Stop
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          onClick={processWithAI}
          disabled={!dictText.trim() || isProcessing || isRecording}
          className="bg-[#0F766E] hover:bg-[#115E59]"
          data-testid="process-ai-btn"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-1" />
          )}
          Process with AI
        </Button>

        {dictText && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDictText('')}
            className="text-slate-500 hover:text-red-500"
            data-testid="clear-dictation-btn"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};

export default SOAPDictation;
