import { Power } from 'lucide-react';

interface ModulePanelProps {
  title: string;
  children: React.ReactNode;
  enabled?: boolean;
  onToggle?: () => void;
  accentColor?: string;
}

const ModulePanel = ({ title, children, enabled = true, onToggle, accentColor = 'hsl(36, 80%, 52%)' }: ModulePanelProps) => (
  <div 
    className={`panel transition-all duration-300 relative ${enabled ? 'panel-active' : 'opacity-40 grayscale-[0.5]'}`}
    style={{ 
        borderLeft: enabled ? `2px solid ${accentColor}` : undefined,
        boxShadow: enabled ? `inset 0 0 20px ${accentColor.replace(')', ' / 0.03)')}` : undefined
    }}
  >
    <div className="flex items-center justify-between mb-3 px-3 pt-3">
      <div className="flex items-center gap-2">
        <div className={`w-1 h-3 rounded-full`} style={{ background: enabled ? accentColor : 'hsl(var(--muted-foreground))' }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/90">{title}</span>
      </div>
      {onToggle && (
        <button
          onClick={onToggle}
          className="p-1.5 rounded-full transition-all hover:bg-secondary group"
        >
          <Power 
            className={`w-3 h-3 transition-colors ${enabled ? '' : 'text-muted-foreground'}`} 
            style={{ color: enabled ? accentColor : undefined }}
          />
        </button>
      )}
    </div>
    <div className="px-3 pb-3">
        {children}
    </div>
    
    {!enabled && (
        <div className="absolute inset-0 bg-background/5 pointer-events-none" />
    )}
  </div>
);

interface KnobControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  size?: number;
  color?: string;
  onChange?: (v: number) => void;
}

export const KnobControl = ({ 
    label, value, min, max, step = 1, unit = '', size = 42, color = 'hsl(36, 80%, 52%)', onChange 
}: KnobControlProps) => {
  const angle = ((value - min) / (max - min)) * 270 - 135;
  
  return (
    <div className="flex flex-col items-center gap-1 group">
      <div 
        className="relative cursor-ns-resize"
        style={{ width: size, height: size }}
        onWheel={(e) => {
            e.preventDefault();
            const delta = -Math.sign(e.deltaY) * (step || 1);
            onChange?.(Math.max(min, Math.min(max, value + delta)));
        }}
      >
        {/* Ring */}
        <svg width={size} height={size} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
          <circle 
            cx="20" cy="20" r="16" fill="none" 
            stroke={color} strokeWidth="3" 
            strokeDasharray={`${(value-min)/(max-min) * 100} 100`}
            transform="rotate(135 20 20)"
            strokeLinecap="round"
          />
        </svg>
        
        {/* Indicator line */}
        <div 
            className="absolute top-1/2 left-1/2 w-0.5 h-1/2 bg-foreground origin-bottom transition-transform duration-75"
            style={{ 
                transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                height: size * 0.35,
                background: color
            }}
        />
      </div>
      
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[7px] uppercase tracking-tighter text-muted-foreground group-hover:text-foreground transition-colors font-bold">
            {label}
        </span>
        <span className="text-[9px] font-mono font-bold" style={{ color }}>
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
    </div>
  );
};

export const GainReductionMeter = ({ value = 0, height = 60 }: { value?: number, height?: number }) => {
  const norm = Math.min(Math.abs(value) / 20 * 100, 100);
  return (
    <div className="flex flex-col items-center gap-1 h-full">
      <div className="w-1.5 bg-secondary rounded-full overflow-hidden relative flex-1" style={{ height }}>
        <div
          className="absolute top-0 left-0 w-full transition-all duration-75"
          style={{ height: `${norm}%`, background: 'hsl(330, 80%, 55%)' }}
        />
      </div>
      <span className="text-[7px] font-mono text-muted-foreground">{value.toFixed(0)}</span>
    </div>
  );
};

export default ModulePanel;
