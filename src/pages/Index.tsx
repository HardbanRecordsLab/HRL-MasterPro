import { useCallback, useRef } from 'react';
import { AudioProvider, useAudio } from '@/contexts/AudioContext';
import Header from '@/components/mastering/Header';
import WaveformDisplay from '@/components/mastering/WaveformDisplay';
import TransportControls from '@/components/mastering/TransportControls';
import {
  InputGainModule,
  NoiseGateModule,
  ParametricEQModule,
  MultibandCompModule,
  StereoCompModule,
  SaturationModule,
  StereoWidthModule,
  LimiterModule,
} from '@/components/mastering/ProcessingModules';
import MidSideEQModule from '@/components/mastering/MidSideEQModule';
import MeteringPanel from '@/components/mastering/MeteringPanel';
import AIPresetsPanel from '@/components/mastering/AIPresetsPanel';
import SpectralDiff from '@/components/mastering/SpectralDiff';
import ReferenceTrack from '@/components/mastering/ReferenceTrack';
import SessionHistory from '@/components/mastering/SessionHistory';
import ExportPanel from '@/components/mastering/ExportPanel';

// ============================================================
// UPLOAD / LANDING SCREEN
// ============================================================
const AudioUploadScreen = () => {
  const { loadFile } = useAudio();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) await loadFile(file);
  }, [loadFile]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await loadFile(file);
  }, [loadFile]);

  return (
    <div className="min-h-screen bg-[#050508] flex flex-col noise-texture selection:bg-primary/30">
      <Header />

      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Abstract Glow Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="w-full max-w-2xl relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center p-1 rounded-2xl bg-gradient-to-br from-primary/30 to-transparent border border-white/10 mb-8 backdrop-blur-xl">
              <img src="/hrl-logo.png" alt="HRL Logo" className="w-24 h-24 object-contain filter drop-shadow-[0_0_20px_rgba(232,160,32,0.3)]" />
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-foreground mb-4 leading-none">
              HRL <span className="text-primary italic">MASTERAI</span> PRO
            </h1>
            <p className="text-base text-muted-foreground max-w-md mx-auto font-medium leading-relaxed">
              Professional Grade AI-Powered Mastering Suite. <br/>
              Developed by <span className="text-foreground font-bold">High-Resolution Labs</span>.
            </p>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="relative group border border-white/10 hover:border-primary/50 hover:shadow-[0_0_40px_rgba(232,160,32,0.1)] rounded-2xl p-16 text-center cursor-pointer transition-all duration-500 bg-white/[0.02] backdrop-blur-md"
          >
            <div className="relative z-10">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500 border border-primary/20">
                <span className="text-3xl">📂</span>
              </div>
              <div className="text-xl font-bold text-foreground mb-2 tracking-tight">Drop your mix to begin</div>
              <div className="text-sm text-muted-foreground mb-6 font-mono opacity-60">WAV, MP3, FLAC (Up to 192kHz/32-bit)</div>
              <div className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-black text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all">
                Select Audio File
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".wav,.mp3,.flac,.aiff,.ogg,audio/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-12">
            {[
              { icon: '🎯', title: 'Spectral Match', desc: 'Emulate any reference track balance' },
              { icon: '🧠', title: 'Neural EQ', desc: 'AI-driven corrective frequency nodes' },
              { icon: '🔊', title: 'Loudness Pro', desc: 'Tiered targets for Spotify, Apple, YT' },
            ].map(f => (
              <div key={f.title} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{f.icon}</div>
                <div className="text-xs font-black text-foreground uppercase tracking-widest mb-1">{f.title}</div>
                <div className="text-[10px] text-muted-foreground leading-snug">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================
// MASTERING WORKSPACE
// ============================================================
const MasteringWorkspace = () => {
  return (
    <div className="min-h-screen bg-background noise-texture flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left sidebar — AI Presets + Reference + Sessions */}
        <aside className="w-64 border-r border-border flex flex-col overflow-hidden flex-shrink-0">
          <div className="flex-1 overflow-y-auto">
            <AIPresetsPanel />
          </div>
          <div className="border-t border-border flex-shrink-0">
            <ReferenceTrack />
          </div>
          <div className="border-t border-border flex-shrink-0">
            <SessionHistory />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="p-3 space-y-3">
            {/* Waveform + Transport */}
            <div className="space-y-2">
              <WaveformDisplay />
              <div className="flex items-center justify-between">
                <TransportControls />
              </div>
            </div>

            {/* Spectral diff (vs reference) */}
            <SpectralDiff />

            {/* Processing chain grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              <InputGainModule />
              <NoiseGateModule />
              <MidSideEQModule />
              <ParametricEQModule />
              <MultibandCompModule />
              <StereoCompModule />
              <SaturationModule />
              <StereoWidthModule />
              <LimiterModule />
            </div>

            {/* Export panel */}
            <ExportPanel />
          </div>
        </main>

        {/* Right sidebar — Meters */}
        <aside className="w-56 border-l border-border overflow-y-auto flex-shrink-0">
          <MeteringPanel />
        </aside>
      </div>
    </div>
  );
};

// ============================================================
// ROUTER: Upload vs Workspace
// ============================================================
const MasteringApp = () => {
  const { state } = useAudio();

  if (!state.audioBuffer) {
    return <AudioUploadScreen />;
  }

  return <MasteringWorkspace />;
};

const Index = () => (
  <AudioProvider>
    <MasteringApp />
  </AudioProvider>
);

export default Index;
