import { useState, useEffect, useRef } from 'react';
import ModulePanel, { KnobControl, GainReductionMeter } from './ModulePanel';
import { useAudio } from '@/contexts/AudioContext';

// Hook to poll gain reduction from a DynamicsCompressorNode
function useGainReduction(getGR: (() => number) | undefined, active: boolean): number {
  const [gr, setGr] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!getGR || !active) { setGr(0); return; }
    const tick = () => {
      setGr(getGR());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getGR, active]);

  return gr;
}

// ============================================================
// EQ CURVE CANVAS — ported from MasterAI.jsx
// ============================================================
function EQCurveCanvas({ bands, enabled }: {
  bands: { freq: number; gain: number; q: number; type: string }[];
  enabled: boolean;
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

    // Grid lines
    [20, 30, 50, 80, 100, 200, 300, 500, 800, 1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000].forEach(f => {
      ctx.strokeStyle = '#1a1a20'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(f2x(f), 0); ctx.lineTo(f2x(f), h); ctx.stroke();
    });
    [-12, -9, -6, -3, 0, 3, 6].forEach(g => {
      ctx.strokeStyle = g === 0 ? '#252530' : '#171720'; ctx.lineWidth = g === 0 ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(0, g2y(g)); ctx.lineTo(w, g2y(g)); ctx.stroke();
      if (g !== 0 && g % 3 === 0) {
        ctx.fillStyle = '#303040'; ctx.font = '7px monospace'; ctx.textAlign = 'left';
        ctx.fillText(g + 'dB', 2, g2y(g) - 2);
      }
    });

    if (!enabled) {
      ctx.strokeStyle = '#303040'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    const calcGain = (freq: number, band: { freq: number; gain: number; q: number; type: string }) => {
      const { freq: cf, gain, q, type } = band;
      if (!gain) return 0;
      if (type === 'lowshelf' || type === 'lowShelf') {
        const n = freq / cf;
        return gain / (1 + Math.pow(n, 2 * (q || 0.7)));
      }
      if (type === 'highshelf' || type === 'highShelf') {
        const n = cf / freq;
        return gain / (1 + Math.pow(n, 2 * (q || 0.7)));
      }
      const bw = cf / (q || 1);
      return gain * Math.exp(-Math.pow(freq - cf, 2) / (2 * bw * bw));
    };

    const pts: { x: number; y: number }[] = [];
    for (let px = 0; px < w; px++) {
      const freq = Math.pow(10, (px / w) * (Math.log10(20000) - Math.log10(20)) + Math.log10(20));
      const g = bands.reduce((s, b) => s + calcGain(freq, b), 0);
      pts.push({ x: px, y: g2y(Math.max(-14, Math.min(14, g))) });
    }

    // Fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'hsl(36 80% 52% / 0.25)');
    grad.addColorStop(1, 'hsl(36 80% 52% / 0.03)');
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(w, h / 2);
    ctx.fillStyle = grad; ctx.fill();

    // Curve line
    ctx.beginPath();
    ctx.strokeStyle = 'hsl(36 80% 52%)'; ctx.lineWidth = 1.5;
    ctx.shadowColor = 'hsl(36 80% 52% / 0.5)'; ctx.shadowBlur = 6;
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke(); ctx.shadowBlur = 0;

    // Band markers
    bands.forEach(b => {
      const x = f2x(b.freq), y = g2y(b.gain);
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(36 80% 52%)'; ctx.fill();
      ctx.strokeStyle = 'hsl(240 7% 4%)'; ctx.lineWidth = 1; ctx.stroke();
    });
  }, [bands, enabled]);

  return (
    <canvas
      ref={ref}
      width={520}
      height={90}
      className="w-full block rounded-sm"
      style={{ background: 'hsl(240 7% 5%)' }}
    />
  );
}

// ============================================================
// INPUT GAIN
// ============================================================
export const InputGainModule = () => {
  const { processing, setProcessing } = useAudio();
  return (
    <ModulePanel title="Input Gain">
      <div className="flex items-center gap-4">
        <KnobControl
          label="Gain" value={processing.inputGain}
          min={-24} max={24} step={0.1} unit="dB"
          onChange={(v) => setProcessing(p => ({ ...p, inputGain: v }))}
        />
        <div className="flex-1">
          <input
            type="range" min={-24} max={24} step={0.1} value={processing.inputGain}
            onChange={e => setProcessing(p => ({ ...p, inputGain: parseFloat(e.target.value) }))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between mt-0.5">
            <span className="text-[8px] text-muted-foreground">-24dB</span>
            <span className="text-[9px] font-mono text-primary">{processing.inputGain > 0 ? '+' : ''}{processing.inputGain.toFixed(1)} dB</span>
            <span className="text-[8px] text-muted-foreground">+24dB</span>
          </div>
        </div>
      </div>
    </ModulePanel>
  );
};

// ============================================================
// NOISE GATE
// ============================================================
export const NoiseGateModule = () => {
  const { processing, setProcessing } = useAudio();
  const enabled = processing.gateEnabled;

  return (
    <ModulePanel
      title="Noise Gate"
      enabled={enabled}
      onToggle={() => setProcessing(p => ({ ...p, gateEnabled: !p.gateEnabled }))}
      accentColor="hsl(280 80% 55%)"
    >
      <div className="flex gap-2 flex-wrap">
        {[
          { k: 'gateThreshold' as const, l: 'THRESH', min: -90, max: 0, u: 'dB' },
          { k: 'gateAttack' as const, l: 'ATTACK', min: 0.1, max: 100, u: 'ms' },
          { k: 'gateHold' as const, l: 'HOLD', min: 0, max: 2000, u: 'ms' },
          { k: 'gateRelease' as const, l: 'RELEASE', min: 10, max: 2000, u: 'ms' },
          { k: 'gateRange' as const, l: 'RANGE', min: 0, max: 90, u: 'dB' },
        ].map(p => (
          <KnobControl
            key={p.k}
            label={p.l} value={processing[p.k]} min={p.min} max={p.max} unit={p.u} size={40}
            onChange={v => setProcessing(prev => ({ ...prev, [p.k]: v }))}
          />
        ))}
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-[8px] text-muted-foreground uppercase">OPEN</span>
          <div
            className="w-2.5 h-2.5 rounded-full transition-all"
            style={{
              background: enabled ? 'hsl(280 80% 55%)' : 'hsl(240 5% 20%)',
              boxShadow: enabled ? '0 0 8px hsl(280 80% 55%)' : 'none',
            }}
          />
        </div>
      </div>
    </ModulePanel>
  );
};

// ============================================================
// PARAMETRIC EQ — with live EQ curve
// ============================================================
export const ParametricEQModule = () => {
  const { processing, setProcessing } = useAudio();
  const bands = processing.eqBands;
  const labels = ['LOW SHELF', 'LOW MID', 'MID', 'HI MID', 'HI SHELF'];

  const updateBand = (index: number, key: string, value: number) => {
    setProcessing(p => {
      const newBands = [...p.eqBands];
      newBands[index] = { ...newBands[index], [key]: value };
      return { ...p, eqBands: newBands };
    });
  };

  return (
    <ModulePanel
      title="Parametric EQ"
      enabled={processing.eqEnabled}
      onToggle={() => setProcessing(p => ({ ...p, eqEnabled: !p.eqEnabled }))}
    >
      <div className="mb-2">
        <EQCurveCanvas bands={bands} enabled={processing.eqEnabled} />
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {bands.map((band, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 min-w-[52px]">
            <KnobControl
              label={labels[i]} value={band.gain} min={-12} max={6} step={0.1} unit="dB" size={44}
              onChange={v => updateBand(i, 'gain', v)}
            />
            <span className="text-[8px] font-mono text-muted-foreground">
              {band.freq >= 1000 ? `${(band.freq / 1000).toFixed(1)}k` : band.freq}Hz
            </span>
            <KnobControl
              label="Q" value={band.q} min={0.1} max={10} step={0.01} size={30}
              onChange={v => updateBand(i, 'q', v)}
            />
          </div>
        ))}
      </div>
    </ModulePanel>
  );
};

// ============================================================
// MULTIBAND COMPRESSOR
// ============================================================
export const MultibandCompModule = () => {
  const { processing, setProcessing } = useAudio();
  const enabled = processing.mbEnabled;
  const bandNames = ['SUB', 'LOW', 'MID', 'AIR'];
  const bandColors = ['hsl(260 80% 55%)', 'hsl(210 80% 55%)', 'hsl(36 80% 52%)', 'hsl(330 80% 55%)'];
  const xo = processing.mbCrossovers;
  const ranges = [`20–${xo[0]}`, `${xo[0]}–${xo[1]}`, `${xo[1]}–${xo[2]}`, `${xo[2]}+`];

  return (
    <ModulePanel
      title="Multiband Comp"
      enabled={enabled}
      onToggle={() => setProcessing(p => ({ ...p, mbEnabled: !p.mbEnabled }))}
      accentColor="hsl(48 80% 50%)"
    >
      <div className="grid grid-cols-3 gap-2 mb-2">
        {xo.map((v, i) => (
          <KnobControl
            key={i}
            label={`XO ${i + 1}`} value={v} min={[20, 100, 1000][i]} max={[500, 2000, 10000][i]} unit="Hz" size={38}
            onChange={val => setProcessing(p => {
              const nxo = [...p.mbCrossovers] as [number, number, number];
              nxo[i] = val; return { ...p, mbCrossovers: nxo };
            })}
          />
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {bandNames.map((name, i) => (
          <div
            key={name}
            className="flex flex-col items-center gap-1 p-1.5 rounded-sm"
            style={{ background: bandColors[i] + '10', border: `1px solid ${bandColors[i]}20` }}
          >
            <span className="text-[8px] font-bold" style={{ color: bandColors[i] }}>{name}</span>
            <span className="text-[7px] font-mono text-muted-foreground">{ranges[i]}Hz</span>
            <GainReductionMeter value={0} height={50} />
          </div>
        ))}
      </div>

      <p className="text-[8px] text-muted-foreground/60 italic mt-1">
        ⚠ Frequency bands visible — full processing in next release
      </p>
    </ModulePanel>
  );
};

// ============================================================
// STEREO COMPRESSOR
// ============================================================
export const StereoCompModule = () => {
  const { processing, setProcessing, engine, state } = useAudio();

  const compGR = useGainReduction(
    engine ? () => engine.getCompressorGR() : undefined,
    state.isPlaying && processing.compEnabled
  );

  return (
    <ModulePanel
      title="Stereo Compressor"
      enabled={processing.compEnabled}
      onToggle={() => setProcessing(p => ({ ...p, compEnabled: !p.compEnabled }))}
      accentColor="hsl(200 80% 55%)"
    >
      <div className="flex gap-2 flex-wrap">
        {[
          { k: 'compThreshold' as const, l: 'THRESH', min: -60, max: 0, u: 'dB' },
          { k: 'compRatio' as const, l: 'RATIO', min: 1, max: 20, u: ':1' },
          { k: 'compAttack' as const, l: 'ATTACK', min: 0.1, max: 200, u: 'ms' },
          { k: 'compRelease' as const, l: 'RELEASE', min: 10, max: 2000, u: 'ms' },
          { k: 'compKnee' as const, l: 'KNEE', min: 0, max: 12, u: 'dB' },
          { k: 'compMakeup' as const, l: 'GAIN', min: 0, max: 12, u: 'dB' },
        ].map(p => (
          <KnobControl
            key={p.k}
            label={p.l} value={processing[p.k]} min={p.min} max={p.max} unit={p.u} size={44}
            onChange={v => setProcessing(prev => ({ ...prev, [p.k]: v }))}
          />
        ))}
        <div className="flex flex-col items-center gap-1 justify-center">
          <span className="text-[8px] text-muted-foreground uppercase">GR</span>
          <GainReductionMeter value={compGR} />
        </div>
      </div>

      {/* Comp display */}
      <div className="mt-2 flex gap-4 text-[9px] font-mono text-muted-foreground">
        <span>Th: {processing.compThreshold}dB</span>
        <span>R: {processing.compRatio.toFixed(1)}:1</span>
        <span>A: {processing.compAttack}ms</span>
        <span>GR: <span className="text-[hsl(200,80%,55%)]">{compGR.toFixed(1)}dB</span></span>
      </div>
    </ModulePanel>
  );
};

// ============================================================
// SATURATION
// ============================================================
export const SaturationModule = () => {
  const { processing, setProcessing } = useAudio();

  return (
    <ModulePanel
      title="Saturation / Warmth"
      enabled={processing.saturationEnabled}
      onToggle={() => setProcessing(p => ({ ...p, saturationEnabled: !p.saturationEnabled }))}
      accentColor="hsl(30 90% 50%)"
    >
      <div className="flex items-center gap-4">
        <KnobControl
          label="Drive" value={processing.saturation}
          min={0} max={100} step={1} unit="%"
          onChange={(v) => setProcessing(p => ({ ...p, saturation: v }))}
        />
        <div className="flex-1">
          <input
            type="range" min={0} max={100} step={1} value={processing.saturation}
            onChange={e => setProcessing(p => ({ ...p, saturation: parseInt(e.target.value) }))}
            className="w-full"
            style={{ accentColor: 'hsl(30 90% 50%)' }}
          />
          <div className="mt-1 text-[8px] text-muted-foreground">
            Soft-clip waveshaper with harmonic saturation
          </div>
        </div>
      </div>
    </ModulePanel>
  );
};

// ============================================================
// STEREO WIDTH
// ============================================================
export const StereoWidthModule = () => {
  const { processing, setProcessing, engine, state } = useAudio();
  const [correlation, setCorrelation] = useState(1);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!engine || !state.isPlaying) return;
    const tick = () => {
      const { l, r } = engine.getGoniometerData();
      let sumLR = 0, sumL2 = 0, sumR2 = 0;
      const len = Math.min(l.length, 512);
      for (let i = 0; i < len; i++) {
        sumLR += l[i] * r[i];
        sumL2 += l[i] * l[i];
        sumR2 += r[i] * r[i];
      }
      const corr = sumLR / Math.sqrt((sumL2 * sumR2) || 1);
      setCorrelation(Math.round(corr * 100) / 100);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engine, state.isPlaying]);

  return (
    <ModulePanel
      title="Stereo Width"
      enabled={processing.widthEnabled}
      onToggle={() => setProcessing(p => ({ ...p, widthEnabled: !p.widthEnabled }))}
      accentColor="hsl(165 80% 50%)"
    >
      <div className="flex items-center gap-4">
        <KnobControl
          label="Width" value={processing.stereoWidth}
          min={0} max={200} unit="%"
          onChange={(v) => setProcessing(p => ({ ...p, stereoWidth: v }))}
        />
        <div className="flex-1 space-y-2">
          <input
            type="range" min={0} max={200} value={processing.stereoWidth}
            onChange={e => setProcessing(p => ({ ...p, stereoWidth: parseInt(e.target.value) }))}
            className="w-full"
            style={{ accentColor: 'hsl(165 80% 50%)' }}
          />
          <div className="flex justify-between text-[8px] text-muted-foreground">
            <span>MONO</span>
            <span className={processing.stereoWidth === 100 ? 'text-[hsl(165,80%,50%)]' : ''}>100%</span>
            <span>WIDE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-muted-foreground">Corr:</span>
            <div className="flex-1 h-1.5 bg-secondary rounded-sm overflow-hidden relative">
              <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
              <div
                className="absolute top-0 h-full w-1 rounded-sm transition-all"
                style={{
                  left: `${50 + correlation * 50}%`,
                  background: correlation > 0.5 ? 'hsl(145 60% 50%)' : correlation > 0 ? 'hsl(60 70% 50%)' : 'hsl(0 70% 50%)',
                }}
              />
            </div>
            <span
              className="text-[9px] font-mono"
              style={{ color: correlation > 0.5 ? 'hsl(145 60% 50%)' : correlation > 0 ? 'hsl(60 70% 50%)' : 'hsl(0 70% 50%)' }}
            >
              {correlation > 0 ? '+' : ''}{correlation.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </ModulePanel>
  );
};

// ============================================================
// LIMITER
// ============================================================
export const LimiterModule = () => {
  const { processing, setProcessing, engine, state } = useAudio();

  const limGR = useGainReduction(
    engine ? () => engine.getLimiterGR() : undefined,
    state.isPlaying && processing.limiterEnabled
  );

  return (
    <ModulePanel
      title="True Peak Limiter"
      enabled={processing.limiterEnabled}
      onToggle={() => setProcessing(p => ({ ...p, limiterEnabled: !p.limiterEnabled }))}
      accentColor="hsl(0 70% 55%)"
    >
      <div className="flex items-center gap-4">
        <div className="flex gap-3">
          {[
            { k: 'limiterCeiling' as const, l: 'CEILING', min: -3, max: -0.1, u: 'dBFS' },
            { k: 'limiterRelease' as const, l: 'RELEASE', min: 10, max: 500, u: 'ms' },
            { k: 'limiterLookahead' as const, l: 'LOOK', min: 0, max: 10, u: 'ms' },
          ].map(p => (
            <KnobControl
              key={p.k}
              label={p.l} value={processing[p.k]} min={p.min} max={p.max} unit={p.u} size={48}
              onChange={v => setProcessing(prev => ({ ...prev, [p.k]: v }))}
            />
          ))}
        </div>

        <div className="flex-1 text-right">
          <div
            className="text-3xl font-mono font-black leading-none"
            style={{ color: processing.limiterCeiling > -0.3 ? 'hsl(0 70% 55%)' : 'hsl(36 80% 52%)' }}
          >
            {processing.limiterCeiling}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">dBFS True Peak</div>
          <div className="mt-2 text-[8px] font-mono text-muted-foreground">
            Look: {processing.limiterLookahead}ms · Rel: {processing.limiterRelease}ms
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[8px] text-muted-foreground">GR</span>
          <GainReductionMeter value={limGR} />
        </div>
      </div>
    </ModulePanel>
  );
};
