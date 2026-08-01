import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Shield, LogOut, Plus, RefreshCw, Copy, Check,
  Monitor, Ban, RotateCcw, ArrowRightLeft, Calendar,
  Trash2, ChevronDown, ChevronUp, Key, Clock,
  CheckCircle, XCircle, AlertTriangle, Search, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = typeof window !== 'undefined'
  ? `${window.location.origin}/api`
  : '/api';

function getAdminAxios() {
  const token = localStorage.getItem('ddh_admin_token');
  return axios.create({
    headers: { Authorization: `Bearer ${token}` }
  });
}

const statusColors = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pending: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  revoked: 'bg-red-500/20 text-red-400 border-red-500/30',
  expired: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  grace_period: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
};

const typeLabels = {
  lifetime: 'Lifetime',
  yearly: '1 Year',
  trial: 'Trial',
  hospital: 'Hospital'
};

const LicenseAdminPage = () => {
  const navigate = useNavigate();
  const [licenses, setLicenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Generate form
  const [genForm, setGenForm] = useState({
    device_id: '',
    customer_name: '',
    customer_email: '',
    license_type: 'lifetime',
    trial_days: 30,
    trial_patient_limit: 100,
    notes: ''
  });
  const [generating, setGenerating] = useState(false);

  // Transfer/Extend modals
  const [transferTarget, setTransferTarget] = useState(null);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [extendTarget, setExtendTarget] = useState(null);
  const [extendDays, setExtendDays] = useState(365);

  const fetchData = useCallback(async () => {
    try {
      const api = getAdminAxios();
      const [licResp, statsResp] = await Promise.all([
        api.get(`${API}/license/admin/licenses`),
        api.get(`${API}/license/admin/stats`)
      ]);
      setLicenses(licResp.data.licenses);
      setStats(statsResp.data);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        localStorage.removeItem('ddh_admin_token');
        navigate('/license-admin/login');
        return;
      }
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem('ddh_admin_token');
    if (!token) {
      navigate('/license-admin/login');
      return;
    }
    fetchData();
  }, [fetchData, navigate]);

  const fetchAudit = async () => {
    try {
      const api = getAdminAxios();
      const resp = await api.get(`${API}/license/admin/audit`);
      setAuditLogs(resp.data.logs);
      setShowAudit(true);
    } catch {
      toast.error('Failed to load audit logs');
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!genForm.device_id.trim() || !genForm.customer_name.trim()) return;
    setGenerating(true);
    try {
      const api = getAdminAxios();
      const resp = await api.post(`${API}/license/admin/generate`, {
        device_id: genForm.device_id.trim().toUpperCase(),
        customer_name: genForm.customer_name.trim(),
        customer_email: genForm.customer_email.trim() || null,
        license_type: genForm.license_type,
        trial_days: genForm.license_type === 'trial' ? genForm.trial_days : undefined,
        trial_patient_limit: genForm.license_type === 'trial' ? genForm.trial_patient_limit : undefined,
        notes: genForm.notes.trim() || null,
        app_name: 'Private Clinic EMR'
      });
      setGeneratedResult(resp.data);
      toast.success('License generated!');
      fetchData();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to generate';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (lic) => {
    if (!window.confirm(`Revoke license for ${lic.customer_name}?`)) return;
    try {
      const api = getAdminAxios();
      await api.put(`${API}/license/admin/revoke/${lic.id}`);
      toast.success('License revoked');
      fetchData();
    } catch {
      toast.error('Failed to revoke');
    }
  };

  const handleReactivate = async (lic) => {
    try {
      const api = getAdminAxios();
      await api.put(`${API}/license/admin/reactivate/${lic.id}`);
      toast.success('License reactivated');
      fetchData();
    } catch {
      toast.error('Failed to reactivate');
    }
  };

  const handleDelete = async (lic) => {
    if (!window.confirm(`Permanently delete license for ${lic.customer_name}? This cannot be undone.`)) return;
    try {
      const api = getAdminAxios();
      await api.delete(`${API}/license/admin/licenses/${lic.id}`);
      toast.success('License deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget || !newDeviceId.trim()) return;
    try {
      const api = getAdminAxios();
      const resp = await api.put(`${API}/license/admin/transfer/${transferTarget.id}`, {
        new_device_id: newDeviceId.trim().toUpperCase()
      });
      toast.success(`Transferred! New code: ${resp.data.new_activation_code}`);
      setTransferTarget(null);
      setNewDeviceId('');
      fetchData();
    } catch {
      toast.error('Transfer failed');
    }
  };

  const handleExtend = async () => {
    if (!extendTarget || !extendDays) return;
    try {
      const api = getAdminAxios();
      await api.put(`${API}/license/admin/extend/${extendTarget.id}`, {
        additional_days: parseInt(extendDays)
      });
      toast.success('License extended');
      setExtendTarget(null);
      fetchData();
    } catch {
      toast.error('Extension failed');
    }
  };

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('ddh_admin_token');
    navigate('/license-admin/login');
  };

  const filtered = licenses.filter(l =>
    !search ||
    l.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.device_id?.toLowerCase().includes(search.toLowerCase()) ||
    l.customer_email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-800/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">DDH License Manager</h1>
              <p className="text-xs text-slate-400">Super Admin Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAudit}
              className="border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700"
              data-testid="view-audit-btn"
            >
              <FileText className="w-4 h-4 mr-1" />
              Audit Log
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700"
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-400 hover:text-white"
              data-testid="admin-logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="stats-grid">
            {[
              { label: 'Total', value: stats.total, color: 'text-slate-200' },
              { label: 'Active', value: stats.active, color: 'text-emerald-400' },
              { label: 'Pending', value: stats.pending, color: 'text-blue-400' },
              { label: 'Revoked', value: stats.revoked, color: 'text-red-400' },
              { label: 'Expired', value: stats.expired, color: 'text-amber-400' }
            ].map(s => (
              <Card key={s.label} className="border-slate-700/50 bg-slate-800/60">
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search by customer, device, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500"
              data-testid="search-input"
            />
          </div>
          <Button
            onClick={() => { setShowGenerate(!showGenerate); setGeneratedResult(null); }}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="generate-license-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate License
          </Button>
        </div>

        {/* Generate License Form */}
        {showGenerate && (
          <Card className="border-amber-600/30 bg-slate-800/80" data-testid="generate-form">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-amber-400 flex items-center gap-2">
                <Key className="w-5 h-5" />
                Generate New License
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!generatedResult ? (
                <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Device ID *</Label>
                    <Input
                      placeholder="DDH-XXXX-XXXX-XXXX-XXXX"
                      value={genForm.device_id}
                      onChange={(e) => setGenForm(f => ({ ...f, device_id: e.target.value.toUpperCase() }))}
                      required
                      className="bg-slate-900/80 border-slate-600/50 text-white font-mono"
                      data-testid="gen-device-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Customer Name *</Label>
                    <Input
                      placeholder="Dr. Santos"
                      value={genForm.customer_name}
                      onChange={(e) => setGenForm(f => ({ ...f, customer_name: e.target.value }))}
                      required
                      className="bg-slate-900/80 border-slate-600/50 text-white"
                      data-testid="gen-customer-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Customer Email</Label>
                    <Input
                      type="email"
                      placeholder="doctor@clinic.com"
                      value={genForm.customer_email}
                      onChange={(e) => setGenForm(f => ({ ...f, customer_email: e.target.value }))}
                      className="bg-slate-900/80 border-slate-600/50 text-white"
                      data-testid="gen-customer-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">License Type</Label>
                    <select
                      value={genForm.license_type}
                      onChange={(e) => setGenForm(f => ({ ...f, license_type: e.target.value }))}
                      className="w-full h-10 rounded-md bg-slate-900/80 border border-slate-600/50 text-white px-3 text-sm"
                      data-testid="gen-license-type"
                    >
                      <option value="lifetime">Lifetime</option>
                      <option value="yearly">1 Year</option>
                      <option value="trial">Trial</option>
                      <option value="hospital">Hospital</option>
                    </select>
                  </div>
                  {genForm.license_type === 'trial' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-slate-300 text-sm">Trial Days</Label>
                        <Input
                          type="number"
                          value={genForm.trial_days}
                          onChange={(e) => setGenForm(f => ({ ...f, trial_days: parseInt(e.target.value) || 30 }))}
                          className="bg-slate-900/80 border-slate-600/50 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300 text-sm">Patient Limit</Label>
                        <Input
                          type="number"
                          value={genForm.trial_patient_limit}
                          onChange={(e) => setGenForm(f => ({ ...f, trial_patient_limit: parseInt(e.target.value) || 100 }))}
                          className="bg-slate-900/80 border-slate-600/50 text-white"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-300 text-sm">Notes</Label>
                    <Input
                      placeholder="Optional notes..."
                      value={genForm.notes}
                      onChange={(e) => setGenForm(f => ({ ...f, notes: e.target.value }))}
                      className="bg-slate-900/80 border-slate-600/50 text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      type="submit"
                      disabled={generating}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      data-testid="gen-submit-btn"
                    >
                      {generating ? 'Generating...' : 'Generate Activation Code'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4" data-testid="generated-result">
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-700/40">
                    <p className="text-emerald-400 font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" /> License Generated Successfully
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
                        <div>
                          <p className="text-xs text-slate-500">Activation Code</p>
                          <p className="font-mono text-lg text-[#5EEAD4] tracking-wider">{generatedResult.activation_code}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(generatedResult.activation_code, 'code')}
                          className="text-slate-400 hover:text-white"
                        >
                          {copiedField === 'code' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
                        <div>
                          <p className="text-xs text-slate-500">Offline Key</p>
                          <p className="font-mono text-xs text-slate-400 break-all max-w-md">{generatedResult.offline_key?.slice(0, 60)}...</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(generatedResult.offline_key, 'offline')}
                          className="text-slate-400 hover:text-white"
                        >
                          {copiedField === 'offline' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => { setGeneratedResult(null); setGenForm({ device_id: '', customer_name: '', customer_email: '', license_type: 'lifetime', trial_days: 30, trial_patient_limit: 100, notes: '' }); }}
                    className="border-slate-600 text-slate-300"
                  >
                    Generate Another
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* License Table */}
        <Card className="border-slate-700/50 bg-slate-800/60 overflow-hidden" data-testid="license-table">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-200">
              All Licenses ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 text-xs">
                    <th className="text-left p-3 font-medium">Customer</th>
                    <th className="text-left p-3 font-medium">Device ID</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Activated</th>
                    <th className="text-left p-3 font-medium">Expiry</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        No licenses found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((lic) => {
                      const checkStatus = lic.check?.status || lic.status;
                      return (
                        <tr key={lic.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors" data-testid={`license-row-${lic.id}`}>
                          <td className="p-3">
                            <p className="text-slate-200 font-medium">{lic.customer_name}</p>
                            {lic.customer_email && <p className="text-slate-500 text-xs">{lic.customer_email}</p>}
                          </td>
                          <td className="p-3">
                            <span className="font-mono text-xs text-[#5EEAD4]">{lic.device_id}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-slate-300">{typeLabels[lic.license_type] || lic.license_type}</span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${statusColors[checkStatus] || statusColors.pending}`}>
                              {checkStatus === 'active' && <CheckCircle className="w-3 h-3" />}
                              {checkStatus === 'revoked' && <XCircle className="w-3 h-3" />}
                              {checkStatus === 'expired' && <AlertTriangle className="w-3 h-3" />}
                              {checkStatus === 'grace_period' && <AlertTriangle className="w-3 h-3" />}
                              {checkStatus === 'pending' && <Clock className="w-3 h-3" />}
                              {checkStatus}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 text-xs">
                            {lic.activated_at ? new Date(lic.activated_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="p-3 text-slate-400 text-xs">
                            {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyToClipboard(lic.activation_code, lic.id)}
                                title="Copy activation code"
                                className="h-8 w-8 text-slate-400 hover:text-white"
                              >
                                {copiedField === lic.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </Button>
                              {lic.status !== 'revoked' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRevoke(lic)}
                                  title="Revoke"
                                  className="h-8 w-8 text-slate-400 hover:text-red-400"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {lic.status === 'revoked' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleReactivate(lic)}
                                  title="Reactivate"
                                  className="h-8 w-8 text-slate-400 hover:text-emerald-400"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {(lic.license_type === 'yearly' || lic.license_type === 'trial') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setExtendTarget(lic)}
                                  title="Extend"
                                  className="h-8 w-8 text-slate-400 hover:text-blue-400"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setTransferTarget(lic); setNewDeviceId(''); }}
                                title="Transfer"
                                className="h-8 w-8 text-slate-400 hover:text-amber-400"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(lic)}
                                title="Delete"
                                className="h-8 w-8 text-slate-400 hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Transfer Modal */}
        {transferTarget && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="transfer-modal">
            <Card className="w-full max-w-md border-slate-700/50 bg-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-200 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                  Transfer License
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-400">
                  Transfer <strong className="text-slate-200">{transferTarget.customer_name}</strong>'s license to a new device
                </p>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">New Device ID</Label>
                  <Input
                    placeholder="DDH-XXXX-XXXX-XXXX-XXXX"
                    value={newDeviceId}
                    onChange={(e) => setNewDeviceId(e.target.value.toUpperCase())}
                    className="bg-slate-900/80 border-slate-600/50 text-white font-mono"
                    data-testid="transfer-device-id"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setTransferTarget(null)} className="border-slate-600 text-slate-300">Cancel</Button>
                  <Button onClick={handleTransfer} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="transfer-confirm-btn">Transfer</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Extend Modal */}
        {extendTarget && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="extend-modal">
            <Card className="w-full max-w-md border-slate-700/50 bg-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-200 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Extend License
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-400">
                  Extend <strong className="text-slate-200">{extendTarget.customer_name}</strong>'s license
                </p>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">Additional Days</Label>
                  <Input
                    type="number"
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                    className="bg-slate-900/80 border-slate-600/50 text-white"
                    data-testid="extend-days-input"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setExtendTarget(null)} className="border-slate-600 text-slate-300">Cancel</Button>
                  <Button onClick={handleExtend} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="extend-confirm-btn">Extend</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Audit Log */}
        {showAudit && (
          <Card className="border-slate-700/50 bg-slate-800/60" data-testid="audit-log">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Audit Log
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowAudit(false)} className="text-slate-400">
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <p className="text-center py-8 text-slate-500 text-sm">No audit logs</p>
                ) : (
                  <div className="divide-y divide-slate-700/30">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          log.action === 'activated' ? 'bg-emerald-500' :
                          log.action === 'revoked' ? 'bg-red-500' :
                          log.action === 'generated' ? 'bg-blue-500' :
                          'bg-amber-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-300">{log.details}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {new Date(log.timestamp).toLocaleString()} &middot; {log.action} &middot; {log.performed_by}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LicenseAdminPage;
