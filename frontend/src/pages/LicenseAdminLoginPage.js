import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Shield, LogIn, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = typeof window !== 'undefined'
  ? `${window.location.origin}/api`
  : '/api';

const LicenseAdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const resp = await axios.post(`${API}/license/admin/login`, { email, password });
      const { token } = resp.data;
      localStorage.setItem('ddh_admin_token', token);
      toast.success('Super Admin authenticated');
      navigate('/license-admin');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Invalid credentials';
      setError(msg);
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-700/50 bg-slate-800/60 backdrop-blur-xl shadow-2xl" data-testid="admin-login-card">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-600 shadow-lg shadow-amber-600/30 mx-auto">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">License Admin</CardTitle>
          <CardDescription className="text-slate-400">
            DDH License Management Portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 flex items-center gap-2 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <Input
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-slate-900/80 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500"
                data-testid="admin-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Password</Label>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 bg-slate-900/80 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500"
                data-testid="admin-password-input"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-lg shadow-amber-600/20"
              data-testid="admin-login-btn"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign In
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LicenseAdminLoginPage;
