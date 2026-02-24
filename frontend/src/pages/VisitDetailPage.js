import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../context/AuthContext';
import { visitAPI, patientAPI, prescriptionAPI, certificateAPI, settingsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  ArrowLeft, Printer, Activity, FileText, Plus, Trash2,
  Pill, Award, Briefcase, Send
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
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [showViewRx, setShowViewRx] = useState(false);
  const [showViewCert, setShowViewCert] = useState(false);
  
  // Print refs
  const prescriptionRef = useRef();
  const medCertRef = useRef();
  const fitToWorkRef = useRef();
  const referralRef = useRef();
  const soapRef = useRef();
  const savedRxRef = useRef();
  const savedCertRef = useRef();
  
  // Form states
  const [showRx, setShowRx] = useState(false);
  const [showMedCert, setShowMedCert] = useState(false);
  const [showFitToWork, setShowFitToWork] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  
  const [rxData, setRxData] = useState({ medications: [{ name: '', dosage: '', frequency: '', duration: '' }], notes: '' });
  const [medCertData, setMedCertData] = useState({ diagnosis: '', start_date: '', end_date: '', remarks: '' });
  const [fitToWorkData, setFitToWorkData] = useState({ examined_date: '', fit_date: '', restrictions: '' });
  const [referralData, setReferralData] = useState({ to_doctor: '', to_specialty: '', reason: '', findings: '' });

  useEffect(() => {
    fetchData();
  }, [visitId]);

  const fetchData = async () => {
    try {
      const [visitRes, settingsRes, rxRes, certRes] = await Promise.all([
        visitAPI.getOne(visitId),
        settingsAPI.get(),
        prescriptionAPI.getAll({ visit_id: visitId }),
        certificateAPI.getAll({ visit_id: visitId })
      ]);
      setVisit(visitRes.data);
      setSettings(settingsRes.data);
      setSavedPrescriptions(rxRes.data);
      setSavedCertificates(certRes.data);
      
      const patientRes = await patientAPI.getOne(visitRes.data.patient_id);
      setPatient(patientRes.data);
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
      handlePrintRx();
      setShowRx(false);
      fetchData(); // Refresh to show saved form
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
      if (type === 'medical_certificate') handlePrintMedCert();
      else if (type === 'fit_to_work') handlePrintFitToWork();
      else if (type === 'referral') handlePrintReferral();
      setShowMedCert(false);
      setShowFitToWork(false);
      setShowReferral(false);
      fetchData(); // Refresh to show saved form
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
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0F766E]" />
                SOAP Notes
              </CardTitle>
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
              </CardContent>
            </Card>

            {/* Saved Forms Section */}
            {(savedPrescriptions.length > 0 || savedCertificates.length > 0) && (
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
                      className="p-3 rounded-lg border border-slate-200 hover:border-[#0F766E]/30 transition-colors"
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
                          onClick={() => reprintPrescription(rx)}
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
                      className="p-3 rounded-lg border border-slate-200 hover:border-[#0F766E]/30 transition-colors"
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
                          onClick={() => reprintCertificate(cert)}
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
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

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
      </div>
    </div>
  );
};

export default VisitDetailPage;
