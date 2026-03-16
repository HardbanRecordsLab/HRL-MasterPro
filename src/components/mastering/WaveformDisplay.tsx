import { useRef, useEffect, useState, useMemo } from 'react';
import { useAudio } from '@/contexts/AudioContext';

const WaveformDisplay = () => {
  const { state, seek } = useAudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverX, setHoverX] = useState(0);

  // Memoized waveform peaks to avoid expensive recalculations
  const peaks = useMemo(() => {
    if (!state.audioBuffer) return null;
    const buffer = state.audioBuffer;
    const width = 1000; // Resolution
    const channelData = buffer.getChannelData(0);
    const step = Math.floor(channelData.length / width);
    const res = new Float32Array(width);
    for (let i = 0; i < width; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const val = Math.abs(channelData[i * step + j]);
        if (val > max) max = val;
      }
      res[i] = max;
    }
    return res;
  }, [state.audioBuffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const barWidth = w / peaks.length;
    
    // Draw Background Waveform (Full Track)
    const drawWave = (color: string, shadow = false) => {
        if (shadow) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
        } else {
            ctx.shadowBlur = 0;
        }
        
        ctx.fillStyle = color;
        for (let i = 0; i < peaks.length; i++) {
          const val = peaks[i];
          const barH = val * h * 0.8;
          const x = i * barWidth;
          const y = (h - barH) / 2;
          
          // Rounded bars for modern look
          ctx.beginPath();
          ctx.roundRect(x + 0.5, y, Math.max(1, barWidth - 0.5), barH, 1);
          ctx.fill();
        }
    };

    // 1. Dark background silhouette
    drawWave('hsl(240, 5%, 15%)');

    // 2. Played portion with primary color + glow
    const progress = state.currentTime / state.duration;
    const progressX = progress * w;
    
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, progressX, h);
    ctx.clip();
    drawWave('hsl(36, 80%, 52%)', true);
    ctx.restore();

    // 3. Current Playhead
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.fillRect(progressX - 1, 0, 2, h);

    // 4. Hover state
    if (isHovering) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(hoverX, 0, 1, h);
        
        const hoverTime = (hoverX / w) * state.duration;
        const formatTime = (s: number) => {
          const m = Math.floor(s / 60);
          const sc = Math.floor(s % 60);
          return `${m}:${sc.toString().padStart(2, '0')}`;
        };

        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.textAlign = hoverX > w - 40 ? 'right' : 'left';
        ctx.fillText(formatTime(hoverTime), hoverX + (hoverX > w - 40 ? -5 : 5), 15);
    }
  }, [peaks, state.currentTime, state.duration, isHovering, hoverX]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverX(x);
  };

  const handleClick = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * state.duration;
    seek(time);
  };

  if (!state.audioBuffer) return null;

  return (
    <div className="panel p-4 pb-2">
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-primary font-black">Waveform Analysis</span>
            <span className="text-[9px] text-muted-foreground font-mono">{state.fileInfo?.name}</span>
        </div>
        <div className="text-right">
            <span className="text-xl font-mono font-black text-foreground">
                {Math.floor(state.currentTime / 60)}:{(Math.floor(state.currentTime % 60)).toString().padStart(2, '0')}
            </span>
            <span className="text-sm font-mono text-muted-foreground ml-1">
                / {Math.floor(state.duration / 60)}:{(Math.floor(state.duration % 60)).toString().padStart(2, '0')}
            </span>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="relative h-28 w-full cursor-pointer overflow-hidden group rounded-lg bg-[hsl(240,7%,5%)]"
        onPointerMove={handlePointerMove}
        onPointerEnter={() => setIsHovering(true)}
        onPointerLeave={() => setIsHovering(false)}
        onClick={handleClick}
      >
        {/* Spectral background (subtle simulation) */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-t from-primary/40 to-transparent" />
        
        <canvas
          ref={canvasRef}
          width={containerRef.current?.clientWidth || 1000}
          height={112}
          className="w-full h-full"
        />

        {/* Dynamic Glow Cursor */}
        {isHovering && (
          <div 
            className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none"
            style={{ left: hoverX }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/20 blur-md rounded-full" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/20 blur-md rounded-full" />
          </div>
        )}
      </div>

      <div className="flex justify-between mt-2 px-1">
        <div className="flex gap-4">
            <div className="flex flex-col">
                <span className="text-[7px] uppercase text-muted-foreground tracking-tighter">Sample Rate</span>
                <span className="text-[9px] font-mono">{state.fileInfo?.sampleRate} Hz</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[7px] uppercase text-muted-foreground tracking-tighter">Peak Level</span>
                <span className={`text-[9px] font-mono ${state.fileInfo?.peakLevel && state.fileInfo.peakLevel > -0.3 ? 'text-destructive' : 'text-success'}`}>
                    {state.fileInfo?.peakLevel?.toFixed(1)} dBFS
                </span>
            </div>
        </div>
        <div className="text-[8px] text-muted-foreground italic self-end opacity-60">
            Interactive Playback · Click to Jump
        </div>
      </div>
    </div>
  );
};

export default WaveformDisplay;
