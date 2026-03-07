import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Stethoscope, UserPlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../lib/utils';

const SignUpPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'doctor',
    specialization: '',
    license_no: '',
    ptr_no: '',
    prc_no: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!formData.full_name.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!formData.email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...submitData } = formData;
      const response = await authAPI.register(submitData);
      
      // Auto-login after successful registration
      const { token, user } = response.data;
      loginWithToken(token, user);
      
      toast.success('Account created successfully! Welcome to Private Clinic EMR.');
      navigate('/');
    } catch (err) {
      const errorMsg = getErrorMessage(err, 'Registration failed. Please try again.');
      setError(errorMsg);
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#0F766E] flex items-center justify-center shadow-lg">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-heading font-bold text-slate-900">Create Account</CardTitle>
            <CardDescription className="font-body text-slate-500">
              Quick and simple registration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Dr. Juan Dela Cruz"
                  required
                  className="h-11 bg-white border-slate-200"
                  data-testid="signup-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="doctor@clinic.com"
                  required
                  className="h-11 bg-white border-slate-200"
                  data-testid="signup-email-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 6 characters"
                  required
                  className="h-11 bg-white border-slate-200"
                  data-testid="signup-password-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Repeat password"
                  required
                  className="h-11 bg-white border-slate-200"
                  data-testid="signup-confirm-password-input"
                />
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <p className="text-sm font-medium text-slate-700">Doctor Credentials (for printed forms)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">S2 No.</Label>
                    <Input
                      value={formData.license_no}
                      onChange={(e) => setFormData({ ...formData, license_no: e.target.value })}
                      placeholder="S2 No."
                      className="h-10 bg-white border-slate-200 text-sm"
                      data-testid="signup-license-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">PTR No.</Label>
                    <Input
                      value={formData.ptr_no}
                      onChange={(e) => setFormData({ ...formData, ptr_no: e.target.value })}
                      placeholder="PTR No."
                      className="h-10 bg-white border-slate-200 text-sm"
                      data-testid="signup-ptr-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">PRC No.</Label>
                    <Input
                      value={formData.prc_no}
                      onChange={(e) => setFormData({ ...formData, prc_no: e.target.value })}
                      placeholder="PRC No."
                      className="h-10 bg-white border-slate-200 text-sm"
                      data-testid="signup-prc-input"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#0F766E] hover:bg-[#115E59] text-white font-medium"
                data-testid="signup-submit-btn"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating Account...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Create Account
                  </div>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Already have an account?{' '}
                <Link to="/login" className="text-[#0F766E] hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignUpPage;
