import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../lib/utils';

const NewPatientPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    birthdate: '',
    sex: 'male',
    address: '',
    mobile: '',
    email: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    allergies: [],
    chronic_conditions: []
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Clean up form data - convert empty strings to null for optional fields
      const cleanData = {
        ...formData,
        email: formData.email?.trim() || null,
        address: formData.address?.trim() || null,
        mobile: formData.mobile?.trim() || null,
        emergency_contact_name: formData.emergency_contact_name?.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone?.trim() || null,
      };
      const response = await patientAPI.create(cleanData);
      toast.success(`Patient ${response.data.full_name} registered successfully`);
      navigate(`/patients/${response.data.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to register patient'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="new-patient-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/patients')} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">New Patient</h1>
          <p className="text-slate-500 font-body">Register a new patient</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <User className="w-5 h-5 text-[#0F766E]" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Juan Dela Cruz"
                  required
                  data-testid="patient-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthdate">Birthdate *</Label>
                <Input
                  id="birthdate"
                  type="date"
                  value={formData.birthdate}
                  onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                  required
                  data-testid="patient-birthdate-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sex">Sex *</Label>
                <Select value={formData.sex} onValueChange={(v) => setFormData({ ...formData, sex: v })}>
                  <SelectTrigger id="sex" data-testid="patient-sex-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contact Info */}
            <div className="border-t pt-4">
              <h3 className="font-heading font-semibold text-slate-900 mb-3">Contact Information</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="09123456789"
                    data-testid="patient-mobile-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="patient@email.com"
                    data-testid="patient-email-input"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main St, City"
                    data-testid="patient-address-input"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="border-t pt-4">
              <h3 className="font-heading font-semibold text-slate-900 mb-3">Emergency Contact</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_name">Contact Name</Label>
                  <Input
                    id="emergency_name"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    placeholder="Maria Dela Cruz"
                    data-testid="patient-emergency-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_phone">Contact Phone</Label>
                  <Input
                    id="emergency_phone"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    placeholder="09123456789"
                    data-testid="patient-emergency-phone-input"
                  />
                </div>
              </div>
            </div>

            {/* Medical Info */}
            <div className="border-t pt-4">
              <h3 className="font-heading font-semibold text-slate-900 mb-3">Medical Information</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="allergies">Allergies</Label>
                  <Textarea
                    id="allergies"
                    value={formData.allergies.join(', ')}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                    })}
                    placeholder="Penicillin, Aspirin (separate with commas)"
                    rows={2}
                    data-testid="patient-allergies-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chronic">Chronic Conditions</Label>
                  <Textarea
                    id="chronic"
                    value={formData.chronic_conditions.join(', ')}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      chronic_conditions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                    })}
                    placeholder="Hypertension, Diabetes (separate with commas)"
                    rows={2}
                    data-testid="patient-chronic-input"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t pt-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate('/patients')}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-[#0F766E] hover:bg-[#115E59]"
                data-testid="save-patient-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Register Patient
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default NewPatientPage;
