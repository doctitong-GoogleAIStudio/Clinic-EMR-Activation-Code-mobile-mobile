import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLicense } from '../context/LicenseContext';
import { getTrialRemaining } from '../lib/licenseManager';
import { Button } from './ui/button';
import { Clock, Sparkles } from 'lucide-react';

const Unit = ({ value, label }) => (
  <div className="flex flex-col items-center">
    <span className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums" data-testid={`trial-card-${label.toLowerCase()}`}>
      {String(value).padStart(2, '0')}
    </span>
    <span className="text-[10px] uppercase tracking-wider text-white/60">{label}</span>
  </div>
);

const TrialStatusCard = () => {
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

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F766E] to-[#134E4A] p-5 sm:p-6 shadow-lg"
      data-testid="trial-status-card"
    >
      <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[#5EEAD4]">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Free Trial Active</span>
          </div>
          <p className="text-white/80 text-sm max-w-sm">
            Enjoy full access. Activate anytime to keep your data after the trial ends.
          </p>
        </div>

        <div className="flex items-end gap-4">
          <div className="flex items-center gap-3">
            <Unit value={remaining.days} label="Days" />
            <span className="text-white/40 text-xl font-bold pb-4">:</span>
            <Unit value={remaining.hours} label="Hrs" />
            <span className="text-white/40 text-xl font-bold pb-4">:</span>
            <Unit value={remaining.minutes} label="Min" />
            <span className="text-white/40 text-xl font-bold pb-4">:</span>
            <Unit value={remaining.seconds} label="Sec" />
          </div>
        </div>
      </div>

      <div className="relative mt-5">
        <Button
          onClick={() => navigate('/activate')}
          className="bg-white text-[#0F766E] hover:bg-white/90 font-semibold shadow"
          data-testid="trial-card-activate-btn"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Activate Full Version
        </Button>
      </div>
    </div>
  );
};

export default TrialStatusCard;
