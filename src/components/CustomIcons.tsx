// Custom SVG icons for TerraLearn - replaces emoji with design-consistent icons

export function SnowflakeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
      <line x1="12" y1="2" x2="14" y2="5" />
      <line x1="12" y1="2" x2="10" y2="5" />
      <line x1="12" y1="22" x2="14" y2="19" />
      <line x1="12" y1="22" x2="10" y2="19" />
    </svg>
  );
}

export function CalendarWarningIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="12" y1="14" x2="12" y2="17" />
      <circle cx="12" cy="19.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function ThermometerWarningIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
      <line x1="11.5" y1="7" x2="11.5" y2="12" />
      <line x1="18" y1="4" x2="22" y2="4" />
      <line x1="18" y1="8" x2="20" y2="8" />
    </svg>
  );
}

export function GlobeWarningIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <line x1="4" y1="4" x2="20" y2="20" />
    </svg>
  );
}

export function SoilWarningIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 22h20" />
      <path d="M6 18c0-3 2-5 6-5s6 2 6 5" />
      <circle cx="8" cy="20" r="1" fill="currentColor" />
      <circle cx="14" cy="20" r="1" fill="currentColor" />
      <circle cx="11" cy="21" r="0.8" fill="currentColor" />
      <line x1="12" y1="2" x2="12" y2="8" />
      <path d="M9 5l3-3 3 3" />
    </svg>
  );
}

export function DroughtIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      <path d="M15 18l2-4" strokeDasharray="2 2" />
      <path d="M7 18l2-4" strokeDasharray="2 2" />
    </svg>
  );
}

export function NutrientIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </svg>
  );
}

export function HeatIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 16c0 2.2 1.8 4 4 4s4-1.8 4-4" />
      <path d="M12 4v2" />
      <path d="M5.2 7.2l1.4 1.4" />
      <path d="M19.8 7.2l-1.4 1.4" />
      <path d="M4 12h2" />
      <path d="M18 12h2" />
      <path d="M9 12.5s0.5-2 3-2 3 2 3 2" />
      <path d="M7 20h10" strokeDasharray="2 2" />
    </svg>
  );
}

export function getWarningIcon(warning: string): React.ReactNode {
  const w = warning.toLowerCase();
  if (w.includes('freez') || w.includes('cold') || w.includes('frost')) {
    return <SnowflakeIcon className="w-4 h-4 shrink-0" />;
  }
  if (w.includes('season') || w.includes('planting time')) {
    return <CalendarWarningIcon className="w-4 h-4 shrink-0" />;
  }
  if (w.includes('temperature') || w.includes('heat')) {
    return <ThermometerWarningIcon className="w-4 h-4 shrink-0" />;
  }
  if (w.includes('latitude') || w.includes('polar') || w.includes('arctic')) {
    return <GlobeWarningIcon className="w-4 h-4 shrink-0" />;
  }
  if (w.includes('ph') || w.includes('soil')) {
    return <SoilWarningIcon className="w-4 h-4 shrink-0" />;
  }
  if (w.includes('humid') || w.includes('arid') || w.includes('dry')) {
    return <DroughtIcon className="w-4 h-4 shrink-0" />;
  }
  if (w.includes('nutrient') || w.includes('nitrogen') || w.includes('phosph')) {
    return <NutrientIcon className="w-4 h-4 shrink-0" />;
  }
  // Default warning triangle
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
