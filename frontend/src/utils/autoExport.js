import { exportAPI } from '../lib/api';

// Auto-export utility for automatic data backup
const AUTO_EXPORT_KEY = 'emr_last_auto_export';
const EXPORT_INTERVAL_MS = 5 * 60 * 1000; // Minimum 5 minutes between auto-exports

// Get timestamp of last auto-export
const getLastExportTime = () => {
  try {
    return parseInt(localStorage.getItem(AUTO_EXPORT_KEY) || '0', 10);
  } catch {
    return 0;
  }
};

// Set timestamp of last auto-export
const setLastExportTime = () => {
  localStorage.setItem(AUTO_EXPORT_KEY, Date.now().toString());
};

// Check if enough time has passed since last export
const shouldExport = () => {
  const lastExport = getLastExportTime();
  return Date.now() - lastExport > EXPORT_INTERVAL_MS;
};

// Download JSON data as file
const downloadJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Generate filename with timestamp
const generateFilename = (type) => {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
  return `emr_backup_${type}_${date}_${time}.json`;
};

// Export patients data
export const exportPatients = async () => {
  try {
    const response = await exportAPI.patients();
    return response.data;
  } catch (error) {
    console.error('Failed to export patients:', error);
    return null;
  }
};

// Export visits data
export const exportVisits = async () => {
  try {
    const response = await exportAPI.visits({});
    return response.data;
  } catch (error) {
    console.error('Failed to export visits:', error);
    return null;
  }
};

// Perform auto-export (downloads both patients and visits)
export const performAutoExport = async (showNotification = true) => {
  if (!shouldExport()) {
    console.log('Auto-export skipped: too soon since last export');
    return false;
  }

  try {
    console.log('Starting auto-export...');
    
    // Export patients
    const patients = await exportPatients();
    if (patients && patients.length > 0) {
      downloadJSON(patients, generateFilename('patients'));
      console.log(`Auto-exported ${patients.length} patients`);
    }

    // Export visits
    const visits = await exportVisits();
    if (visits && visits.length > 0) {
      downloadJSON(visits, generateFilename('visits'));
      console.log(`Auto-exported ${visits.length} visits`);
    }

    setLastExportTime();
    
    if (showNotification && (patients?.length > 0 || visits?.length > 0)) {
      // Return info for toast notification
      return {
        success: true,
        patients: patients?.length || 0,
        visits: visits?.length || 0
      };
    }
    
    return { success: true, patients: 0, visits: 0 };
  } catch (error) {
    console.error('Auto-export failed:', error);
    return { success: false, error };
  }
};

// Silent export (stores in localStorage as backup, no download)
export const performSilentBackup = async () => {
  try {
    const patients = await exportPatients();
    const visits = await exportVisits();
    
    if (patients || visits) {
      const backup = {
        timestamp: new Date().toISOString(),
        patients: patients || [],
        visits: visits || []
      };
      
      // Store in localStorage (limited size, but good for small datasets)
      try {
        localStorage.setItem('emr_backup_data', JSON.stringify(backup));
        console.log('Silent backup saved to localStorage');
      } catch (e) {
        // localStorage might be full, try sessionStorage
        try {
          sessionStorage.setItem('emr_backup_data', JSON.stringify(backup));
          console.log('Silent backup saved to sessionStorage');
        } catch {
          console.warn('Could not save backup to storage');
        }
      }
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Silent backup failed:', error);
    return false;
  }
};

// Setup beforeunload handler for export on close
export const setupBeforeUnloadExport = () => {
  const handleBeforeUnload = (event) => {
    // Perform silent backup before unload
    performSilentBackup();
    
    // Note: Modern browsers don't allow custom messages or downloads in beforeunload
    // The silent backup to localStorage is the best we can do
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
};

// Export all data immediately (for manual trigger)
export const exportAllDataNow = async () => {
  try {
    const patients = await exportPatients();
    const visits = await exportVisits();
    
    const allData = {
      exportedAt: new Date().toISOString(),
      patients: patients || [],
      visits: visits || []
    };
    
    downloadJSON(allData, generateFilename('full_backup'));
    
    return {
      success: true,
      patients: patients?.length || 0,
      visits: visits?.length || 0
    };
  } catch (error) {
    console.error('Full export failed:', error);
    return { success: false, error };
  }
};

export default {
  performAutoExport,
  performSilentBackup,
  setupBeforeUnloadExport,
  exportAllDataNow,
  exportPatients,
  exportVisits
};
