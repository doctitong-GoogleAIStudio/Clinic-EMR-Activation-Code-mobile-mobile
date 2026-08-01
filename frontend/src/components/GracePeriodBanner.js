import React from 'react';
import { useLicense } from '../context/LicenseContext';
import { AlertTriangle } from 'lucide-react';

const GracePeriodBanner = () => {
  const { licenseStatus } = useLicense();

  if (!licenseStatus?.inGracePeriod) return null;

  return (
    <div
      className="bg-amber-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-[100]"
      data-testid="grace-period-banner"
    >
      <AlertTriangle className="w-4 h-4" />
      License expired! {licenseStatus.graceDaysRemaining} grace day{licenseStatus.graceDaysRemaining !== 1 ? 's' : ''} remaining. Contact your administrator to renew.
    </div>
  );
};

export default GracePeriodBanner;
