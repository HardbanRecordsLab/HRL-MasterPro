import { useRef, useEffect, useState } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import { Eye, EyeOff } from 'lucide-react';

const SpectralDiff = () => {
  const { engine, state } = useAudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [showPre, setShowPre] = useState(true);
  const [showPost, setShowPost] = useState(true);

  useEffect(() => {
    if (!engine || !state.isPlaying || !canvasRef.current) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'hsla(240, 5%, 20%, 0.3)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 5; i++) {
        const y = (i / 5) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Frequency labels
      ctx.fillStyle = 'hsl(240, 5%, 35%)';
      ctx.font = '8px monospace';
      const freqLabels = ['50', '100', '500', '1K', '5K', '10K', '20K'];
      freqLabels.forEach((label, i) => {
        const x = (i / (freqLabels.length - 1)) * w;
        ctx.fillText(label, x, h - 2);
      });

      const binCount = engine.preAnalyser.frequencyBinCount;

      if (showPre) {
        const preData = engine.getPreFrequencyData();
        drawCurve(ctx, preData, binCount, w, h, 'hsla(240, 5%, 50%, 0.6)', 'hsla(240, 5%, 50%, 0.05)');
      }

      if (showPost) {
        const postData = engine.getPostFrequencyData();
        drawCurve(ctx, postData, binCount, w, h, 'hsl(36, 80%, 52%)', 'hsla(36, 80%, 52%, 0.08)');
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engine, state.isPlaying, showPre, showPost]);

  if (!state.audioBuffer) return null;

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-section-header">Spectral Diff — Before / After</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPre(!showPre)}
            className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors ${showPre ? 'bg-secondary text-muted-foreground' : 'text-muted-foreground/40'}`}
          >
            {showPre ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} DRY
          </button>
          <button
            onClick={() => setShowPost(!showPost)}
            className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors ${showPost ? 'bg-primary/20 text-primary' : 'text-primary/40'}`}
          >
            {showPost ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} WET
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={120}
        className="w-full h-24 bg-background rounded-sm"
      />
      <div className="flex gap-4 mt-1 text-[8px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-0.5 bg-muted-foreground inline-block" /> Before (Dry)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-0.5 bg-primary inline-block" /> After (Wet)
        </span>
      </div>
    </div>
  );
};

function drawCurve(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  binCount: number,
  w: number,
  h: number,
  strokeColor: string,
  fillColor: string
) {
  ctx.beginPath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;

  for (let x = 0; x < w; x++) {
    // Log-scale frequency mapping
    const logIndex = Math.round(Math.pow(binCount, x / w));
    const idx = Math.min(logIndex, binCount - 1);
    const value = data[idx] || -100;
    const normalized = Math.max(0, (value + 100) / 80); // -100 to -20 dB range
    const y = h - normalized * h;

    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fill
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

export default SpectralDiff;
