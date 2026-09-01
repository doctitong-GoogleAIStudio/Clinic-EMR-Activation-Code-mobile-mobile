import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLicense } from '../context/LicenseContext';
import { getTrialRemaining } from '../lib/licenseManager';
import { Clock, Sparkles } from 'lucide-react';

// Formats remaining time to minute granularity (adds seconds when < 1 hour).
function formatRemaining(r) {
  if (!r || r.expired) return 'Trial ended';
  if (r.days > 0) return `${r.days}d ${r.hours}h ${r.minutes}m`;
  if (r.hours > 0) return `${r.hours}h ${r.minutes}m`;
  return `${r.minutes}m ${r.seconds}s`;
}

const TrialBanner = () => {
  const { isActivated, isTrial, licenseMeta } = useLicense();
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(() =>
    getTrialRemaining(licenseMeta?.expires_at)
  );

  useEffect(() => {
    if (!isTrial || !licenseMeta?.expires_at) return;
    const tick = () => setRemaining(getTrialRemaining(licenseMeta.expires_at));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isTrial, licenseMeta?.expires_at]);

  if (!isActivated || !isTrial || !remaining || remaining.expired) return null;

  const urgent = remaining.days === 0;

  return (
    <div
      className={`w-full flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 px-4 py-2 text-sm ${
        urgent
          ? 'bg-amber-500 text-amber-950'
          : 'bg-[#0F766E] text-white'
      }`}
      data-testid="trial-banner"
    >
      <span className="flex items-center gap-2 font-medium">
        <Clock className="w-4 h-4" />
        Free Trial &middot; <span data-testid="trial-banner-countdown" className="font-mono tracking-wide">{formatRemaining(remaining)}</span> left
      </span>
      <button
        onClick={() => navigate('/activate')}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
          urgent
            ? 'bg-amber-950 text-amber-100 hover:bg-amber-900'
            : 'bg-white/20 hover:bg-white/30 text-white'
        }`}
        data-testid="trial-banner-activate-btn"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Activate Now
      </button>
    </div>
  );
};

export default TrialBanner;
