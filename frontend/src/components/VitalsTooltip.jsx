import React from 'react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Activity, Heart, Thermometer, Droplets, Scale, Ruler } from 'lucide-react';

/**
 * VitalsTooltip - Displays a badge with vitals indicator and shows detailed vitals on hover
 * @param {Object} vitals - The vitals object containing bp_systolic, bp_diastolic, heart_rate, etc.
 * @param {string} variant - 'badge' for full badge, 'icon' for just the icon
 * @param {string} size - 'sm' or 'md'
 */
const VitalsTooltip = ({ vitals, variant = 'badge', size = 'sm', testId }) => {
  if (!vitals || Object.keys(vitals).length === 0) {
    return null;
  }

  const hasVitals = (key) => vitals[key] !== undefined && vitals[key] !== null;

  const tooltipContent = (
    <div className="space-y-2 min-w-[180px]">
      <div className="font-semibold text-white border-b border-white/20 pb-1 mb-2">
        Pre-recorded Vitals
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {(hasVitals('bp_systolic') || hasVitals('bp_diastolic')) && (
          <div className="flex items-center gap-1.5 col-span-2">
            <Heart className="w-3 h-3 text-red-300" />
            <span className="text-slate-300">BP:</span>
            <span className="font-medium text-white">
              {vitals.bp_systolic || '--'}/{vitals.bp_diastolic || '--'} mmHg
            </span>
          </div>
        )}
        {hasVitals('heart_rate') && (
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-pink-300" />
            <span className="text-slate-300">HR:</span>
            <span className="font-medium text-white">{vitals.heart_rate} bpm</span>
          </div>
        )}
        {hasVitals('respiratory_rate') && (
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-blue-300" />
            <span className="text-slate-300">RR:</span>
            <span className="font-medium text-white">{vitals.respiratory_rate} cpm</span>
          </div>
        )}
        {hasVitals('temperature') && (
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-3 h-3 text-orange-300" />
            <span className="text-slate-300">Temp:</span>
            <span className="font-medium text-white">{vitals.temperature}°C</span>
          </div>
        )}
        {hasVitals('spo2') && (
          <div className="flex items-center gap-1.5">
            <Droplets className="w-3 h-3 text-cyan-300" />
            <span className="text-slate-300">SpO2:</span>
            <span className="font-medium text-white">{vitals.spo2}%</span>
          </div>
        )}
        {hasVitals('weight') && (
          <div className="flex items-center gap-1.5">
            <Scale className="w-3 h-3 text-yellow-300" />
            <span className="text-slate-300">Wt:</span>
            <span className="font-medium text-white">{vitals.weight} kg</span>
          </div>
        )}
        {hasVitals('height') && (
          <div className="flex items-center gap-1.5">
            <Ruler className="w-3 h-3 text-green-300" />
            <span className="text-slate-300">Ht:</span>
            <span className="font-medium text-white">{vitals.height} cm</span>
          </div>
        )}
      </div>
    </div>
  );

  if (variant === 'icon') {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Activity 
              className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-emerald-600 cursor-help`}
              data-testid={testId}
            />
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="bg-slate-800 border-slate-700 p-3"
          >
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs gap-1 cursor-help hover:bg-emerald-200 transition-colors"
            data-testid={testId}
          >
            <Activity className="w-3 h-3" />
            {size === 'sm' ? 'Vitals' : 'Vitals Ready'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-slate-800 border-slate-700 p-3"
        >
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VitalsTooltip;
