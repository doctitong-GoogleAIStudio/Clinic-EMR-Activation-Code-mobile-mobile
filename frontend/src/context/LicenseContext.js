import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { generateDeviceId } from '../lib/deviceFingerprint';
import {
  getLicenseMeta,
  checkLicenseLocally,
  storeLicense,
  storeActivationCode,
  getStoredActivationCode,
  clearLicense,
  clearActivationCode
} from '../lib/licenseManager';
import axios from 'axios';

const LicenseContext = createContext(null);

const API = typeof window !== 'undefined'
  ? `${window.location.origin}/api`
  : '/api';

export const LicenseProvider = ({ children }) => {
  const [deviceId, setDeviceId] = useState(null);
  const [licenseStatus, setLicenseStatus] = useState(null); // null = loading
  const [licenseMeta, setLicenseMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initLicense();
  }, []);

  const initLicense = async () => {
    try {
      const id = await generateDeviceId();
      setDeviceId(id);

      const meta = getLicenseMeta();
      if (meta && meta.device_id === id) {
        // We have a stored license for this device
        const localCheck = checkLicenseLocally(meta);
        setLicenseMeta(meta);
        setLicenseStatus(localCheck);

        // Try online verification if internet available
        tryOnlineVerify(id, meta);
      } else {
        // No valid license
        setLicenseStatus({ isValid: false, status: 'no_license', message: 'Device not activated.' });
      }
    } catch (err) {
      console.error('License init error:', err);
      setLicenseStatus({ isValid: false, status: 'error', message: 'License check failed.' });
    } finally {
      setLoading(false);
    }
  };

  const tryOnlineVerify = async (id, meta) => {
    try {
      const storedCode = getStoredActivationCode();
      if (!storedCode) return;

      const formData = new FormData();
      formData.append('device_id', id);
      formData.append('signature', 'local');
      formData.append('signed_payload', JSON.stringify({ device_id: id }));

      const resp = await axios.post(`${API}/license/verify`, formData, { timeout: 5000 });
      if (resp.data && resp.data.status === 'revoked') {
        setLicenseStatus({ isValid: false, status: 'revoked', message: 'License has been revoked.' });
        clearLicense();
        clearActivationCode();
      }
    } catch {
      // Offline or server unreachable — local check is sufficient
    }
  };

  const activate = useCallback(async (activationCode) => {
    if (!deviceId) throw new Error('Device ID not ready');

    // Try online activation
    try {
      const resp = await axios.post(`${API}/license/activate`, {
        device_id: deviceId,
        activation_code: activationCode
      });

      const { license, check } = resp.data;

      await storeLicense(deviceId, activationCode, license);
      storeActivationCode(activationCode);
      setLicenseMeta({
        device_id: deviceId,
        license_type: license.license_type,
        customer_name: license.customer_name,
        expires_at: license.expires_at,
        activated_at: license.activated_at,
        app_name: license.app_name
      });
      setLicenseStatus({
        isValid: check.is_valid,
        status: check.status,
        inGracePeriod: check.in_grace_period,
        graceDaysRemaining: check.grace_days_remaining,
        message: check.message
      });

      return { success: true, license };
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Activation failed. Check code and try again.';
      throw new Error(msg);
    }
  }, [deviceId]);

  const activateOffline = useCallback(async (offlineKey) => {
    if (!deviceId) throw new Error('Device ID not ready');

    try {
      const formData = new FormData();
      formData.append('device_id', deviceId);
      formData.append('offline_key', offlineKey);

      const resp = await axios.post(`${API}/license/activate-offline`, formData);
      const { license, check } = resp.data;

      // For offline, use a derived code
      const fakeCode = `OFFLINE-${deviceId}`;
      await storeLicense(deviceId, fakeCode, license);
      storeActivationCode(fakeCode);
      setLicenseMeta({
        device_id: deviceId,
        license_type: license.license_type,
        customer_name: license.customer_name,
        expires_at: license.expires_at,
        activated_at: license.activated_at,
        app_name: license.app_name
      });
      setLicenseStatus({
        isValid: check.is_valid,
        status: check.status,
        inGracePeriod: check.in_grace_period,
        graceDaysRemaining: check.grace_days_remaining,
        message: check.message
      });

      return { success: true, license };
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Offline activation failed.';
      throw new Error(msg);
    }
  }, [deviceId]);

  const deactivate = useCallback(() => {
    clearLicense();
    clearActivationCode();
    setLicenseStatus({ isValid: false, status: 'no_license', message: 'Device deactivated.' });
    setLicenseMeta(null);
  }, []);

  const isActivated = licenseStatus?.isValid === true;
  const inGracePeriod = licenseStatus?.inGracePeriod === true;

  return (
    <LicenseContext.Provider value={{
      deviceId,
      licenseStatus,
      licenseMeta,
      loading,
      isActivated,
      inGracePeriod,
      activate,
      activateOffline,
      deactivate
    }}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within LicenseProvider');
  }
  return context;
};
