import React from 'react';
import { Flame, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

interface SeverityGradientBarProps {
  score: number; // 0 to 100
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  variant?: 'segmented' | 'dial';
}

export const SeverityGradientBar: React.FC<SeverityGradientBarProps> = ({
  score,
  label,
  size = 'md',
  showLabels = true,
  variant,
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Determine distress level (1 to 4) on a refined minimalist scale
  const level = clampedScore >= 80 ? 4 : clampedScore >= 60 ? 3 : clampedScore >= 35 ? 2 : 1;

  const levelConfig = {
    4: {
      name: 'Critical Priority',
      badge: 'bg-rose-50 text-rose-700 border-rose-200/90 font-bold',
      activeBar: 'bg-rose-600',
      hex: '#e11d48',
      icon: Flame,
    },
    3: {
      name: 'High Distress',
      badge: 'bg-amber-50 text-amber-800 border-amber-200/90 font-bold',
      activeBar: 'bg-amber-500',
      hex: '#d97706',
      icon: AlertTriangle,
    },
    2: {
      name: 'Moderate Surface',
      badge: 'bg-slate-100 text-slate-700 border-slate-200/90 font-semibold',
      activeBar: 'bg-slate-500',
      hex: '#64748b',
      icon: AlertCircle,
    },
    1: {
      name: 'Mild / Routine',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/90 font-medium',
      activeBar: 'bg-emerald-500',
      hex: '#059669',
      icon: CheckCircle2,
    },
  }[level];

  const Icon = levelConfig.icon;
  const displayLabel = label || levelConfig.name;

  // Render high-precision circular gauge for national index or large cards
  const isDial = variant === 'dial' || size === 'lg';

  if (isDial) {
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * 0.75;
    const progressOffset = arcLength - (arcLength * clampedScore) / 100;

    return (
      <div className="flex items-center gap-4 py-1">
        {/* SVG Circular Precision Arc Dial with Minimalist Accent Arc */}
        <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
          <svg className="w-20 h-20 -rotate-135" viewBox="0 0 100 100">
            {/* Background Arc Track */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#f4f4f5"
              strokeWidth="8"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
            {/* Active Severity Arc with Minimalist Color Accent */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={levelConfig.hex}
              strokeWidth="8"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={progressOffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-lg font-black text-black leading-none tracking-tight">
              {clampedScore}
            </span>
            <span className="text-[8px] uppercase font-bold text-neutral-400 mt-0.5">
              RDI Index
            </span>
          </div>
        </div>

        {/* Dial Meta Details */}
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md border ${levelConfig.badge}`}>
              <Icon size={12} className="shrink-0" />
              <span>{displayLabel}</span>
            </span>
            <span className="text-xs font-mono font-bold text-neutral-500">
              Grade {level}/4
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 font-medium truncate">
            ASTM D6433 Pavement Distress Severity Standard
          </p>

          {/* Stepped Scale Indicator in Minimalist Tones */}
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            <div className={`h-1.5 rounded-full ${level >= 1 ? 'bg-emerald-500' : 'bg-neutral-200'}`} title="Level 1: Mild" />
            <div className={`h-1.5 rounded-full ${level >= 2 ? 'bg-slate-500' : 'bg-neutral-200'}`} title="Level 2: Moderate" />
            <div className={`h-1.5 rounded-full ${level >= 3 ? 'bg-amber-500' : 'bg-neutral-200'}`} title="Level 3: High" />
            <div className={`h-1.5 rounded-full ${level >= 4 ? 'bg-rose-600' : 'bg-neutral-200'}`} title="Level 4: Critical" />
          </div>
        </div>
      </div>
    );
  }

  // 4-Segment Stepped Tactile Meter for Tables & GIS Sidebar
  return (
    <div className="w-full space-y-1">
      {showLabels && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Icon size={11} className="shrink-0" style={{ color: levelConfig.hex }} />
            <span className="font-bold text-black text-[11px] truncate">
              {displayLabel}
            </span>
          </div>
          <span className="font-mono font-bold text-neutral-700 text-[11px] shrink-0">
            {clampedScore}%
          </span>
        </div>
      )}

      {/* 4-Segment Tactile Stepped Bar in Minimalist Desaturated Tones */}
      <div className="grid grid-cols-4 gap-1 w-full">
        <div 
          className={`h-2 rounded-xs transition-all duration-300 ${
            level >= 1 ? 'bg-emerald-500' : 'bg-neutral-100 border border-neutral-200'
          }`}
          title="Level 1: Mild Surface"
        />
        <div 
          className={`h-2 rounded-xs transition-all duration-300 ${
            level >= 2 ? 'bg-slate-500' : 'bg-neutral-100 border border-neutral-200'
          }`}
          title="Level 2: Moderate Distress"
        />
        <div 
          className={`h-2 rounded-xs transition-all duration-300 ${
            level >= 3 ? 'bg-amber-500' : 'bg-neutral-100 border border-neutral-200'
          }`}
          title="Level 3: High Distress"
        />
        <div 
          className={`h-2 rounded-xs transition-all duration-300 ${
            level >= 4 ? 'bg-rose-600' : 'bg-neutral-100 border border-neutral-200'
          }`}
          title="Level 4: Critical Crater"
        />
      </div>

      {showLabels && size !== 'sm' && (
        <div className="flex justify-between items-center text-[9px] uppercase font-bold text-neutral-400 pt-0.5">
          <span>Mild</span>
          <span>Mod</span>
          <span>High</span>
          <span>Crit</span>
        </div>
      )}
    </div>
  );
};
