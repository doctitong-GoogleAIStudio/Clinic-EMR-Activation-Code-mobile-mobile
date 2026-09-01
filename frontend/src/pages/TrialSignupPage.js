import React, { useState } from 'react';
import { useLicense } from '../context/LicenseContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Stethoscope, Shield, Copy, Check, Mail, Sparkles, Clock, KeyRound, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const TrialSignupPage = ({ onActivateInstead }) => {
  const { deviceId, startTrial } = useLicense();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const copyDeviceId = async () => {
    if (!deviceId) return;
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopied(true);
      toast.success('Device ID copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const sendDeviceId = () => {
    if (!deviceId) return;
    const from = email.trim();
    const body = `Hello,%0A%0AHere is my Device ID for the Private Clinic EMR trial.%0A%0ADevice ID: ${deviceId}%0ARegistered Email: ${from || '(not provided)'}%0AApp: Private Clinic EMR%0A%0AThank you.`;
    window.location.href = `mailto:docvincent2022@yahoo.com?subject=Device ID - ${deviceId}&body=${body}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) return setError('Please enter your full name.');
    if (!emailValid) return setError('Please enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      await startTrial(fullName.trim(), email.trim(), password);
      toast.success('Your 7-day free trial has started!');
    } catch (err) {
      setError(err.message);
      toast.error('Could not start trial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6 py-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0F766E] shadow-lg shadow-[#0F766E]/30">
            <Stethoscope className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Private Clinic EMR</h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F766E]/20 border border-[#0F766E]/40">
            <Sparkles className="w-3.5 h-3.5 text-[#5EEAD4]" />
            <span className="text-[#5EEAD4] text-xs font-medium">Start your free 7-day trial</span>
          </div>
        </div>

        {/* Trial Sign-up Card */}
        <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-xl shadow-2xl" data-testid="trial-signup-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-[#5EEAD4]" />
              <CardTitle className="text-base text-slate-200">Create your trial account</CardTitle>
            </div>
            <CardDescription className="text-slate-500 text-xs">
              Full access for 7 days. No activation code needed to begin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
              {error && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-sm flex items-center gap-2" data-testid="trial-error">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-slate-400 text-xs">Full Name</Label>
                <Input
                  placeholder="Dr. Juan Dela Cruz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="off"
                  className="h-11 bg-slate-900/80 border-slate-600/50 text-white placeholder:text-slate-600 focus:border-[#0F766E] focus:ring-[#0F766E]"
                  data-testid="trial-fullname-input"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-400 text-xs">Email Address</Label>
                <Input
                  type="email"
                  placeholder="you@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  className="h-11 bg-slate-900/80 border-slate-600/50 text-white placeholder:text-slate-600 focus:border-[#0F766E] focus:ring-[#0F766E]"
                  data-testid="trial-email-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs">Password</Label>
                  <Input
                    type="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="h-11 bg-slate-900/80 border-slate-600/50 text-white placeholder:text-slate-600 focus:border-[#0F766E] focus:ring-[#0F766E]"
                    data-testid="trial-password-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs">Confirm Password</Label>
                  <Input
                    type="password"
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="h-11 bg-slate-900/80 border-slate-600/50 text-white placeholder:text-slate-600 focus:border-[#0F766E] focus:ring-[#0F766E]"
                    data-testid="trial-confirm-input"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold shadow-lg shadow-[#0F766E]/20 transition-all"
                data-testid="start-trial-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting your trial...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Start 7-Day Free Trial
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Device ID Card */}
        <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-xl shadow-2xl" data-testid="trial-device-id-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="w-4 h-4 text-[#0F766E]" />
              <CardTitle className="text-base text-slate-200">Your Device ID</CardTitle>
            </div>
            <CardDescription className="text-slate-500 text-xs">
              This ID is unique to this device. Send it to your administrator when you're ready to buy a full license.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 bg-slate-900/80 border border-slate-600/50 rounded-lg px-4 py-3 font-mono text-lg text-[#5EEAD4] tracking-wider text-center select-all"
                data-testid="trial-device-id-display"
              >
                {deviceId || 'Generating...'}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyDeviceId}
                className="border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-300 h-12 w-12"
                data-testid="trial-copy-device-id-btn"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            {deviceId && (
              <Button
                variant="outline"
                className="w-full mt-3 border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-300"
                onClick={sendDeviceId}
                data-testid="trial-send-device-id-btn"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Device ID to Admin
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Already have a code */}
        <button
          onClick={onActivateInstead}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-700/50 bg-slate-800/40 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          data-testid="have-code-btn"
        >
          <KeyRound className="w-4 h-4" />
          I already have an activation code
        </button>

        <p className="text-center text-slate-700 text-xs">
          DDH Apps &middot; Private Clinic EMR v2.0
        </p>
      </div>
    </div>
  );
};

export default TrialSignupPage;
