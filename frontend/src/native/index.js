// Native bridges for the Capacitor (Android) build.
//
// Android WebView silently ignores `<a download>` clicks on blob:/data: URLs,
// cannot open a blob: URL in a new tab, and treats `window.print()` as a no-op.
// Everything in this file is a no-op on the regular web build.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const isNative = Capacitor.isNativePlatform();

// Implemented in android/app/src/main/java/com/ddhapps/clinicemr/NativePrintPlugin.java
const NativePrint = registerPlugin('NativePrint');

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(blob);
  });

// Write the blob to the app cache and hand it to the Android share sheet so the
// user can save it (Files, Drive, ...) or open it in another app (PDF viewer, ...).
export const saveAndShare = async (href, filename) => {
  const blob = await (await fetch(href)).blob();
  const name = (filename || `file-${Date.now()}`).replace(/[\\/:*?"<>|]+/g, '_');
  const { uri } = await Filesystem.writeFile({
    path: name,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  await Share.share({ title: name, url: uri, dialogTitle: name });
};

const isLocalUrl = (href) => /^(blob:|data:)/i.test(href || '');

export const printHtml = (html) => NativePrint.print({ html, name: 'Clinic EMR' });

export const installNativeBridges = () => {
  if (!isNative) return;

  // Programmatic `a.download = ...; a.click()` (exports, backups, attachments).
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function click() {
    if (this.hasAttribute('download') && isLocalUrl(this.href)) {
      saveAndShare(this.href, this.getAttribute('download')).catch((e) =>
        console.error('Native save failed:', e)
      );
      return undefined;
    }
    return originalClick.call(this);
  };

  // Real taps on rendered <a download> links.
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target?.closest?.('a[download]');
      if (a && isLocalUrl(a.href)) {
        e.preventDefault();
        saveAndShare(a.href, a.getAttribute('download')).catch((err) =>
          console.error('Native save failed:', err)
        );
      }
    },
    true
  );

  // `window.open(blobUrl, '_blank')` is used to view PDFs.
  const originalOpen = window.open.bind(window);
  window.open = (url, ...rest) => {
    if (isLocalUrl(url)) {
      saveAndShare(url, `document-${Date.now()}.pdf`).catch((e) =>
        console.error('Native open failed:', e)
      );
      return null;
    }
    return originalOpen(url, ...rest);
  };

  // Used by the print iframe (see components/PrintPreviewDialog.js).
  window.__nativePrint = (html) =>
    printHtml(html).catch((e) => console.error('Native print failed:', e));
};
