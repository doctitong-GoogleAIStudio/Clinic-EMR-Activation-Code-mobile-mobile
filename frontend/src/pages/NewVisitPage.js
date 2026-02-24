import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { patientAPI, visitAPI, appointmentAPI, aiAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { 
  ArrowLeft, Save, Activity, Stethoscope, Sparkles, 
  Thermometer, Heart, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const NewVisitPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const patientId = searchParams.get('patient');
  const appointmentId = searchParams.get('appointment');

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(null);
  
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
  }, [patientId]);

  const fetchPatient = async () => {
    try {
      const response = await patientAPI.getOne(patientId);
      setPatient(response.data);
    } catch (error) {
      toast.error('Failed to load patient');
      navigate('/patients');
    }
  };

  const calculateBMI = () => {
    const { weight, height } = formData.vitals;
    if (weight && height) {
      const heightM = parseFloat(height) / 100;
      const bmi = (parseFloat(weight) / (heightM * heightM)).toFixed(1);
      return bmi;
    }
    return null;
  };

  const handleAIAssist = async (type) => {
    setAiLoading(type);
    try {
      let text = '';
      if (type === 'soap_convert') {
        text = formData.soap_subjective || formData.soap_objective || 'Patient complains of...';
      } else if (type === 'diagnosis_suggest') {
        text = `${formData.soap_subjective}\n${formData.soap_objective}`;
      } else if (type === 'patient_instructions') {
        text = `${formData.soap_assessment}\n${formData.soap_plan}`;
      }

      const response = await aiAPI.assist({ text, request_type: type });
      
      if (type === 'soap_convert') {
        // Parse SOAP sections from response
        const result = response.data.result;
        toast.success('AI generated SOAP notes');
        // You could parse and fill in the SOAP fields here
        setFormData(prev => ({
          ...prev,
          soap_subjective: result.includes('S:') ? result : prev.soap_subjective
        }));
      } else if (type === 'diagnosis_suggest') {
        setFormData(prev => ({ ...prev, soap_assessment: response.data.result }));
        toast.success('AI suggested diagnoses');
      } else if (type === 'patient_instructions') {
        setFormData(prev => ({ ...prev, patient_instructions: response.data.result }));
        toast.success('AI generated patient instructions');
      }
    } catch (error) {
      toast.error('AI assist failed. Please try again.');
    } finally {
      setAiLoading(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Clean up vitals - convert strings to numbers where needed
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
      
      // Update appointment status if came from queue
      if (appointmentId) {
        await appointmentAPI.update(appointmentId, { status: 'done' });
      }

      toast.success('Visit recorded successfully');
      navigate(`/visits/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save visit');
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

        {/* SOAP Notes */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-[#0F766E]" />
                SOAP Notes
              </CardTitle>
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
    </div>
  );
};

export default NewVisitPage;
