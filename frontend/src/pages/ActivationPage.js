import React, { useState } from 'react';
import { useLicense } from '../context/LicenseContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Stethoscope, Shield, Copy, Check, Key, Wifi, WifiOff, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const ActivationPage = () => {
  const { deviceId, activate, activateOffline, licenseStatus } = useLicense();
  const [code, setCode] = useState('');
  const [offlineKey, setOfflineKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showOffline, setShowOffline] = useState(false);

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

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');

    try {
      await activate(code.trim().toUpperCase());
      toast.success('Device activated successfully!');
    } catch (err) {
      setError(err.message);
      toast.error('Activation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineActivate = async (e) => {
    e.preventDefault();
    if (!offlineKey.trim()) return;
    setLoading(true);
    setError('');

    try {
      await activateOffline(offlineKey.trim());
      toast.success('Device activated (offline)!');
    } catch (err) {
      setError(err.message);
      toast.error('Offline activation failed');
    } finally {
      setLoading(false);
    }
  };

  const isExpired = licenseStatus?.status === 'expired';
  const isRevoked = licenseStatus?.status === 'revoked';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0F766E] shadow-lg shadow-[#0F766E]/30">
            <Stethoscope className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Private Clinic EMR</h1>
          <p className="text-slate-400 text-sm">Device Activation Required</p>
        </div>

        {/* Status banner for expired/revoked */}
        {(isExpired || isRevoked) && (
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${isRevoked ? 'bg-red-950/40 border-red-800/50 text-red-300' : 'bg-amber-950/40 border-amber-800/50 text-amber-300'}`}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm">
              {isRevoked
                ? 'This license has been revoked. Contact your administrator for a new activation code.'
                : 'Your license has expired and the grace period has ended. Please enter a new activation code.'
              }
            </div>
          </div>
        )}

        {/* Device ID Card */}
        <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-xl shadow-2xl" data-testid="device-id-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="w-4 h-4 text-[#0F766E]" />
              <CardTitle className="text-base text-slate-200">Your Device ID</CardTitle>
            </div>
            <CardDescription className="text-slate-500 text-xs">
              Send this ID to your administrator to receive an activation code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 bg-slate-900/80 border border-slate-600/50 rounded-lg px-4 py-3 font-mono text-lg text-[#5EEAD4] tracking-wider text-center select-all"
                data-testid="device-id-display"
              >
                {deviceId || 'Generating...'}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyDeviceId}
                className="border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-300 h-12 w-12"
                data-testid="copy-device-id-btn"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Online Activation */}
        <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-xl shadow-2xl" data-testid="activation-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Wifi className="w-4 h-4 text-blue-400" />
              <CardTitle className="text-base text-slate-200">Enter Activation Code</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleActivate} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-slate-400 text-xs">Activation Code</Label>
                <Input
                  placeholder="DDH-XXXX-XXXX-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="h-12 bg-slate-900/80 border-slate-600/50 text-white font-mono text-center tracking-wider placeholder:text-slate-600 focus:border-[#0F766E] focus:ring-[#0F766E]"
                  data-testid="activation-code-input"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full h-11 bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold shadow-lg shadow-[#0F766E]/20 transition-all"
                data-testid="activate-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Activating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Activate Device
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Offline Activation Toggle */}
        <div className="space-y-3">
          <button
            onClick={() => setShowOffline(!showOffline)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-700/50 bg-slate-800/40 text-slate-400 hover:text-slate-300 text-sm transition-colors"
            data-testid="offline-toggle-btn"
          >
            <span className="flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              Offline Activation
            </span>
            {showOffline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showOffline && (
            <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-xl" data-testid="offline-card">
              <CardContent className="pt-5">
                <form onSubmit={handleOfflineActivate} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">Paste Offline License Key</Label>
                    <textarea
                      placeholder="Paste the offline license key provided by your administrator..."
                      value={offlineKey}
                      onChange={(e) => setOfflineKey(e.target.value)}
                      className="w-full h-24 bg-slate-900/80 border border-slate-600/50 rounded-lg px-3 py-2 text-white font-mono text-xs resize-none placeholder:text-slate-600 focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] focus:outline-none"
                      data-testid="offline-key-input"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading || !offlineKey.trim()}
                    variant="outline"
                    className="w-full border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-200"
                    data-testid="offline-activate-btn"
                  >
                    Activate Offline
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-slate-600 text-xs">
            Contact your system administrator for activation codes
          </p>
          <p className="text-slate-700 text-xs">
            DDH Apps &middot; Private Clinic EMR v2.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default ActivationPage;
