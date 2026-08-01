/**
 * DDH License Manager
 * Handles AES-256-GCM encrypted local license storage and verification.
 */

const LICENSE_STORAGE_KEY = 'ddh_license_encrypted';
const LICENSE_META_KEY = 'ddh_license_meta';

async function deriveKey(deviceId, activationCode) {
  const raw = `${deviceId}::${activationCode}::DDH-LICENSE-2026`;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(raw),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('DDH-SALT-2026'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    data: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

async function decryptData(key, encObj) {
  const iv = new Uint8Array(encObj.iv.match(/.{2}/g).map(h => parseInt(h, 16)));
  const data = new Uint8Array(encObj.data.match(/.{2}/g).map(h => parseInt(h, 16)));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export async function storeLicense(deviceId, activationCode, licenseData) {
  try {
    const key = await deriveKey(deviceId, activationCode);
    const encrypted = await encryptData(key, {
      ...licenseData,
      stored_at: new Date().toISOString()
    });
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(encrypted));
    // Store non-sensitive metadata for quick checks
    localStorage.setItem(LICENSE_META_KEY, JSON.stringify({
      device_id: deviceId,
      license_type: licenseData.license_type,
      customer_name: licenseData.customer_name,
      expires_at: licenseData.expires_at,
      activated_at: licenseData.activated_at,
      app_name: licenseData.app_name
    }));
    return true;
  } catch (err) {
    console.error('Failed to store license:', err);
    return false;
  }
}

export async function loadLicense(deviceId, activationCode) {
  try {
    const stored = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!stored) return null;
    const encObj = JSON.parse(stored);
    const key = await deriveKey(deviceId, activationCode);
    return await decryptData(key, encObj);
  } catch {
    return null;
  }
}

export function getLicenseMeta() {
  try {
    const meta = localStorage.getItem(LICENSE_META_KEY);
    return meta ? JSON.parse(meta) : null;
  } catch {
    return null;
  }
}

export function clearLicense() {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
  localStorage.removeItem(LICENSE_META_KEY);
}

export function getStoredActivationCode() {
  return localStorage.getItem('ddh_activation_code') || null;
}

export function storeActivationCode(code) {
  localStorage.setItem('ddh_activation_code', code);
}

export function clearActivationCode() {
  localStorage.removeItem('ddh_activation_code');
}

/**
 * Check license status locally (grace period logic).
 */
export function checkLicenseLocally(meta) {
  if (!meta) return { isValid: false, status: 'no_license', message: 'No license found.' };

  const { license_type, expires_at } = meta;

  if (license_type === 'lifetime' || license_type === 'hospital') {
    return { isValid: true, status: 'active', inGracePeriod: false, message: 'License active (Lifetime).' };
  }

  if (!expires_at) {
    return { isValid: true, status: 'active', inGracePeriod: false, message: 'License active.' };
  }

  const now = new Date();
  const exp = new Date(expires_at);
  const graceEnd = new Date(exp.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (now < exp) {
    const daysLeft = Math.ceil((exp - now) / (24 * 60 * 60 * 1000));
    return { isValid: true, status: 'active', inGracePeriod: false, daysLeft, message: `${daysLeft} days remaining.` };
  }

  if (now < graceEnd) {
    const graceDays = Math.ceil((graceEnd - now) / (24 * 60 * 60 * 1000));
    return { isValid: true, status: 'grace_period', inGracePeriod: true, graceDaysRemaining: graceDays, message: `License expired! ${graceDays} grace days left.` };
  }

  return { isValid: false, status: 'expired', message: 'License expired. Grace period ended.' };
}
