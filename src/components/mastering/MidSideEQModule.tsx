import { useState, useRef, useEffect } from 'react';
import ModulePanel, { KnobControl } from './ModulePanel';
import { useAudio } from '@/contexts/AudioContext';

// ============================================================
// MS EQ CURVE — Custom viz for Mid vs Side
// ============================================================
function MSEQCurve({ bandsMid, bandsSide, view }: {
  bandsMid: { freq: number; gain: number; q: number; type: string }[];
  bandsSide: { freq: number; gain: number; q: number; type: string }[];
  view: 'mid' | 'side' | 'stereo';
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);

    const f2x = (f: number) => ((Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))) * w;
    const g2y = (g: number) => h / 2 - (g / 14) * (h / 2 - 4);

    // Grid
    ctx.strokeStyle = '#1a1a20'; ctx.lineWidth = 1;
    [20, 100, 1000, 5000, 20000].forEach(f => {
      ctx.beginPath(); ctx.moveTo(f2x(f), 0); ctx.lineTo(f2x(f), h); ctx.stroke();
    });
    ctx.strokeStyle = '#252530';
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

    const calcG = (f: number, bands: any[]) => {
      return bands.reduce((acc, b) => {
        if (!b.gain) return acc;
        const cf = b.freq;
        if (b.type === 'lowshelf') return acc + b.gain / (1 + Math.pow(f / cf, 2));
        if (b.type === 'highshelf') return acc + b.gain / (1 + Math.pow(cf / f, 2));
        const bw = cf / (b.q || 1);
        return acc + b.gain * Math.exp(-Math.pow(f - cf, 2) / (2 * bw * bw));
      }, 0);
    };

    const drawCurve = (bands: any[], color: string, fill: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      for (let x = 0; x < w; x++) {
        const freq = Math.pow(10, (x / w) * (Math.log10(20000) - Math.log10(20)) + Math.log10(20));
        const y = g2y(calcG(freq, bands));
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.lineTo(w, h / 2); ctx.lineTo(0, h / 2);
      ctx.fillStyle = fill; ctx.fill();
    };

    if (view === 'mid' || view === 'stereo') {
      drawCurve(bandsMid, 'hsl(36, 80%, 52%)', 'hsla(36, 80%, 52%, 0.1)');
    }
    if (view === 'side' || view === 'stereo') {
      drawCurve(bandsSide, 'hsl(165, 80%, 50%)', 'hsla(165, 80%, 50%, 0.1)');
    }
  }, [bandsMid, bandsSide, view]);

  return <canvas ref={ref} width={500} height={100} className="w-full rounded-sm bg-[hsl(240,7%,5%)]" />;
}

// ============================================================
// MODULE
// ============================================================
const MidSideEQModule = () => {
  const { processing, setProcessing } = useAudio();
  const [view, setView] = useState<'mid' | 'side' | 'stereo'>('stereo');

  const updateBand = (side: 'mid' | 'side', idx: number, key: string, val: any) => {
    setProcessing(p => {
      const field = side === 'mid' ? 'eqBands' : 'sideEqBands';
      const newBands = [...p[field]];
      newBands[idx] = { ...newBands[idx], [key]: val };
      return { ...p, [field]: newBands };
    });
  };

  const labels = ['Low', 'Low Mid', 'Mid', 'Hi Mid', 'High'];

  return (
    <ModulePanel
      title="Mid/Side EQ"
      enabled={processing.eqEnabled}
      onToggle={() => setProcessing(p => ({ ...p, eqEnabled: !p.eqEnabled }))}
      accentColor="hsl(165, 80%, 50%)"
    >
      <div className="flex bg-secondary p-0.5 rounded-md mb-3">
        {(['mid', 'side', 'stereo'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 text-[9px] uppercase py-1 rounded-sm transition-all font-bold tracking-widest ${
              view === v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <MSEQCurve bandsMid={processing.eqBands} bandsSide={processing.sideEqBands} view={view} />
      </div>

      <div className="space-y-4">
        {(view === 'mid' || view === 'stereo') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Mid Path</span>
              <span className="text-[8px] text-muted-foreground font-mono">L+R channel processing</span>
            </div>
            <div className="grid grid-cols-5 gap-2 overflow-x-auto pb-1">
              {processing.eqBands.map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-1 min-w-[48px]">
                  <KnobControl
                    label={labels[i]} value={b.gain} min={-12} max={6} step={0.1} unit="dB" size={40}
                    onChange={v => updateBand('mid', i, 'gain', v)}
                  />
                  <div className="text-[8px] text-muted-foreground font-mono">{b.freq >= 1000 ? `${(b.freq/1000).toFixed(1)}k` : b.freq}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(view === 'side' || view === 'stereo') && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[hsl(165,80%,50%)] tracking-widest uppercase">Side Path</span>
              <span className="text-[8px] text-muted-foreground font-mono">L-R channel processing</span>
            </div>
            <div className="grid grid-cols-5 gap-2 overflow-x-auto pb-1">
              {processing.sideEqBands.map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-1 min-w-[48px]">
                  <KnobControl
                    label={labels[i]} value={b.gain} min={-12} max={6} step={0.1} unit="dB" size={40}
                    onChange={v => updateBand('side', i, 'gain', v)}
                    color="hsl(165, 80%, 50%)"
                  />
                  <div className="text-[8px] text-muted-foreground font-mono">{b.freq >= 1000 ? `${(b.freq/1000).toFixed(1)}k` : b.freq}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!processing.eqEnabled && (
        <div className="absolute inset-x-0 bottom-4 text-center">
            <span className="text-[9px] bg-background/80 px-3 py-1 rounded-full border border-border text-muted-foreground inline-block">
                Master EQ Bypassed
            </span>
        </div>
      )}
    </ModulePanel>
  );
};

export default MidSideEQModule;
