// ============================================================
// 25 PROFESSIONAL MASTERING PRESETS
// Ported from MasterAI.jsx to TypeScript
// ============================================================

export interface EQBand {
  freq: number;
  gain: number;
  q: number;
  type: 'lowShelf' | 'highShelf' | 'peak';
}

export interface NoiseGateParams {
  enabled: boolean;
  threshold: number;
  attack: number;
  hold: number;
  release: number;
  range: number;
}

export interface CompressorParams {
  enabled: boolean;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  knee: number;
  makeupGain: number;
}

export interface LimiterParams {
  ceiling: number;
  release: number;
  lookahead: number;
}

export interface MasterPreset {
  id: string;
  name: string;
  tag: string;
  desc: string;
  inputGain: number;
  noiseGate: NoiseGateParams;
  parametricEQ: EQBand[];
  compressor: CompressorParams;
  stereoWidth: number;
  limiter: LimiterParams;
  targetLUFS: number;
}

export const MASTER_PRESETS: MasterPreset[] = [
  { id: "pop-radio", name: "Pop Radio", tag: "POP", desc: "Loud, punchy, streaming-ready", inputGain: 0, noiseGate: { enabled: false, threshold: -60, attack: 5, hold: 100, release: 200, range: 40 }, parametricEQ: [{ freq: 80, gain: -1.5, q: 0.7, type: "lowShelf" }, { freq: 250, gain: -1.0, q: 1.2, type: "peak" }, { freq: 1200, gain: 1.0, q: 1.5, type: "peak" }, { freq: 5000, gain: 1.5, q: 1.2, type: "peak" }, { freq: 12000, gain: 2.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -18, ratio: 3, attack: 10, release: 150, knee: 4, makeupGain: 3 }, stereoWidth: 115, limiter: { ceiling: -0.3, release: 80, lookahead: 3 }, targetLUFS: -14 },
  { id: "edm-club", name: "EDM Club", tag: "EDM", desc: "Maximum energy, floor-ready", inputGain: 0, noiseGate: { enabled: true, threshold: -50, attack: 2, hold: 50, release: 100, range: 30 }, parametricEQ: [{ freq: 60, gain: 2.0, q: 0.8, type: "lowShelf" }, { freq: 200, gain: -2.0, q: 1.5, type: "peak" }, { freq: 1000, gain: 0, q: 1.0, type: "peak" }, { freq: 4000, gain: 1.5, q: 1.2, type: "peak" }, { freq: 10000, gain: 3.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -12, ratio: 4, attack: 5, release: 100, knee: 2, makeupGain: 4 }, stereoWidth: 130, limiter: { ceiling: -0.1, release: 50, lookahead: 5 }, targetLUFS: -6 },
  { id: "hiphop-trap", name: "Hip-Hop / Trap", tag: "HIP-HOP", desc: "Heavy sub, punchy drums", inputGain: 0, noiseGate: { enabled: false, threshold: -55, attack: 3, hold: 80, release: 150, range: 35 }, parametricEQ: [{ freq: 50, gain: 3.0, q: 0.9, type: "lowShelf" }, { freq: 300, gain: -1.5, q: 1.3, type: "peak" }, { freq: 800, gain: -0.5, q: 1.0, type: "peak" }, { freq: 3500, gain: 1.0, q: 1.5, type: "peak" }, { freq: 9000, gain: 2.0, q: 0.8, type: "highShelf" }], compressor: { enabled: true, threshold: -15, ratio: 4, attack: 8, release: 120, knee: 3, makeupGain: 3.5 }, stereoWidth: 110, limiter: { ceiling: -0.1, release: 60, lookahead: 4 }, targetLUFS: -9 },
  { id: "rock-punch", name: "Rock Punch", tag: "ROCK", desc: "Guitar presence, punchy transients", inputGain: 0, noiseGate: { enabled: true, threshold: -45, attack: 5, hold: 120, release: 250, range: 45 }, parametricEQ: [{ freq: 100, gain: 1.0, q: 0.7, type: "lowShelf" }, { freq: 350, gain: -2.0, q: 1.2, type: "peak" }, { freq: 2500, gain: 2.5, q: 1.8, type: "peak" }, { freq: 6000, gain: 1.5, q: 1.0, type: "peak" }, { freq: 14000, gain: 1.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -20, ratio: 3.5, attack: 15, release: 200, knee: 5, makeupGain: 4 }, stereoWidth: 105, limiter: { ceiling: -0.3, release: 100, lookahead: 3 }, targetLUFS: -11 },
  { id: "metal-wall", name: "Metal Wall", tag: "METAL", desc: "Aggressive, dense, maximum impact", inputGain: 0, noiseGate: { enabled: true, threshold: -40, attack: 1, hold: 60, release: 150, range: 50 }, parametricEQ: [{ freq: 80, gain: 2.0, q: 0.8, type: "lowShelf" }, { freq: 400, gain: -3.0, q: 1.4, type: "peak" }, { freq: 3000, gain: 3.0, q: 2.0, type: "peak" }, { freq: 7000, gain: 1.5, q: 1.2, type: "peak" }, { freq: 15000, gain: 1.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -10, ratio: 6, attack: 5, release: 80, knee: 2, makeupGain: 5 }, stereoWidth: 95, limiter: { ceiling: -0.1, release: 40, lookahead: 5 }, targetLUFS: -8 },
  { id: "jazz-natural", name: "Jazz Natural", tag: "JAZZ", desc: "Dynamics preserved, warm tone", inputGain: 0, noiseGate: { enabled: false, threshold: -65, attack: 20, hold: 200, release: 500, range: 20 }, parametricEQ: [{ freq: 120, gain: 0.5, q: 0.7, type: "lowShelf" }, { freq: 500, gain: 0, q: 1.0, type: "peak" }, { freq: 2000, gain: -0.5, q: 1.5, type: "peak" }, { freq: 6000, gain: 0.5, q: 1.0, type: "peak" }, { freq: 12000, gain: 0.5, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -28, ratio: 1.5, attack: 40, release: 400, knee: 8, makeupGain: 1.5 }, stereoWidth: 100, limiter: { ceiling: -0.5, release: 200, lookahead: 2 }, targetLUFS: -18 },
  { id: "classical-ref", name: "Classical Ref", tag: "CLASSICAL", desc: "Transparent, dynamics first", inputGain: 0, noiseGate: { enabled: false, threshold: -70, attack: 30, hold: 300, release: 800, range: 15 }, parametricEQ: [{ freq: 40, gain: -1.0, q: 0.7, type: "lowShelf" }, { freq: 200, gain: -0.5, q: 1.0, type: "peak" }, { freq: 1500, gain: 0, q: 1.5, type: "peak" }, { freq: 8000, gain: 0.5, q: 1.0, type: "peak" }, { freq: 16000, gain: 0.5, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -35, ratio: 1.2, attack: 80, release: 600, knee: 10, makeupGain: 1 }, stereoWidth: 100, limiter: { ceiling: -1.0, release: 300, lookahead: 2 }, targetLUFS: -23 },
  { id: "rnb-smooth", name: "R&B Smooth", tag: "R&B", desc: "Warm lows, silky highs, groovy", inputGain: 0, noiseGate: { enabled: false, threshold: -55, attack: 8, hold: 100, release: 200, range: 30 }, parametricEQ: [{ freq: 70, gain: 2.5, q: 0.9, type: "lowShelf" }, { freq: 300, gain: -1.0, q: 1.3, type: "peak" }, { freq: 1000, gain: 0.5, q: 1.5, type: "peak" }, { freq: 4500, gain: 1.0, q: 1.2, type: "peak" }, { freq: 11000, gain: 1.5, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -16, ratio: 2.5, attack: 12, release: 160, knee: 5, makeupGain: 2.5 }, stereoWidth: 120, limiter: { ceiling: -0.2, release: 70, lookahead: 4 }, targetLUFS: -13 },
  { id: "lofi-vinyl", name: "Lo-Fi Vinyl", tag: "LO-FI", desc: "Warm, dusty, nostalgic feel", inputGain: -2, noiseGate: { enabled: false, threshold: -60, attack: 10, hold: 100, release: 300, range: 20 }, parametricEQ: [{ freq: 100, gain: 2.0, q: 0.8, type: "lowShelf" }, { freq: 800, gain: -1.0, q: 1.2, type: "peak" }, { freq: 3000, gain: -2.0, q: 1.5, type: "peak" }, { freq: 7000, gain: -3.0, q: 1.0, type: "peak" }, { freq: 12000, gain: -4.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -22, ratio: 3, attack: 20, release: 250, knee: 6, makeupGain: 3 }, stereoWidth: 85, limiter: { ceiling: -1.0, release: 120, lookahead: 2 }, targetLUFS: -18 },
  { id: "synth-wave", name: "Synthwave", tag: "SYNTH", desc: "Retro analog warmth, gated reverb", inputGain: 0, noiseGate: { enabled: true, threshold: -50, attack: 3, hold: 80, release: 120, range: 35 }, parametricEQ: [{ freq: 80, gain: 1.5, q: 0.8, type: "lowShelf" }, { freq: 400, gain: -1.5, q: 1.3, type: "peak" }, { freq: 2000, gain: 1.5, q: 1.5, type: "peak" }, { freq: 6000, gain: 2.0, q: 1.0, type: "peak" }, { freq: 13000, gain: 2.5, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -14, ratio: 3.5, attack: 6, release: 120, knee: 3, makeupGain: 3 }, stereoWidth: 125, limiter: { ceiling: -0.1, release: 60, lookahead: 4 }, targetLUFS: -10 },
  { id: "ambient-space", name: "Ambient Space", tag: "AMBIENT", desc: "Spacious, wide, gentle dynamics", inputGain: 0, noiseGate: { enabled: false, threshold: -65, attack: 50, hold: 500, release: 1000, range: 15 }, parametricEQ: [{ freq: 60, gain: -2.0, q: 0.7, type: "lowShelf" }, { freq: 300, gain: -1.0, q: 1.2, type: "peak" }, { freq: 1500, gain: 0, q: 1.5, type: "peak" }, { freq: 8000, gain: 1.5, q: 1.0, type: "peak" }, { freq: 16000, gain: 2.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -30, ratio: 1.5, attack: 100, release: 800, knee: 10, makeupGain: 2 }, stereoWidth: 150, limiter: { ceiling: -0.5, release: 300, lookahead: 2 }, targetLUFS: -20 },
  { id: "reggae-dub", name: "Reggae / Dub", tag: "REGGAE", desc: "Deep bass, spacious reverb tails", inputGain: 0, noiseGate: { enabled: false, threshold: -58, attack: 5, hold: 100, release: 200, range: 25 }, parametricEQ: [{ freq: 60, gain: 3.5, q: 0.9, type: "lowShelf" }, { freq: 400, gain: -2.0, q: 1.3, type: "peak" }, { freq: 1500, gain: -1.0, q: 1.5, type: "peak" }, { freq: 5000, gain: 0.5, q: 1.0, type: "peak" }, { freq: 10000, gain: 1.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -18, ratio: 3, attack: 15, release: 200, knee: 5, makeupGain: 3 }, stereoWidth: 110, limiter: { ceiling: -0.2, release: 80, lookahead: 3 }, targetLUFS: -14 },
  { id: "country-warm", name: "Country Warm", tag: "COUNTRY", desc: "Natural, warm, open dynamics", inputGain: 0, noiseGate: { enabled: false, threshold: -60, attack: 10, hold: 150, release: 300, range: 25 }, parametricEQ: [{ freq: 100, gain: 1.0, q: 0.7, type: "lowShelf" }, { freq: 400, gain: -1.0, q: 1.2, type: "peak" }, { freq: 2000, gain: 1.5, q: 1.8, type: "peak" }, { freq: 6000, gain: 1.0, q: 1.0, type: "peak" }, { freq: 13000, gain: 1.5, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -22, ratio: 2.5, attack: 25, release: 300, knee: 6, makeupGain: 2.5 }, stereoWidth: 105, limiter: { ceiling: -0.5, release: 120, lookahead: 3 }, targetLUFS: -16 },
  { id: "latin-hot", name: "Latin Hot", tag: "LATIN", desc: "Rhythmic punch, warm brass", inputGain: 0, noiseGate: { enabled: false, threshold: -55, attack: 5, hold: 80, release: 150, range: 30 }, parametricEQ: [{ freq: 80, gain: 1.5, q: 0.8, type: "lowShelf" }, { freq: 350, gain: -1.5, q: 1.3, type: "peak" }, { freq: 1500, gain: 1.5, q: 1.5, type: "peak" }, { freq: 5000, gain: 1.0, q: 1.2, type: "peak" }, { freq: 11000, gain: 2.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -16, ratio: 3, attack: 10, release: 150, knee: 4, makeupGain: 3 }, stereoWidth: 115, limiter: { ceiling: -0.2, release: 70, lookahead: 4 }, targetLUFS: -13 },
  { id: "funk-groove", name: "Funk Groove", tag: "FUNK", desc: "Punchy bass, snappy transients", inputGain: 0, noiseGate: { enabled: false, threshold: -52, attack: 3, hold: 60, release: 120, range: 30 }, parametricEQ: [{ freq: 90, gain: 2.0, q: 0.9, type: "lowShelf" }, { freq: 500, gain: -1.5, q: 1.2, type: "peak" }, { freq: 2500, gain: 1.5, q: 1.8, type: "peak" }, { freq: 7000, gain: 1.0, q: 1.0, type: "peak" }, { freq: 12000, gain: 1.5, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -16, ratio: 3.5, attack: 8, release: 130, knee: 3, makeupGain: 3 }, stereoWidth: 110, limiter: { ceiling: -0.2, release: 65, lookahead: 4 }, targetLUFS: -12 },
  { id: "vocal-polish", name: "Vocal Polish", tag: "VOCAL", desc: "Presence boost, de-ess ready", inputGain: 0, noiseGate: { enabled: true, threshold: -48, attack: 5, hold: 80, release: 200, range: 40 }, parametricEQ: [{ freq: 120, gain: -2.0, q: 0.7, type: "lowShelf" }, { freq: 350, gain: -1.5, q: 1.2, type: "peak" }, { freq: 2500, gain: 2.0, q: 1.5, type: "peak" }, { freq: 8000, gain: 1.5, q: 1.2, type: "peak" }, { freq: 14000, gain: 1.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -20, ratio: 3, attack: 8, release: 180, knee: 5, makeupGain: 3 }, stereoWidth: 100, limiter: { ceiling: -0.5, release: 90, lookahead: 3 }, targetLUFS: -16 },
  { id: "podcast-voice", name: "Podcast Voice", tag: "PODCAST", desc: "Clear speech, broadcast ready", inputGain: 0, noiseGate: { enabled: true, threshold: -42, attack: 3, hold: 100, release: 300, range: 50 }, parametricEQ: [{ freq: 100, gain: -3.0, q: 0.7, type: "lowShelf" }, { freq: 300, gain: -2.0, q: 1.2, type: "peak" }, { freq: 2000, gain: 2.5, q: 1.5, type: "peak" }, { freq: 7000, gain: 1.0, q: 1.0, type: "peak" }, { freq: 15000, gain: -1.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -18, ratio: 4, attack: 5, release: 100, knee: 3, makeupGain: 4 }, stereoWidth: 100, limiter: { ceiling: -1.0, release: 60, lookahead: 3 }, targetLUFS: -16 },
  { id: "spoken-word", name: "Spoken Word", tag: "SPOKEN", desc: "Intimate voice, natural warmth", inputGain: 0, noiseGate: { enabled: true, threshold: -45, attack: 5, hold: 120, release: 400, range: 45 }, parametricEQ: [{ freq: 80, gain: -4.0, q: 0.7, type: "lowShelf" }, { freq: 250, gain: -1.5, q: 1.2, type: "peak" }, { freq: 1800, gain: 2.0, q: 1.5, type: "peak" }, { freq: 6000, gain: 0.5, q: 1.0, type: "peak" }, { freq: 13000, gain: -0.5, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -22, ratio: 3, attack: 10, release: 200, knee: 5, makeupGain: 3 }, stereoWidth: 100, limiter: { ceiling: -1.5, release: 80, lookahead: 2 }, targetLUFS: -19 },
  { id: "streaming-safe", name: "Streaming Safe", tag: "STREAMING", desc: "Perfectly normalized for all platforms", inputGain: 0, noiseGate: { enabled: false, threshold: -60, attack: 10, hold: 150, release: 300, range: 25 }, parametricEQ: [{ freq: 80, gain: -1.0, q: 0.7, type: "lowShelf" }, { freq: 300, gain: -0.5, q: 1.2, type: "peak" }, { freq: 1000, gain: 0, q: 1.5, type: "peak" }, { freq: 5000, gain: 0.5, q: 1.0, type: "peak" }, { freq: 12000, gain: 1.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -24, ratio: 2, attack: 20, release: 250, knee: 7, makeupGain: 2 }, stereoWidth: 100, limiter: { ceiling: -1.0, release: 100, lookahead: 3 }, targetLUFS: -14 },
  { id: "hifi-audiophile", name: "HiFi Audiophile", tag: "HIFI", desc: "Maximum resolution, gentle touch", inputGain: 0, noiseGate: { enabled: false, threshold: -70, attack: 30, hold: 300, release: 800, range: 10 }, parametricEQ: [{ freq: 50, gain: -1.0, q: 0.7, type: "lowShelf" }, { freq: 300, gain: -0.5, q: 1.0, type: "peak" }, { freq: 2000, gain: 0, q: 1.5, type: "peak" }, { freq: 10000, gain: 0.5, q: 1.0, type: "peak" }, { freq: 18000, gain: 1.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -32, ratio: 1.3, attack: 60, release: 500, knee: 10, makeupGain: 1 }, stereoWidth: 100, limiter: { ceiling: -0.5, release: 200, lookahead: 2 }, targetLUFS: -18 },
  { id: "video-sync", name: "Video Sync", tag: "VIDEO", desc: "Dialogue-safe, broadcast spec", inputGain: -1, noiseGate: { enabled: true, threshold: -50, attack: 5, hold: 100, release: 200, range: 35 }, parametricEQ: [{ freq: 100, gain: -2.0, q: 0.7, type: "lowShelf" }, { freq: 400, gain: -1.0, q: 1.2, type: "peak" }, { freq: 2500, gain: 1.5, q: 1.5, type: "peak" }, { freq: 8000, gain: 0.5, q: 1.0, type: "peak" }, { freq: 15000, gain: -1.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -20, ratio: 3, attack: 10, release: 150, knee: 5, makeupGain: 3 }, stereoWidth: 100, limiter: { ceiling: -1.0, release: 80, lookahead: 4 }, targetLUFS: -23 },
  { id: "club-night", name: "Club Night", tag: "CLUB", desc: "Beatport-ready, max headroom dance", inputGain: 0, noiseGate: { enabled: true, threshold: -48, attack: 2, hold: 40, release: 80, range: 30 }, parametricEQ: [{ freq: 55, gain: 3.0, q: 0.9, type: "lowShelf" }, { freq: 250, gain: -2.5, q: 1.4, type: "peak" }, { freq: 1200, gain: 0.5, q: 1.5, type: "peak" }, { freq: 5000, gain: 2.0, q: 1.2, type: "peak" }, { freq: 12000, gain: 3.5, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -10, ratio: 5, attack: 4, release: 80, knee: 2, makeupGain: 4.5 }, stereoWidth: 120, limiter: { ceiling: -0.1, release: 40, lookahead: 6 }, targetLUFS: -6 },
  { id: "vintage-tape", name: "Vintage Tape", tag: "VINTAGE", desc: "Analog warmth, harmonic saturation", inputGain: 0, noiseGate: { enabled: false, threshold: -60, attack: 15, hold: 150, release: 400, range: 20 }, parametricEQ: [{ freq: 100, gain: 2.5, q: 0.8, type: "lowShelf" }, { freq: 600, gain: -1.0, q: 1.2, type: "peak" }, { freq: 2500, gain: -1.5, q: 1.5, type: "peak" }, { freq: 8000, gain: -2.5, q: 1.0, type: "peak" }, { freq: 14000, gain: -4.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -20, ratio: 2.5, attack: 25, release: 300, knee: 7, makeupGain: 3 }, stereoWidth: 90, limiter: { ceiling: -0.5, release: 130, lookahead: 2 }, targetLUFS: -16 },
  { id: "bright-master", name: "Bright Master", tag: "BRIGHT", desc: "Airy highs, translation on small speakers", inputGain: 0, noiseGate: { enabled: false, threshold: -58, attack: 8, hold: 100, release: 200, range: 25 }, parametricEQ: [{ freq: 80, gain: -1.5, q: 0.7, type: "lowShelf" }, { freq: 400, gain: -1.0, q: 1.2, type: "peak" }, { freq: 3000, gain: 2.0, q: 1.5, type: "peak" }, { freq: 8000, gain: 3.0, q: 1.2, type: "peak" }, { freq: 15000, gain: 4.0, q: 0.7, type: "highShelf" }], compressor: { enabled: true, threshold: -18, ratio: 2.5, attack: 12, release: 180, knee: 5, makeupGain: 2.5 }, stereoWidth: 115, limiter: { ceiling: -0.3, release: 80, lookahead: 3 }, targetLUFS: -14 },
  { id: "reference-flat", name: "Reference Flat", tag: "REFERENCE", desc: "Transparent — hear your mix as-is", inputGain: 0, noiseGate: { enabled: false, threshold: -70, attack: 10, hold: 100, release: 200, range: 0 }, parametricEQ: [{ freq: 80, gain: 0, q: 0.7, type: "lowShelf" }, { freq: 300, gain: 0, q: 1.0, type: "peak" }, { freq: 1000, gain: 0, q: 1.0, type: "peak" }, { freq: 5000, gain: 0, q: 1.0, type: "peak" }, { freq: 12000, gain: 0, q: 0.7, type: "highShelf" }], compressor: { enabled: false, threshold: -30, ratio: 1.1, attack: 30, release: 300, knee: 8, makeupGain: 0 }, stereoWidth: 100, limiter: { ceiling: -0.1, release: 150, lookahead: 2 }, targetLUFS: -14 },
];

export const TAG_COLORS: Record<string, string> = {
  POP: "#E8A020", EDM: "#20C8E8", "HIP-HOP": "#A820E8", ROCK: "#E84020",
  METAL: "#808090", JAZZ: "#20A860", CLASSICAL: "#8090E8", "R&B": "#E86020",
  "LO-FI": "#A09050", SYNTH: "#8020E8", AMBIENT: "#2080A8", REGGAE: "#20A820",
  COUNTRY: "#C89040", LATIN: "#E82060", FUNK: "#E8A040", VOCAL: "#40E8A8",
  PODCAST: "#6080A8", SPOKEN: "#7090B0", STREAMING: "#40C080", HIFI: "#C0C0E0",
  VIDEO: "#80A0C0", CLUB: "#E840A8", VINTAGE: "#A87040", BRIGHT: "#E8E040",
  REFERENCE: "#909090",
};

export const PLATFORM_TARGETS: Record<string, { lufs: number; ceiling: number }> = {
  Spotify:       { lufs: -14, ceiling: -1.0 },
  "Apple Music": { lufs: -16, ceiling: -1.0 },
  YouTube:       { lufs: -14, ceiling: -1.0 },
  Tidal:         { lufs: -14, ceiling: -1.0 },
  Beatport:      { lufs: -6,  ceiling: -0.1 },
  Podcast:       { lufs: -16, ceiling: -1.0 },
  CD:            { lufs: -9,  ceiling: -0.3 },
  SoundCloud:    { lufs: -14, ceiling: -1.0 },
};

export const ALL_TAGS = [...new Set(MASTER_PRESETS.map(p => p.tag))];
