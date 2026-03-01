import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  Sparkles, Brain, Pill, AlertTriangle, FileText, 
  Loader2, ChevronDown, ChevronUp, Copy, Check, 
  Stethoscope, ClipboardList, AlertCircle, Zap,
  Save, FolderOpen, Trash2, Clock, GitCompare, X, ArrowLeftRight
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
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [showCompareDialog, setShowCompareDialog] = useState(false);

  // Load saved drafts on mount
  useEffect(() => {
    if (patient?.id) {
      loadDrafts();
    }
  }, [patient?.id]);

  const loadDrafts = async () => {
    if (!patient?.id) return;
    try {
      const response = await aiAPI.getDrafts(patient.id);
      // Transform API response to match component's expected format
      const drafts = response.data.map(d => ({
        id: d.id,
        clinicalNotes: d.clinical_notes,
        aiResult: d.ai_result,
        redFlags: d.red_flags || [],
        savedAt: d.created_at,
        createdByName: d.created_by_name
      }));
      setSavedDrafts(drafts);
    } catch (e) {
      console.error('Failed to load drafts:', e);
      // Silently fail - drafts are not critical
    }
  };

  const saveDraft = async () => {
    if (!aiResult) {
      toast.error('No AI consultation to save');
      return;
    }

    try {
      const draftData = {
        patient_id: patient.id,
        clinical_notes: clinicalNotes,
        ai_result: aiResult,
        red_flags: redFlags
      };

      const response = await aiAPI.saveDraft(draftData);
      const newDraft = {
        id: response.data.id,
        clinicalNotes: response.data.clinical_notes,
        aiResult: response.data.ai_result,
        redFlags: response.data.red_flags || [],
        savedAt: response.data.created_at,
        createdByName: response.data.created_by_name
      };

      setSavedDrafts(prev => [newDraft, ...prev.slice(0, 9)]); // Keep max 10
      toast.success('Draft saved to history');
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to save draft'));
      console.error(e);
    }
  };

  const loadDraft = (draft) => {
    setClinicalNotes(draft.clinicalNotes);
    setAiResult(draft.aiResult);
    setRedFlags(draft.redFlags || []);
    setShowDrafts(false);
    toast.success('Draft loaded');
  };

  const deleteDraft = async (draftId) => {
    try {
      await aiAPI.deleteDraft(draftId);
      setSavedDrafts(prev => prev.filter(d => d.id !== draftId));
      toast.success('Draft deleted');
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to delete draft'));
    }
  };

  const clearAllDrafts = async () => {
    if (!patient?.id) return;
    try {
      await aiAPI.deleteAllDrafts(patient.id);
      setSavedDrafts([]);
      setShowDrafts(false);
      toast.success('All drafts cleared');
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to clear drafts'));
    }
  };

  const formatDraftDate = (isoDate) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Compare functions
  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setSelectedForCompare([]);
  };

  const toggleDraftSelection = (draft) => {
    if (selectedForCompare.find(d => d.id === draft.id)) {
      setSelectedForCompare(selectedForCompare.filter(d => d.id !== draft.id));
    } else if (selectedForCompare.length < 2) {
      const newSelection = [...selectedForCompare, draft];
      setSelectedForCompare(newSelection);
      if (newSelection.length === 2) {
        setShowCompareDialog(true);
      }
    }
  };

  const closeCompare = () => {
    setShowCompareDialog(false);
    setSelectedForCompare([]);
    setCompareMode(false);
  };

  const applyFromCompare = (draft) => {
    setClinicalNotes(draft.clinicalNotes);
    setAiResult(draft.aiResult);
    setRedFlags(draft.redFlags || []);
    closeCompare();
    setShowDrafts(false);
    toast.success('Draft applied from comparison');
  };

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
            type="button"
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
              type="button"
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

          {/* Save Draft Button */}
          {aiResult && (
            <Button
              type="button"
              variant="outline"
              onClick={saveDraft}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
              data-testid="ai-save-draft-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
          )}

          {/* Load Drafts Button */}
          {savedDrafts.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDrafts(!showDrafts)}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
              data-testid="ai-load-drafts-btn"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Saved Drafts ({savedDrafts.length})
            </Button>
          )}

          {/* Compare Button */}
          {savedDrafts.length >= 2 && (
            <Button
              type="button"
              variant="outline"
              onClick={toggleCompareMode}
              className={`border-indigo-300 text-indigo-700 hover:bg-indigo-50 ${compareMode ? 'bg-indigo-100' : ''}`}
              data-testid="ai-compare-btn"
            >
              <GitCompare className="w-4 h-4 mr-2" />
              Compare
            </Button>
          )}
        </div>

        {/* Saved Drafts Panel */}
        {showDrafts && savedDrafts.length > 0 && (
          <div className="p-4 rounded-lg bg-purple-50 border border-purple-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-purple-800 flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                {compareMode ? 'Select 2 Drafts to Compare' : 'Saved Drafts'}
                {compareMode && selectedForCompare.length > 0 && (
                  <Badge className="bg-indigo-100 text-indigo-700">
                    {selectedForCompare.length}/2 selected
                  </Badge>
                )}
              </h4>
              <div className="flex gap-2">
                {compareMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleCompareMode}
                    className="text-slate-600 hover:bg-slate-100 text-xs h-7"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllDrafts}
                  className="text-red-600 hover:bg-red-50 text-xs h-7"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {savedDrafts.slice().reverse().map((draft) => {
                const isSelected = selectedForCompare.find(d => d.id === draft.id);
                return (
                  <div 
                    key={draft.id}
                    className={`p-3 bg-white rounded-lg border transition-colors cursor-pointer ${
                      compareMode 
                        ? isSelected 
                          ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200' 
                          : 'border-purple-100 hover:border-indigo-300'
                        : 'border-purple-100 hover:border-purple-300'
                    }`}
                    onClick={compareMode ? () => toggleDraftSelection(draft) : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {compareMode && (
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs text-indigo-600 font-medium">
                              {isSelected ? `Draft ${selectedForCompare.indexOf(draft) + 1}` : 'Click to select'}
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-slate-700 truncate font-medium">
                          {draft.clinicalNotes.substring(0, 60)}...
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">
                            {formatDraftDate(draft.savedAt)}
                          </span>
                          {draft.createdByName && (
                            <span className="text-xs text-slate-400">
                              by {draft.createdByName}
                            </span>
                          )}
                          {draft.aiResult?.parsed?.diagnoses?.[0] && (
                            <Badge className="text-xs bg-slate-100 text-slate-600">
                              {draft.aiResult.parsed.diagnoses[0].name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {!compareMode && (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => loadDraft(draft)}
                            className="h-7 px-2 text-purple-600 border-purple-200 hover:bg-purple-50"
                          >
                            Load
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteDraft(draft.id)}
                            className="h-7 px-2 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Compare Dialog */}
        <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-indigo-700">
                <ArrowLeftRight className="w-5 h-5" />
                Compare AI Consultations
              </DialogTitle>
            </DialogHeader>
            
            {selectedForCompare.length === 2 && (
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  {selectedForCompare.map((draft, idx) => (
                    <div key={draft.id} className="space-y-4">
                      {/* Header */}
                      <div className={`p-3 rounded-lg ${idx === 0 ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
                        <div className="flex items-center justify-between">
                          <Badge className={idx === 0 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                            Draft {idx + 1}
                          </Badge>
                          <span className="text-xs text-slate-500">{formatDraftDate(draft.savedAt)}</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => applyFromCompare(draft)}
                          className={`mt-2 w-full h-7 ${idx === 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                          Apply This Draft
                        </Button>
                      </div>

                      {/* Clinical Notes */}
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">Clinical Notes</h5>
                        <p className="text-sm text-slate-700">{draft.clinicalNotes}</p>
                      </div>

                      {/* SOAP Notes */}
                      {draft.aiResult?.parsed?.soap && (
                        <div className="p-3 rounded-lg bg-white border border-slate-200">
                          <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">SOAP Notes</h5>
                          <div className="space-y-2 text-sm">
                            {draft.aiResult.parsed.soap.subjective && (
                              <div>
                                <Badge className="bg-blue-100 text-blue-800 text-xs">S</Badge>
                                <p className="text-slate-600 mt-1">{draft.aiResult.parsed.soap.subjective}</p>
                              </div>
                            )}
                            {draft.aiResult.parsed.soap.objective && (
                              <div>
                                <Badge className="bg-green-100 text-green-800 text-xs">O</Badge>
                                <p className="text-slate-600 mt-1">{draft.aiResult.parsed.soap.objective}</p>
                              </div>
                            )}
                            {draft.aiResult.parsed.soap.assessment && (
                              <div>
                                <Badge className="bg-amber-100 text-amber-800 text-xs">A</Badge>
                                <p className="text-slate-600 mt-1">{draft.aiResult.parsed.soap.assessment}</p>
                              </div>
                            )}
                            {draft.aiResult.parsed.soap.plan && (
                              <div>
                                <Badge className="bg-purple-100 text-purple-800 text-xs">P</Badge>
                                <p className="text-slate-600 mt-1">{draft.aiResult.parsed.soap.plan}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Diagnoses */}
                      {draft.aiResult?.parsed?.diagnoses?.length > 0 && (
                        <div className="p-3 rounded-lg bg-white border border-slate-200">
                          <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">Diagnoses</h5>
                          <div className="space-y-2">
                            {draft.aiResult.parsed.diagnoses.map((dx, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <Badge variant="outline" className="font-mono text-xs shrink-0">{dx.icd10 || 'N/A'}</Badge>
                                <div>
                                  <span className="font-medium">{dx.name}</span>
                                  {dx.confidence && (
                                    <Badge className={`ml-2 text-xs ${
                                      dx.confidence === 'high' ? 'bg-green-100 text-green-700' :
                                      dx.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-700'
                                    }`}>{dx.confidence}</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Medications */}
                      {draft.aiResult?.parsed?.medications?.length > 0 && (
                        <div className="p-3 rounded-lg bg-white border border-slate-200">
                          <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">Medications</h5>
                          <div className="space-y-2">
                            {draft.aiResult.parsed.medications.map((med, i) => (
                              <div key={i} className="p-2 rounded bg-slate-50 text-sm">
                                <div className="font-medium">{med.name}</div>
                                <div className="text-slate-600 text-xs">
                                  {med.dose} • {med.frequency} • {med.duration}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button type="button" variant="outline" onClick={closeCompare}>
                Close Comparison
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
                type="button"
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
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(JSON.stringify(aiResult.parsed.soap, null, 2), 'soap')}
                          className="h-7 px-2"
                        >
                          {copied === 'soap' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                        <Button
                          type="button"
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
                        type="button"
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
