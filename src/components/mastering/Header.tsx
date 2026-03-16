import { Play, Pause, Square, Repeat, Download, Sparkles, Target, Zap } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';
import { PLATFORM_TARGETS } from '@/lib/masterPresets';
import { Button } from '@/components/ui/button';
import { calculateTonalMatch } from '@/lib/audioAnalysis';
import { toast } from 'sonner';

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

const Header = () => {
  const { state, play, stop, toggleLoop, dispatch, setProcessing } = useAudio();

  const platLUFS = PLATFORM_TARGETS[state.exportPlatform]?.lufs ?? -14;
  const lufsOk = state.meters.lufs <= -59 || Math.abs(state.meters.lufs - platLUFS) < 2;

  const handleTonalMatch = () => {
    if (!state.audioBuffer || !state.referenceBuffer) {
      toast.error('Load both your track AND a reference track first!');
      return;
    }
    
    toast.info('AI is analyzing reference spectrum…');
    setTimeout(() => {
        const matchingBands = calculateTonalMatch(state.audioBuffer!, state.referenceBuffer!);
        
        setProcessing(p => {
            const newBands = [...p.eqBands];
            matchingBands.forEach((match, i) => {
                newBands[i] = { ...newBands[i], gain: match.gain };
            });
            return { ...p, eqBands: newBands, eqEnabled: true };
        });
        
        toast.success(`Tonal match applied! Matched to ${state.referenceName}`);
    }, 1200);
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/80 backdrop-blur-md flex-shrink-0 z-20">
      {/* BRANDING: HRL MasterAI Pro */}
      <div className="flex items-center gap-3 flex-shrink-0 group">
        <div className="relative">
          <img 
            src="/hrl-logo.png" 
            alt="HRL" 
            className="w-8 h-8 object-contain filter drop-shadow-[0_0_8px_rgba(36,160,232,0.5)] group-hover:scale-110 transition-transform cursor-pointer" 
            onError={(e) => {
                // Fallback if image not found
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-black text-black';
                    fallback.innerText = 'H';
                    parent.appendChild(fallback);
                }
            }}
          />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_5px_var(--primary)]" />
        </div>
        <div>
          <div className="text-sm font-black tracking-tighter text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
            HRL <span className="text-primary">MasterAI</span> <span className="text-[10px] bg-primary/10 text-primary px-1 rounded ml-1">PRO</span>
          </div>
          <div className="text-[8px] text-muted-foreground tracking-[0.3em] uppercase font-bold opacity-60">High-Resolution Labs</div>
        </div>
      </div>

      <div className="w-px h-8 bg-border/50 mx-2" />

      {/* Transport Section */}
      <div className="flex items-center gap-1.5 bg-secondary/30 p-1 rounded-lg border border-border/50">
        <button
          onClick={() => state.isPlaying ? stop() : play()}
          disabled={!state.audioBuffer}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition-all ${
            state.isPlaying
              ? 'bg-primary text-black shadow-[0_0_15px_rgba(232,160,32,0.4)]'
              : 'hover:bg-secondary text-foreground'
          } disabled:opacity-30`}
        >
          {state.isPlaying ? <Pause className="fill-current w-4 h-4" /> : <Play className="fill-current w-4 h-4 ml-0.5" />}
        </button>

        <button
          onClick={stop}
          className="w-9 h-9 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-all flex items-center justify-center"
        >
          <Square className="fill-current w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleLoop}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition-all ${
            state.isLooping ? 'text-primary bg-primary/10 border border-primary/20' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
        </button>

        <div className="px-3 py-1 flex flex-col items-center">
            <span className="text-[10px] font-mono text-primary font-bold">{fmt(state.currentTime)}</span>
            <span className="text-[8px] font-mono text-muted-foreground opacity-50">{fmt(state.duration)}</span>
        </div>
      </div>

      <div className="flex-1 min-w-0" />

      {/* TREND: AI Features Bar */}
      <div className="flex items-center gap-2">
        <Button
            variant="outline"
            size="sm"
            onClick={handleTonalMatch}
            className={`h-9 gap-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-all group ${!state.referenceBuffer && 'opacity-50'}`}
        >
            <Target className={`w-4 h-4 transition-transform group-hover:scale-125 ${state.referenceBuffer ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Tonal Match</span>
            {state.referenceBuffer && <Zap className="w-3 h-3 text-primary animate-pulse" />}
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <div className="flex flex-col items-end gap-0.5 px-2">
            <div className="flex items-center gap-2">
                <span className="text-[8px] uppercase tracking-widest text-muted-foreground">Mastering for</span>
                <select
                    value={state.exportPlatform}
                    onChange={e => dispatch({ type: 'SET_EXPORT_PLATFORM', platform: e.target.value })}
                    className="bg-transparent text-primary text-[10px] font-bold outline-none cursor-pointer"
                >
                    {Object.keys(PLATFORM_TARGETS).map(p => (
                    <option key={p} value={p} className="bg-background text-foreground">{p}</option>
                    ))}
                </select>
            </div>
            <div className={`text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1.5 ${
                lufsOk ? 'text-green-500' : 'text-amber-500'
            }`}>
               {state.meters.lufs.toFixed(1)} <span className="opacity-50 text-[8px]">LUFS</span>
               <div className={`w-1.5 h-1.5 rounded-full ${lufsOk ? 'bg-green-500 shadow-[0_0_5px_green]' : 'bg-amber-500 shadow-[0_0_5px_orange]'}`} />
            </div>
        </div>

        <Button
            size="sm"
            className="h-9 gap-2 font-black text-[10px] uppercase bg-gradient-to-r from-primary to-amber-600 hover:scale-105 transition-transform shadow-lg shadow-primary/10"
        >
            <Download className="w-4 h-4" />
            Export Master
        </Button>
      </div>
    </header>
  );
};

export default Header;
