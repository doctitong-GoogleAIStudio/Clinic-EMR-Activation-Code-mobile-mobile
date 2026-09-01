import React, { useState } from 'react';
import { useLicense } from '../context/LicenseContext';
import TrialSignupPage from '../pages/TrialSignupPage';
import ActivationPage from '../pages/ActivationPage';

// Decides which gate screen to show when the device is not activated.
const UnactivatedGate = () => {
  const { trialEligible } = useLicense();
  const [mode, setMode] = useState(trialEligible ? 'trial' : 'activate');

  if (mode === 'trial') {
    return <TrialSignupPage onActivateInstead={() => setMode('activate')} />;
  }
  return (
    <ActivationPage onTrialInstead={trialEligible ? () => setMode('trial') : null} />
  );
};

export default UnactivatedGate;
