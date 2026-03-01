import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Sparkles, Brain, Pill, AlertTriangle, FileText, 
  Loader2, ChevronDown, ChevronUp, Copy, Check, 
  Stethoscope, ClipboardList, AlertCircle, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { aiAPI } from '../lib/api';
import { getErrorMessage } from '../lib/utils';

const AIConsultation = ({ patient, vitals, onApplySOAP, onApplyMedications }) => {
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showDetails, setShowDetails] = useState(true);
  const [copied, setCopied] = useState(null);
  const [redFlags, setRedFlags] = useState([]);
  const [checkingRedFlags, setCheckingRedFlags] = useState(false);

  const runFullConsultation = async () => {
    if (!clinicalNotes.trim()) {
      toast.error('Please enter clinical notes first');
      return;
    }
    
    setIsLoading(true);
    setAiResult(null);
    
    try {
      const patientContext = {
        age: patient?.age,
        sex: patient?.sex,
        allergies: patient?.allergies || [],
        chronic_conditions: patient?.chronic_conditions || []
      };
      
      const response = await aiAPI.fullConsultation(clinicalNotes, patientContext, vitals);
      
      // Try to parse JSON from the response
      let parsed = null;
      try {
        const jsonMatch = response.data.result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // If JSON parsing fails, show raw result
      }
      
      setAiResult({
        raw: response.data.result,
        parsed
      });
      
      toast.success('AI consultation generated');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to generate AI consultation'));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkForRedFlags = async () => {
    setCheckingRedFlags(true);
    try {
      const patientContext = {
        age: patient?.age,
        sex: patient?.sex,
        allergies: patient?.allergies || [],
        chronic_conditions: patient?.chronic_conditions || []
      };
      
      const currentMeds = aiResult?.parsed?.medications?.map(m => m.name) || [];
      
      const response = await aiAPI.checkRedFlags(vitals, currentMeds, patientContext);
      
      let alerts = [];
      try {
        const jsonMatch = response.data.result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          alerts = parsed.alerts || [];
        }
      } catch (e) {
        // Couldn't parse
      }
      
      setRedFlags(alerts);
      if (alerts.some(a => a.severity === 'critical')) {
        toast.error('Critical alerts detected!');
      } else if (alerts.length > 0) {
        toast.warning(`${alerts.length} alert(s) found`);
      } else {
        toast.success('No red flags detected');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to check red flags'));
    } finally {
      setCheckingRedFlags(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const applySOAP = () => {
    if (aiResult?.parsed?.soap) {
      onApplySOAP(aiResult.parsed.soap);
      toast.success('SOAP notes applied');
    }
  };

  const applyMedications = () => {
    if (aiResult?.parsed?.medications) {
      onApplyMedications(aiResult.parsed.medications);
      toast.success('Medications applied');
    }
  };

  const severityColors = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  return (
    <Card className="bg-gradient-to-br from-[#0F766E]/5 to-white border-[#0F766E]/20 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading flex items-center gap-2 text-[#0F766E]">
          <Brain className="w-5 h-5" />
          AI-Assisted Consultation
          <Badge className="ml-2 bg-[#0F766E]/10 text-[#0F766E] font-normal">Beta</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-2">
          <Label className="text-sm text-slate-600">Enter brief clinical notes</Label>
          <Textarea
            placeholder="e.g., fever cough 3 days crackles RLL, or 45M chest pain radiating to left arm, diaphoretic..."
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            rows={3}
            className="resize-none border-[#0F766E]/20 focus:border-[#0F766E]"
            data-testid="ai-clinical-notes"
          />
          <p className="text-xs text-slate-400">
            Enter symptoms, findings, and observations. AI will generate SOAP notes, diagnosis suggestions, ICD-10 codes, and treatment plan.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runFullConsultation}
            disabled={isLoading || !clinicalNotes.trim()}
            className="bg-[#0F766E] hover:bg-[#115E59]"
            data-testid="ai-generate-btn"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate AI Consultation
              </>
            )}
          </Button>
          
          {vitals && (
            <Button
              variant="outline"
              onClick={checkForRedFlags}
              disabled={checkingRedFlags}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              data-testid="ai-red-flags-btn"
            >
              {checkingRedFlags ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4 mr-2" />
              )}
              Check Red Flags
            </Button>
          )}
        </div>

        {/* Red Flag Alerts */}
        {redFlags.length > 0 && (
          <div className="space-y-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center gap-2 font-medium text-red-800">
              <AlertCircle className="w-5 h-5" />
              Clinical Alerts
            </div>
            <div className="space-y-2">
              {redFlags.map((alert, idx) => (
                <div key={idx} className={`p-2 rounded border ${severityColors[alert.severity] || severityColors.info}`}>
                  <div className="flex items-start gap-2">
                    <Badge className={`${severityColors[alert.severity]} text-xs px-1.5`}>
                      {alert.severity?.toUpperCase()}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alert.message}</p>
                      {alert.recommendation && (
                        <p className="text-xs mt-1 opacity-80">{alert.recommendation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Results */}
        {aiResult && (
          <div className="space-y-4 pt-4 border-t border-[#0F766E]/10">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0F766E]" />
                AI Consultation Results
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-slate-500"
              >
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>

            {showDetails && aiResult.parsed && (
              <div className="space-y-4">
                {/* SOAP Notes */}
                {aiResult.parsed.soap && (
                  <div className="p-4 rounded-lg bg-white border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#0F766E]" />
                        Generated SOAP Notes
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(JSON.stringify(aiResult.parsed.soap, null, 2), 'soap')}
                          className="h-7 px-2"
                        >
                          {copied === 'soap' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                        <Button
                          size="sm"
                          onClick={applySOAP}
                          className="h-7 bg-[#0F766E] hover:bg-[#115E59]"
                          data-testid="ai-apply-soap"
                        >
                          Apply SOAP
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      {aiResult.parsed.soap.subjective && (
                        <div>
                          <Badge className="bg-blue-100 text-blue-800 mb-1">S</Badge>
                          <p className="text-slate-700">{aiResult.parsed.soap.subjective}</p>
                        </div>
                      )}
                      {aiResult.parsed.soap.objective && (
                        <div>
                          <Badge className="bg-green-100 text-green-800 mb-1">O</Badge>
                          <p className="text-slate-700">{aiResult.parsed.soap.objective}</p>
                        </div>
                      )}
                      {aiResult.parsed.soap.assessment && (
                        <div>
                          <Badge className="bg-amber-100 text-amber-800 mb-1">A</Badge>
                          <p className="text-slate-700">{aiResult.parsed.soap.assessment}</p>
                        </div>
                      )}
                      {aiResult.parsed.soap.plan && (
                        <div>
                          <Badge className="bg-purple-100 text-purple-800 mb-1">P</Badge>
                          <p className="text-slate-700">{aiResult.parsed.soap.plan}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Diagnoses */}
                {aiResult.parsed.diagnoses && aiResult.parsed.diagnoses.length > 0 && (
                  <div className="p-4 rounded-lg bg-white border border-slate-200">
                    <h4 className="font-medium flex items-center gap-2 mb-3">
                      <Stethoscope className="w-4 h-4 text-[#0F766E]" />
                      Diagnosis Suggestions & ICD-10 Codes
                    </h4>
                    <div className="space-y-2">
                      {aiResult.parsed.diagnoses.map((dx, idx) => (
                        <div key={idx} className="flex items-start justify-between p-2 rounded bg-slate-50">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{dx.name}</span>
                              {dx.icd10 && (
                                <Badge variant="outline" className="font-mono text-xs">{dx.icd10}</Badge>
                              )}
                              {dx.confidence && (
                                <Badge className={`text-xs ${
                                  dx.confidence === 'high' ? 'bg-green-100 text-green-800' :
                                  dx.confidence === 'medium' ? 'bg-amber-100 text-amber-800' :
                                  'bg-slate-100 text-slate-800'
                                }`}>
                                  {dx.confidence}
                                </Badge>
                              )}
                            </div>
                            {dx.reasoning && <p className="text-xs text-slate-500 mt-1">{dx.reasoning}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medications */}
                {aiResult.parsed.medications && aiResult.parsed.medications.length > 0 && (
                  <div className="p-4 rounded-lg bg-white border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Pill className="w-4 h-4 text-[#0F766E]" />
                        Suggested Medications
                      </h4>
                      <Button
                        size="sm"
                        onClick={applyMedications}
                        className="h-7 bg-[#0F766E] hover:bg-[#115E59]"
                        data-testid="ai-apply-meds"
                      >
                        Apply Medications
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {aiResult.parsed.medications.map((med, idx) => (
                        <div key={idx} className="p-2 rounded bg-slate-50 text-sm">
                          <div className="font-medium">{med.name}</div>
                          <div className="text-slate-600">
                            {med.dose} • {med.frequency} • {med.duration}
                          </div>
                          {med.notes && <div className="text-xs text-slate-500 mt-1">{med.notes}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up */}
                {aiResult.parsed.follow_up && (
                  <div className="p-4 rounded-lg bg-white border border-slate-200">
                    <h4 className="font-medium flex items-center gap-2 mb-3">
                      <ClipboardList className="w-4 h-4 text-[#0F766E]" />
                      Follow-up Plan
                    </h4>
                    <div className="text-sm space-y-2">
                      {aiResult.parsed.follow_up.timeline && (
                        <p><strong>Timeline:</strong> {aiResult.parsed.follow_up.timeline}</p>
                      )}
                      {aiResult.parsed.follow_up.instructions && (
                        <p><strong>Instructions:</strong> {aiResult.parsed.follow_up.instructions}</p>
                      )}
                      {aiResult.parsed.follow_up.red_flags && aiResult.parsed.follow_up.red_flags.length > 0 && (
                        <div>
                          <strong className="text-red-600">Red Flags to Watch:</strong>
                          <ul className="list-disc list-inside text-slate-600 mt-1">
                            {aiResult.parsed.follow_up.red_flags.map((flag, idx) => (
                              <li key={idx}>{flag}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ICD-10 Codes Summary */}
                {aiResult.parsed.icd10_codes && aiResult.parsed.icd10_codes.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-slate-50">
                    <span className="text-sm font-medium text-slate-700">ICD-10 Codes:</span>
                    {aiResult.parsed.icd10_codes.map((code, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono">{code}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Raw result fallback */}
            {showDetails && !aiResult.parsed && aiResult.raw && (
              <div className="p-4 rounded-lg bg-slate-50 text-sm whitespace-pre-wrap">
                {aiResult.raw}
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
          <strong>Disclaimer:</strong> AI suggestions are for clinical decision support only. 
          All diagnoses and treatments must be verified by the attending physician.
        </div>
      </CardContent>
    </Card>
  );
};

export default AIConsultation;
