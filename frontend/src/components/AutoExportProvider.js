import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { setupBeforeUnloadExport, performSilentBackup } from '../utils/autoExport';
import { toast } from 'sonner';

const AUTO_EXPORT_KEY = 'emr_last_auto_export';

const AutoExportProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const hasShownReminder = useRef(false);
  const cleanupRef = useRef(null);

  // Show backup reminder on login if last backup was > 24 hours ago
  useEffect(() => {
    if (isAuthenticated && !hasShownReminder.current) {
      hasShownReminder.current = true;
      const lastExport = parseInt(localStorage.getItem(AUTO_EXPORT_KEY) || '0', 10);
      const hoursSince = (Date.now() - lastExport) / (1000 * 60 * 60);

      if (lastExport === 0 || hoursSince > 72) {
        const msg = lastExport === 0
          ? "You haven't backed up your data yet."
          : `Last backup was ${Math.floor(hoursSince)} hours ago.`;

        setTimeout(() => {
          toast.info(msg, {
            description: 'Use the Backup button on your dashboard to download your data.',
            duration: 8000,
          });
        }, 2000);
      }
    }
  }, [isAuthenticated]);

  // Reset on logout
  useEffect(() => {
    if (!isAuthenticated) {
      hasShownReminder.current = false;
    }
  }, [isAuthenticated]);

  // Setup beforeunload silent backup + periodic silent backup
  useEffect(() => {
    if (isAuthenticated) {
      cleanupRef.current = setupBeforeUnloadExport();
      const intervalId = setInterval(() => performSilentBackup(), 5 * 60 * 1000);
      return () => {
        if (cleanupRef.current) cleanupRef.current();
        clearInterval(intervalId);
      };
    }
  }, [isAuthenticated]);

  return <>{children}</>;
};

export default AutoExportProvider;
