import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useReducer } from 'react';
import { MasteringEngine } from '@/lib/audioEngine';
import { analyzeAudio, type AudioMetrics } from '@/lib/audioAnalysis';
import { MASTER_PRESETS, PLATFORM_TARGETS, type MasterPreset } from '@/lib/masterPresets';

export interface AudioFileInfo {
  name: string;
  duration: number;
  sampleRate: number;
  bitDepth: number;
  peakLevel: number;
  channels: number;
}

export interface EQBandParams {
  freq: number;
  gain: number;
  q: number;
  type: BiquadFilterType;
}

export interface ProcessingParams {
  inputGain: number;
  // EQ (Combined or Mid)
  eqEnabled: boolean;
  eqBands: EQBandParams[];
  // Side EQ (for M/S)
  sideEqEnabled: boolean;
  sideEqBands: EQBandParams[];
  // Noise Gate
  gateEnabled: boolean;
  gateThreshold: number;
  gateAttack: number;
  gateHold: number;
  gateRelease: number;
  gateRange: number;
  // Compressor
  compEnabled: boolean;
  compThreshold: number;
  compRatio: number;
  compAttack: number;
  compRelease: number;
  compKnee: number;
  compMakeup: number;
  // Multiband
  mbEnabled: boolean;
  mbCrossovers: [number, number, number];
  // Saturation
  saturation: number;
  saturationEnabled: boolean;
  // Stereo Width
  widthEnabled: boolean;
  stereoWidth: number;
  // Limiter
  limiterEnabled: boolean;
  limiterCeiling: number;
  limiterRelease: number;
  limiterLookahead: number;
}

export interface MeterValues {
  lufs: number;
  lufsL: number;
  lufsR: number;
  peak: number;
  correlation: number;
  fftBuf: Uint8Array | null;
}

export interface ExportMetadata {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  bpm: string;
  key: string;
  isrc: string;
}

export interface AIReport {
  presetName: string;
  genre: string;
  confidence: number;
  analysisNotes: string;
  recommendations: string[];
  warnings?: string[];
  parameterReasons?: Record<string, string>;
  signalChain?: Record<string, unknown>;
}

export interface AudioState {
  file: File | null;
  fileInfo: AudioFileInfo | null;
  audioBuffer: AudioBuffer | null;
  isPlaying: boolean;
  isLooping: boolean;
  currentTime: number;
  duration: number;
  referenceBuffer: AudioBuffer | null;
  referenceMetrics: AudioMetrics | null;
  referenceName: string | null;
  activePresetId: string | null;
  aiStatus: 'idle' | 'analyzing' | 'waiting' | 'done' | 'error';
  aiReport: AIReport | null;
  aiError: string | null;
  aiMetrics: AudioMetrics | null;
  exportPlatform: string;
  exportFormats: string[];
  exportMetadata: ExportMetadata;
  isExporting: boolean;
  exportProgress: Record<string, number>;
  meters: MeterValues;
  loadError: string | null;
}

type AudioAction =
  | { type: 'SET_FILE'; file: File; buffer: AudioBuffer; info: AudioFileInfo }
  | { type: 'SET_PLAYING'; value: boolean }
  | { type: 'SET_LOOPING'; value: boolean }
  | { type: 'SET_TIME'; value: number }
  | { type: 'SET_LOAD_ERROR'; error: string | null }
  | { type: 'SET_REFERENCE'; buffer: AudioBuffer; metrics: AudioMetrics; name: string }
  | { type: 'SET_PRESET'; presetId: string }
  | { type: 'SET_AI_STATUS'; status: AudioState['aiStatus']; error?: string }
  | { type: 'SET_AI_REPORT'; report: AIReport }
  | { type: 'SET_AI_METRICS'; metrics: AudioMetrics }
  | { type: 'SET_EXPORT_PLATFORM'; platform: string }
  | { type: 'TOGGLE_EXPORT_FORMAT'; fmt: string }
  | { type: 'SET_METADATA'; key: keyof ExportMetadata; value: string }
  | { type: 'SET_IS_EXPORTING'; value: boolean }
  | { type: 'SET_EXPORT_PROGRESS'; fmt: string; pct: number }
  | { type: 'UPDATE_METERS'; meters: MeterValues };

const DEFAULT_REFERENCE_FLAT = MASTER_PRESETS.find(p => p.id === 'reference-flat')!;

const CREATE_DEFAULT_BANDS = (flat: typeof DEFAULT_REFERENCE_FLAT) => flat.parametricEQ.map(b => ({
  freq: b.freq,
  gain: b.gain,
  q: b.q,
  type: (b.type === 'lowShelf' ? 'lowshelf' : b.type === 'highShelf' ? 'highshelf' : 'peaking') as BiquadFilterType,
}));

const DEFAULT_PROCESSING: ProcessingParams = {
  inputGain: 0,
  eqEnabled: true,
  eqBands: CREATE_DEFAULT_BANDS(DEFAULT_REFERENCE_FLAT),
  sideEqEnabled: true,
  sideEqBands: CREATE_DEFAULT_BANDS(DEFAULT_REFERENCE_FLAT),
  gateEnabled: false,
  gateThreshold: -50,
  gateAttack: 5,
  gateHold: 100,
  gateRelease: 200,
  gateRange: 40,
  compEnabled: DEFAULT_REFERENCE_FLAT.compressor.enabled,
  compThreshold: DEFAULT_REFERENCE_FLAT.compressor.threshold,
  compRatio: DEFAULT_REFERENCE_FLAT.compressor.ratio,
  compAttack: DEFAULT_REFERENCE_FLAT.compressor.attack,
  compRelease: DEFAULT_REFERENCE_FLAT.compressor.release,
  compKnee: DEFAULT_REFERENCE_FLAT.compressor.knee,
  compMakeup: DEFAULT_REFERENCE_FLAT.compressor.makeupGain,
  mbEnabled: false,
  mbCrossovers: [80, 300, 3000],
  saturation: 0,
  saturationEnabled: false,
  widthEnabled: true,
  stereoWidth: DEFAULT_REFERENCE_FLAT.stereoWidth,
  limiterEnabled: true,
  limiterCeiling: DEFAULT_REFERENCE_FLAT.limiter.ceiling,
  limiterRelease: DEFAULT_REFERENCE_FLAT.limiter.release,
  limiterLookahead: DEFAULT_REFERENCE_FLAT.limiter.lookahead,
};

const INITIAL_STATE: AudioState = {
  file: null, fileInfo: null, audioBuffer: null,
  isPlaying: false, isLooping: false, currentTime: 0, duration: 0,
  referenceBuffer: null, referenceMetrics: null, referenceName: null,
  activePresetId: 'reference-flat',
  aiStatus: 'idle', aiReport: null, aiError: null, aiMetrics: null,
  exportPlatform: 'Spotify',
  exportFormats: ['wav24'],
  exportMetadata: { title: '', artist: '', album: '', year: '', genre: '', bpm: '', key: '', isrc: '' },
  isExporting: false, exportProgress: {},
  meters: { lufs: -60, lufsL: -60, lufsR: -60, peak: -90, correlation: 1, fftBuf: null },
  loadError: null,
};

function audioReducer(state: AudioState, action: AudioAction): AudioState {
  switch (action.type) {
    case 'SET_FILE': return { ...state, file: action.file, audioBuffer: action.buffer, fileInfo: action.info, currentTime: 0, isPlaying: false, loadError: null, duration: action.buffer.duration };
    case 'SET_PLAYING': return { ...state, isPlaying: action.value };
    case 'SET_LOOPING': return { ...state, isLooping: action.value };
    case 'SET_TIME': return { ...state, currentTime: action.value };
    case 'SET_LOAD_ERROR': return { ...state, loadError: action.error };
    case 'SET_REFERENCE': return { ...state, referenceBuffer: action.buffer, referenceMetrics: action.metrics, referenceName: action.name };
    case 'SET_PRESET': return { ...state, activePresetId: action.presetId };
    case 'SET_AI_STATUS': return { ...state, aiStatus: action.status, aiError: action.error ?? null };
    case 'SET_AI_REPORT': return { ...state, aiReport: action.report, aiStatus: 'done', activePresetId: null };
    case 'SET_AI_METRICS': return { ...state, aiMetrics: action.metrics };
    case 'SET_EXPORT_PLATFORM': return { ...state, exportPlatform: action.platform };
    case 'TOGGLE_EXPORT_FORMAT': return { ...state, exportFormats: state.exportFormats.includes(action.fmt) ? state.exportFormats.filter(f => f !== action.fmt) : [...state.exportFormats, action.fmt] };
    case 'SET_METADATA': return { ...state, exportMetadata: { ...state.exportMetadata, [action.key]: action.value } };
    case 'SET_IS_EXPORTING': return { ...state, isExporting: action.value };
    case 'SET_EXPORT_PROGRESS': return { ...state, exportProgress: { ...state.exportProgress, [action.fmt]: action.pct } };
    case 'UPDATE_METERS': return { ...state, meters: action.meters };
    default: return state;
  }
}

interface AudioContextType {
  state: AudioState;
  processing: ProcessingParams;
  engine: MasteringEngine | null;
  dispatch: React.Dispatch<AudioAction>;
  loadFile: (file: File) => Promise<void>;
  loadReference: (file: File) => Promise<void>;
  play: () => void;
  stop: () => void;
  toggleLoop: () => void;
  seek: (time: number) => void;
  setProcessing: React.Dispatch<React.SetStateAction<ProcessingParams>>;
  applyProcessingToEngine: (params: ProcessingParams) => void;
  applyPreset: (preset: MasterPreset) => void;
  getAudioAnalysis: () => AudioMetrics | null;
}

const AudioCtx = createContext<AudioContextType | null>(null);

export const useAudio = () => {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be within AudioProvider');
  return ctx;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(audioReducer, INITIAL_STATE);
  const [processing, setProcessing] = useState<ProcessingParams>(DEFAULT_PROCESSING);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<MasteringEngine | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef(0);
  const meterRafRef = useRef(0);

  const getCtxAndEngine = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      engineRef.current = new MasteringEngine(audioCtxRef.current);
    }
    return { ctx: audioCtxRef.current, engine: engineRef.current! };
  }, []);

  const applyProcessingToEngine = useCallback((p: ProcessingParams) => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.setInputGain(p.inputGain);

    if (p.gateEnabled) {
      engine.setNoiseGate(p.gateThreshold, 20, p.gateAttack, p.gateHold, p.gateRelease);
    } else {
      engine.setNoiseGate(-100, 1, 10, 0, 100); // bypassed gate
    }

    if (p.eqEnabled) {
      p.eqBands.forEach((band, i) => engine.setEQBand(i, band, 'mid'));
      if (p.sideEqEnabled) {
        p.sideEqBands.forEach((band, i) => engine.setEQBand(i, band, 'side'));
      } else {
        p.sideEqBands.forEach((band, i) => engine.setEQBand(i, { ...band, gain: 0 }, 'side'));
      }
      engine.bypassEQ(false);
    } else {
      engine.bypassEQ(true);
    }

    if (p.compEnabled) {
      engine.setCompressor({ threshold: p.compThreshold, ratio: p.compRatio, attack: p.compAttack, release: p.compRelease, knee: p.compKnee });
      engine.setMakeupGain(p.compMakeup);
      engine.bypassCompressor(false);
    } else {
      engine.bypassCompressor(true);
      engine.setMakeupGain(0);
    }

    engine.setSaturation(p.saturationEnabled ? p.saturation : 0);
    
    if (p.widthEnabled) {
      engine.setStereoWidth(p.stereoWidth);
    } else {
      engine.setStereoWidth(100);
    }

    if (p.limiterEnabled) {
      engine.setLimiter({ ceiling: p.limiterCeiling, release: p.limiterRelease, lookahead: p.limiterLookahead });
      engine.bypassLimiter(false);
    } else {
      engine.bypassLimiter(true);
    }
  }, []);

  useEffect(() => {
    applyProcessingToEngine(processing);
  }, [processing, applyProcessingToEngine]);

  const applyPreset = useCallback((preset: MasterPreset) => {
    setProcessing(prev => ({
      ...prev,
      inputGain: preset.inputGain,
      eqEnabled: true,
      eqBands: preset.parametricEQ.map(b => ({
        freq: b.freq, gain: b.gain, q: b.q,
        type: (b.type === 'lowShelf' ? 'lowshelf' : b.type === 'highShelf' ? 'highshelf' : 'peaking') as BiquadFilterType,
      })),
      sideEqEnabled: true,
      sideEqBands: preset.parametricEQ.map(b => ({
        freq: b.freq, gain: b.gain, q: b.q,
        type: (b.type === 'lowShelf' ? 'lowshelf' : b.type === 'highShelf' ? 'highshelf' : 'peaking') as BiquadFilterType,
      })),
      gateEnabled: preset.noiseGate.enabled,
      gateThreshold: preset.noiseGate.threshold,
      gateAttack: preset.noiseGate.attack,
      gateHold: preset.noiseGate.hold,
      gateRelease: preset.noiseGate.release,
      gateRange: preset.noiseGate.range,
      compEnabled: preset.compressor.enabled,
      compThreshold: preset.compressor.threshold,
      compRatio: preset.compressor.ratio,
      compAttack: preset.compressor.attack,
      compRelease: preset.compressor.release,
      compKnee: preset.compressor.knee,
      compMakeup: preset.compressor.makeupGain,
      stereoWidth: preset.stereoWidth, widthEnabled: true,
      limiterEnabled: true,
      limiterCeiling: preset.limiter.ceiling,
      limiterRelease: preset.limiter.release,
      limiterLookahead: preset.limiter.lookahead,
    }));
    dispatch({ type: 'SET_PRESET', presetId: preset.id });
  }, []);

  const getAudioAnalysis = useCallback((): AudioMetrics | null => {
    if (!state.audioBuffer) return null;
    return analyzeAudio(state.audioBuffer);
  }, [state.audioBuffer]);

  const loadFile = useCallback(async (file: File) => {
    try {
      const { ctx } = getCtxAndEngine();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      let peak = 0;
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const d = audioBuffer.getChannelData(c);
        for (let i = 0; i < d.length; i++) {
          const a = Math.abs(d[i]);
          if (a > peak) peak = a;
        }
      }
      dispatch({
        type: 'SET_FILE',
        file, buffer: audioBuffer,
        info: { name: file.name, duration: audioBuffer.duration, sampleRate: audioBuffer.sampleRate, bitDepth: 24, peakLevel: 20 * Math.log10(peak || 0.0001), channels: audioBuffer.numberOfChannels },
      });
    } catch (e) {
      dispatch({ type: 'SET_LOAD_ERROR', error: `Could not decode audio: ${e instanceof Error ? e.message : 'unknown error'}` });
    }
  }, [getCtxAndEngine]);

  const loadReference = useCallback(async (file: File) => {
    const { ctx } = getCtxAndEngine();
    const arrayBuffer = await file.arrayBuffer();
    const referenceBuffer = await ctx.decodeAudioData(arrayBuffer);
    const referenceMetrics = analyzeAudio(referenceBuffer);
    dispatch({ type: 'SET_REFERENCE', buffer: referenceBuffer, metrics: referenceMetrics, name: file.name });
  }, [getCtxAndEngine]);

  const play = useCallback(() => {
    const { ctx, engine } = getCtxAndEngine();
    if (!state.audioBuffer) return;
    if (ctx.state === 'suspended') ctx.resume();
    engine.disconnectSource();
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
    const source = ctx.createBufferSource();
    source.buffer = state.audioBuffer;
    source.loop = state.isLooping;
    sourceRef.current = source;
    engine.connectSource(source);
    startTimeRef.current = ctx.currentTime;
    source.start(0, offsetRef.current);
    source.onended = () => { if (!state.isLooping) { dispatch({ type: 'SET_PLAYING', value: false }); dispatch({ type: 'SET_TIME', value: 0 }); offsetRef.current = 0; cancelAnimationFrame(rafRef.current); } };
    dispatch({ type: 'SET_PLAYING', value: true });
    const tick = () => {
      if (audioCtxRef.current) {
        const elapsed = audioCtxRef.current.currentTime - startTimeRef.current + offsetRef.current;
        dispatch({ type: 'SET_TIME', value: Math.min(elapsed, state.duration) });
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [state.audioBuffer, state.isLooping, state.duration, getCtxAndEngine]);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (engine) engine.disconnectSource();
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} sourceRef.current = null; }
    cancelAnimationFrame(rafRef.current);
    offsetRef.current = 0;
    dispatch({ type: 'SET_PLAYING', value: false });
    dispatch({ type: 'SET_TIME', value: 0 });
  }, []);

  const toggleLoop = useCallback(() => {
    dispatch({ type: 'SET_LOOPING', value: !state.isLooping });
    if (sourceRef.current) sourceRef.current.loop = !state.isLooping;
  }, [state.isLooping]);

  const seek = useCallback((time: number) => {
    offsetRef.current = time;
    dispatch({ type: 'SET_TIME', value: time });
    if (state.isPlaying) play();
  }, [state.isPlaying, play]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !state.isPlaying) { cancelAnimationFrame(meterRafRef.current); return; }
    const tick = () => {
      const ch = engine.getChannelLevels();
      const fftData = engine.getPostFrequencyData();
      const lufsL = ch.left > -90 ? Math.round((ch.left - 0.691) * 10) / 10 : -60;
      const lufsR = ch.right > -90 ? Math.round((ch.right - 0.691) * 10) / 10 : -60;
      const lufs = Math.round(((lufsL + lufsR) / 2) * 10) / 10;
      const peak = Math.max(ch.left, ch.right);
      const { l: lData, r: rData } = engine.getGoniometerData();
      let sLR = 0, sL2 = 0, sR2 = 0;
      const len = Math.min(lData.length, rData.length, 512);
      for (let i = 0; i < len; i++) { sLR += lData[i]*rData[i]; sL2 += lData[i]*lData[i]; sR2 += rData[i]*rData[i]; }
      const correlation = Math.round((sLR / Math.sqrt((sL2 * sR2) || 1)) * 100) / 100;
      const fftBuf = new Uint8Array(fftData.length);
      for (let i = 0; i < fftData.length; i++) fftBuf[i] = Math.round(Math.max(0, Math.min(255, (fftData[i] + 100) / 100 * 255)));
      dispatch({ type: 'UPDATE_METERS', meters: { lufs, lufsL, lufsR, peak: Math.round(peak * 10) / 10, correlation, fftBuf } });
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(meterRafRef.current);
  }, [state.isPlaying]);

  return (
    <AudioCtx.Provider value={{
      state, processing, engine: engineRef.current, dispatch, loadFile, loadReference, play, stop, toggleLoop, seek, setProcessing, applyProcessingToEngine, applyPreset, getAudioAnalysis,
    }}>
      {children}
    </AudioCtx.Provider>
  );
};
