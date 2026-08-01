/**
 * DDH Device Fingerprint Module
 * Generates a stable, unique device identifier from browser/hardware characteristics.
 * Format: DDH-XXXX-XXXX-XXXX-XXXX
 */

const SEED_KEY = 'ddh_device_seed';

function getOrCreateSeed() {
  let seed = localStorage.getItem(SEED_KEY);
  if (!seed) {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    seed = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(SEED_KEY, seed);
  }
  return seed;
}

async function getWebGLRenderer() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';
    return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
  } catch {
    return 'error';
  }
}

function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('DDH-FP-2026', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('DDH-FP-2026', 4, 17);
    return canvas.toDataURL();
  } catch {
    return 'no-canvas';
  }
}

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function formatDeviceId(hex) {
  const h = hex.toUpperCase();
  return `DDH-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}`;
}

export async function generateDeviceId() {
  const seed = getOrCreateSeed();
  const gpu = await getWebGLRenderer();
  const canvasFp = getCanvasFingerprint();

  const components = [
    navigator.platform || 'unknown',
    navigator.userAgent || 'unknown',
    navigator.hardwareConcurrency || 0,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    navigator.language || 'unknown',
    gpu,
    canvasFp,
    seed
  ];

  const raw = components.join('|||');
  const hash = await sha256(raw);
  return formatDeviceId(hash.slice(0, 16));
}

export function getStoredSeed() {
  return localStorage.getItem(SEED_KEY);
}
