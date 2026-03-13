import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { setupBeforeUnloadExport, performSilentBackup } from '../utils/autoExport';
import { toast } from 'sonner';

const AutoExportProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const hasExportedOnLogin = useRef(false);
  const cleanupRef = useRef(null);

  // Auto-export on login
  useEffect(() => {
    if (isAuthenticated && user && !hasExportedOnLogin.current) {
      hasExportedOnLogin.current = true;
      
      // Delay the export slightly to ensure the app is fully loaded
      const timer = setTimeout(async () => {
        console.log('Performing auto-export on login...');
        
        try {
          // Always export on login (bypass interval check)
          const { exportPatients, exportVisits } = await import('../utils/autoExport');
          
          const patients = await exportPatients();
          const visits = await exportVisits();
          
          if ((patients && patients.length > 0) || (visits && visits.length > 0)) {
            // Create combined backup file
            const backup = {
              exportedAt: new Date().toISOString(),
              exportType: 'auto_login_backup',
              patients: patients || [],
              visits: visits || []
            };
            
            // Download the backup
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            link.href = url;
            link.download = `emr_auto_backup_${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            toast.success(`Auto-backup complete: ${patients?.length || 0} patients, ${visits?.length || 0} visits`, {
              duration: 5000,
              description: 'Your data has been automatically backed up'
            });
          }
        } catch (error) {
          console.error('Auto-export failed:', error);
        }
      }, 3000); // Wait 3 seconds after login

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user]);

  // Reset flag on logout
  useEffect(() => {
    if (!isAuthenticated) {
      hasExportedOnLogin.current = false;
    }
  }, [isAuthenticated]);

  // Setup beforeunload handler
  useEffect(() => {
    if (isAuthenticated) {
      // Setup the beforeunload handler
      cleanupRef.current = setupBeforeUnloadExport();

      // Also perform silent backup periodically (every 5 minutes)
      const intervalId = setInterval(() => {
        console.log('Performing periodic silent backup...');
        performSilentBackup();
      }, 5 * 60 * 1000);

      return () => {
        if (cleanupRef.current) {
          cleanupRef.current();
        }
        clearInterval(intervalId);
      };
    }
  }, [isAuthenticated]);

  // Handle visibility change (when user switches tabs or minimizes)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User is leaving the page/tab - do a silent backup
        console.log('Page hidden - performing silent backup...');
        performSilentBackup();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);

  return <>{children}</>;
};

export default AutoExportProvider;
