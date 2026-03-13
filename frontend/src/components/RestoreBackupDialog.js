import React, { useState, useRef } from 'react';
import { restoreAPI } from '../lib/api';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Upload, FileJson, Users, Stethoscope, AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../lib/utils';

const RestoreBackupDialog = ({ open, onOpenChange, onRestoreComplete }) => {
  const fileRef = useRef(null);
  const [backupData, setBackupData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [restoreType, setRestoreType] = useState('both');
  const [mode, setMode] = useState('merge');
  const [showConfirm, setShowConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setBackupData(null);
    setFileName('');
    setRestoreType('both');
    setMode('merge');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // Support both backup format {patients:[], visits:[]} and raw arrays
      const patients = Array.isArray(data) ? [] : (data.patients || []);
      const visits = Array.isArray(data) ? [] : (data.visits || []);
      if (patients.length === 0 && visits.length === 0) {
        toast.error('No patient or visit data found in this file');
        return;
      }
      setBackupData({ patients, visits, exportedAt: data.exportedAt });
      setFileName(file.name);
    } catch {
      toast.error('Invalid JSON file');
    }
  };

  const handleRestore = () => {
    if (mode === 'replace') {
      setShowConfirm(true);
    } else {
      executeRestore();
    }
  };

  const executeRestore = async () => {
    setShowConfirm(false);
    setRestoring(true);
    setResult(null);
    try {
      const payload = {
        patients: restoreType !== 'visits' ? backupData.patients : null,
        visits: restoreType !== 'patients' ? backupData.visits : null,
        mode,
        restore_type: restoreType,
      };
      const res = await restoreAPI.restore(payload);
      setResult(res.data);
      const r = res.data;
      const restored = r.patients_restored + r.visits_restored;
      if (restored > 0) {
        toast.success(`Restored ${r.patients_restored} patients and ${r.visits_restored} visits`);
      } else {
        toast.info('No new records were restored');
      }
      onRestoreComplete?.();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Restore failed'));
    } finally {
      setRestoring(false);
    }
  };

  const pCount = backupData?.patients?.length || 0;
  const vCount = backupData?.visits?.length || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-[#0F766E]" />
              Restore Backup
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Step 1: File Upload */}
            {!backupData && (
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#0F766E] hover:bg-[#0F766E]/5 transition-colors"
                onClick={() => fileRef.current?.click()}
                data-testid="restore-file-drop"
              >
                <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-700">Click to select a backup JSON file</p>
                <p className="text-xs text-slate-400 mt-1">Supports EMR_Backup files</p>
                <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} data-testid="restore-file-input" />
              </div>
            )}

            {/* Step 2: Preview & Options */}
            {backupData && !result && (
              <>
                {/* File Info */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <FileJson className="w-8 h-8 text-[#0F766E]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{fileName}</p>
                    {backupData.exportedAt && (
                      <p className="text-xs text-slate-500">Exported: {new Date(backupData.exportedAt).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{pCount} patients</Badge>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{vCount} visits</Badge>
                  </div>
                </div>

                {/* Restore Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">What to restore</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 'both', label: 'Both', icon: <CheckCircle2 className="w-4 h-4" />, disabled: false },
                      { val: 'patients', label: 'Patients', icon: <Users className="w-4 h-4" />, disabled: pCount === 0 },
                      { val: 'visits', label: 'Visits', icon: <Stethoscope className="w-4 h-4" />, disabled: vCount === 0 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        disabled={opt.disabled}
                        className={`p-3 rounded-lg border text-sm font-medium flex flex-col items-center gap-1 transition-colors ${
                          restoreType === opt.val
                            ? 'border-[#0F766E] bg-[#0F766E]/10 text-[#0F766E]'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => !opt.disabled && setRestoreType(opt.val)}
                        data-testid={`restore-type-${opt.val}`}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Restore mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        mode === 'merge'
                          ? 'border-[#0F766E] bg-[#0F766E]/10'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => setMode('merge')}
                      data-testid="restore-mode-merge"
                    >
                      <p className="text-sm font-medium text-slate-900">Merge</p>
                      <p className="text-xs text-slate-500 mt-0.5">Add new records, skip duplicates</p>
                    </button>
                    <button
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        mode === 'replace'
                          ? 'border-red-400 bg-red-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => setMode('replace')}
                      data-testid="restore-mode-replace"
                    >
                      <p className="text-sm font-medium text-slate-900">Replace</p>
                      <p className="text-xs text-red-500 mt-0.5">Delete existing, import from backup</p>
                    </button>
                  </div>
                </div>

                {mode === 'replace' && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">
                      <strong>Warning:</strong> Replace mode will permanently delete all your existing {restoreType === 'patients' ? 'patients and their visits' : restoreType === 'visits' ? 'visit records' : 'patients and visits'} before importing from the backup file.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={reset} data-testid="restore-change-file">
                    Change File
                  </Button>
                  <Button
                    className={`flex-1 ${mode === 'replace' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0F766E] hover:bg-[#115E59]'}`}
                    onClick={handleRestore}
                    disabled={restoring}
                    data-testid="restore-submit-btn"
                  >
                    {restoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                    {restoring ? 'Restoring...' : `Restore (${mode})`}
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Result */}
            {result && (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${result.errors.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className={`w-5 h-5 ${result.errors.length > 0 ? 'text-amber-600' : 'text-green-600'}`} />
                    <span className="font-medium text-slate-900">Restore Complete</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {(restoreType === 'patients' || restoreType === 'both') && (
                      <div className="space-y-1">
                        <p className="font-medium text-slate-700">Patients</p>
                        <p className="text-green-700">Restored: {result.patients_restored}</p>
                        {result.patients_skipped > 0 && <p className="text-slate-500">Skipped (duplicate): {result.patients_skipped}</p>}
                        {result.patients_failed > 0 && <p className="text-red-600">Failed: {result.patients_failed}</p>}
                        {result.patients_deleted > 0 && <p className="text-amber-600">Deleted (replaced): {result.patients_deleted}</p>}
                      </div>
                    )}
                    {(restoreType === 'visits' || restoreType === 'both') && (
                      <div className="space-y-1">
                        <p className="font-medium text-slate-700">Visits</p>
                        <p className="text-green-700">Restored: {result.visits_restored}</p>
                        {result.visits_skipped > 0 && <p className="text-slate-500">Skipped: {result.visits_skipped}</p>}
                        {result.visits_failed > 0 && <p className="text-red-600">Failed: {result.visits_failed}</p>}
                        {result.visits_deleted > 0 && <p className="text-amber-600">Deleted (replaced): {result.visits_deleted}</p>}
                      </div>
                    )}
                  </div>
                </div>
                {result.warnings.length > 0 && (
                  <div className="max-h-32 overflow-y-auto text-xs text-amber-600 space-y-0.5">
                    {result.warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto text-xs text-red-600 space-y-0.5">
                    {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                  </div>
                )}
                <Button className="w-full bg-[#0F766E] hover:bg-[#115E59]" onClick={() => { reset(); onOpenChange(false); }} data-testid="restore-done-btn">
                  Done
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Replace Confirmation */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Confirm Replace
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently delete</strong> all your existing {restoreType === 'patients' ? 'patients (and their visits, prescriptions, certificates)' : restoreType === 'visits' ? 'visit records' : 'patients and all related data'}, then import {restoreType === 'patients' ? `${pCount} patients` : restoreType === 'visits' ? `${vCount} visits` : `${pCount} patients and ${vCount} visits`} from the backup file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="restore-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={executeRestore} data-testid="restore-confirm-yes">
              Yes, Replace All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RestoreBackupDialog;
