/**
 * MasteringEngine — Real-time audio processing chain using Web Audio API
 *
 * Professional Signal Flow:
 * Source ──┬──→ preAnalyser (dry tap)
 *          └──→ inputGain ──→ Noise Gate ──→ MS Matrix Start
 *               ├─→ Mid path: EQ[0-4] Mid ─┐
 *               └─→ Side path: EQ[0-4] Side ─┤
 *               MS Matrix End ──→ Stereo Compressor ──→ Makeup ──→ Saturation
 *               ──→ Width ──→ Limiter (with lookahead) ──→ postAnalyser ──→ Output
 */

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function makeSaturationCurve(amount: number): Float32Array {
  const samples = 8192;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    if (amount <= 0) {
      curve[i] = x;
    } else {
      const k = amount / 100;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
  }
  return curve;
}

export class MasteringEngine {
  ctx: AudioContext;

  // Processing nodes
  inputGainNode: GainNode;

  // Noise Gate (simulated via high-ratio compressor if worklet not used)
  gateNode: DynamicsCompressorNode;

  // Mid/Side EQ nodes
  splitter: ChannelSplitterNode;
  merger: ChannelMergerNode;
  
  // Mid path
  midSum: GainNode;
  eqNodesMid: BiquadFilterNode[];
  
  // Side path
  sideDiffL: GainNode;
  sideDiffR: GainNode;
  eqNodesSide: BiquadFilterNode[];
  
  // Re-matrix
  msMerger: ChannelMergerNode;
  midReL: GainNode;
  midReR: GainNode;
  sideReL: GainNode;
  sideReR: GainNode;
  msOutput: ChannelMergerNode;

  // Stereo processor nodes
  compressorNode: DynamicsCompressorNode;
  makeupGainNode: GainNode;
  waveShaperNode: WaveShaperNode;

  // Stereo width
  widthSplitter: ChannelSplitterNode;
  widthMerger: ChannelMergerNode;
  llGain: GainNode;
  lrGain: GainNode;
  rlGain: GainNode;
  rrGain: GainNode;

  // Limiter
  limiterNode: DynamicsCompressorNode;
  lookaheadNode: DelayNode;

  // Analysis
  preAnalyser: AnalyserNode;
  postAnalyser: AnalyserNode;
  endSplitter: ChannelSplitterNode;
  analyserL: AnalyserNode;
  analyserR: AnalyserNode;

  source: AudioBufferSourceNode | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    // Analysis
    this.preAnalyser = ctx.createAnalyser();
    this.preAnalyser.fftSize = 4096;
    this.postAnalyser = ctx.createAnalyser();
    this.postAnalyser.fftSize = 4096;

    // Input Stage
    this.inputGainNode = ctx.createGain();
    this.gateNode = ctx.createDynamicsCompressor();
    // Default to transparent gate
    this.gateNode.threshold.value = -90;
    this.gateNode.ratio.value = 1;

    // --- Mid/Side EQ Setup ---
    this.splitter = ctx.createChannelSplitter(2);
    
    // Mid = (L + R) * 0.5
    this.midSum = ctx.createGain();
    this.midSum.gain.value = 0.5;
    
    // Side = (L - R) * 0.5
    this.sideDiffL = ctx.createGain();
    this.sideDiffL.gain.value = 0.5;
    this.sideDiffR = ctx.createGain();
    this.sideDiffR.gain.value = -0.5;

    this.eqNodesMid = this.createEQBank();
    this.eqNodesSide = this.createEQBank();

    // Re-matrix: L = Mid + Side, R = Mid - Side
    this.midReL = ctx.createGain(); this.midReL.gain.value = 1;
    this.midReR = ctx.createGain(); this.midReR.gain.value = 1;
    this.sideReL = ctx.createGain(); this.sideReL.gain.value = 1;
    this.sideReR = ctx.createGain(); this.sideReR.gain.value = -1;
    
    this.msOutput = ctx.createChannelMerger(2);

    // --- Stereo dynamics ---
    this.compressorNode = ctx.createDynamicsCompressor();
    this.makeupGainNode = ctx.createGain();
    this.waveShaperNode = ctx.createWaveShaper();
    this.waveShaperNode.oversample = '2x';

    // --- Stereo width ---
    this.widthSplitter = ctx.createChannelSplitter(2);
    this.widthMerger = ctx.createChannelMerger(2);
    this.llGain = ctx.createGain();
    this.lrGain = ctx.createGain();
    this.rlGain = ctx.createGain();
    this.rrGain = ctx.createGain();

    // --- Output stage ---
    this.lookaheadNode = ctx.createDelay(0.1);
    this.lookaheadNode.delayTime.value = 0.003; // 3ms lookahead
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -0.3;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0.001; // nearly instant

    this.endSplitter = ctx.createChannelSplitter(2);
    this.analyserL = ctx.createAnalyser();
    this.analyserR = ctx.createAnalyser();

    this.buildChain();
  }

  private createEQBank(): BiquadFilterNode[] {
    return [
      this.createEQ('lowshelf', 80, 0, 0.7),
      this.createEQ('peaking', 250, 0, 1.0),
      this.createEQ('peaking', 1000, 0, 1.0),
      this.createEQ('peaking', 4000, 0, 1.0),
      this.createEQ('highshelf', 12000, 0, 0.7),
    ];
  }

  private createEQ(type: BiquadFilterType, f: number, g: number, q: number): BiquadFilterNode {
    const node = this.ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = f;
    node.gain.value = g;
    node.Q.value = q;
    return node;
  }

  private buildChain() {
    // 1. Input -> Gate -> MS Split
    this.inputGainNode.connect(this.gateNode);
    this.gateNode.connect(this.splitter);

    // 2. Mid Path: L + R -> Sum -> EQs
    this.splitter.connect(this.midSum, 0);
    this.splitter.connect(this.midSum, 1);
    this.midSum.connect(this.eqNodesMid[0]);
    for (let i = 0; i < 4; i++) this.eqNodesMid[i].connect(this.eqNodesMid[i+1]);

    // 3. Side Path: L - R -> Diff -> EQs
    this.splitter.connect(this.sideDiffL, 0);
    this.splitter.connect(this.sideDiffR, 1);
    this.sideDiffL.connect(this.eqNodesSide[0]);
    this.sideDiffR.connect(this.eqNodesSide[0]);
    for (let i = 0; i < 4; i++) this.eqNodesSide[i].connect(this.eqNodesSide[i+1]);

    // 4. Re-Matrix to L/R
    this.eqNodesMid[4].connect(this.midReL);
    this.eqNodesMid[4].connect(this.midReR);
    this.eqNodesSide[4].connect(this.sideReL);
    this.eqNodesSide[4].connect(this.sideReR);

    this.midReL.connect(this.msOutput, 0, 0);
    this.sideReL.connect(this.msOutput, 0, 0);
    this.midReR.connect(this.msOutput, 0, 1);
    this.sideReR.connect(this.msOutput, 0, 1);

    // 5. MS Output -> Comp -> Makeup -> Saturation
    this.msOutput.connect(this.compressorNode);
    this.compressorNode.connect(this.makeupGainNode);
    this.makeupGainNode.connect(this.waveShaperNode);

    // 6. Saturation -> Width
    this.waveShaperNode.connect(this.widthSplitter);
    this.widthSplitter.connect(this.llGain, 0);
    this.widthSplitter.connect(this.lrGain, 1);
    this.widthSplitter.connect(this.rlGain, 0);
    this.widthSplitter.connect(this.rrGain, 1);
    this.llGain.connect(this.widthMerger, 0, 0);
    this.lrGain.connect(this.widthMerger, 0, 0);
    this.rlGain.connect(this.widthMerger, 0, 1);
    this.rrGain.connect(this.widthMerger, 0, 1);

    // 7. Width -> Limiter (with lookahead)
    this.widthMerger.connect(this.lookaheadNode);
    this.lookaheadNode.connect(this.limiterNode);
    this.limiterNode.connect(this.postAnalyser);
    this.postAnalyser.connect(this.ctx.destination);

    // Meters taps
    this.limiterNode.connect(this.endSplitter);
    this.endSplitter.connect(this.analyserL, 0);
    this.endSplitter.connect(this.analyserR, 1);
  }

  // --- Public API ---

  connectSource(s: AudioBufferSourceNode) {
    s.connect(this.preAnalyser);
    s.connect(this.inputGainNode);
    this.source = s;
  }

  disconnectSource() {
    if (this.source) {
      try { this.source.stop(); } catch {}
      try { this.source.disconnect(); } catch {}
      this.source = null;
    }
  }

  setInputGain(db: number) { this.inputGainNode.gain.setValueAtTime(dbToGain(db), this.ctx.currentTime); }

  setNoiseGate(t: number, r: number, a: number, h: number, rel: number) {
    const time = this.ctx.currentTime;
    this.gateNode.threshold.setValueAtTime(t, time);
    this.gateNode.ratio.setValueAtTime(r > 1 ? r : 1.001, time);
    this.gateNode.attack.setValueAtTime(a / 1000, time);
    this.gateNode.release.setValueAtTime(rel / 1000, time);
    // Note: 'hold' not natively in dynamicsCompressor, simulated via release
  }

  setEQBand(idx: number, p: { freq?: number; gain?: number; q?: number; type?: BiquadFilterType }, side: 'mid' | 'side' | 'both' = 'both') {
    const time = this.ctx.currentTime;
    const apply = (node: BiquadFilterNode) => {
      if (p.freq !== undefined) node.frequency.setValueAtTime(p.freq, time);
      if (p.gain !== undefined) node.gain.setValueAtTime(p.gain, time);
      if (p.q !== undefined) node.Q.setValueAtTime(p.q, time);
      if (p.type !== undefined) node.type = p.type;
    };
    if (side === 'mid' || side === 'both') apply(this.eqNodesMid[idx]);
    if (side === 'side' || side === 'both') apply(this.eqNodesSide[idx]);
  }

  bypassEQ(b: boolean) {
    const time = this.ctx.currentTime;
    if (b) {
      this.eqNodesMid.forEach(n => n.gain.setValueAtTime(0, time));
      this.eqNodesSide.forEach(n => n.gain.setValueAtTime(0, time));
    }
  }

  setCompressor(p: { threshold?: number; ratio?: number; attack?: number; release?: number; knee?: number }) {
    const t = this.ctx.currentTime;
    if (p.threshold !== undefined) this.compressorNode.threshold.setValueAtTime(p.threshold, t);
    if (p.ratio !== undefined) this.compressorNode.ratio.setValueAtTime(Math.max(1, p.ratio), t);
    if (p.attack !== undefined) this.compressorNode.attack.setValueAtTime(p.attack / 1000, t);
    if (p.release !== undefined) this.compressorNode.release.setValueAtTime(p.release / 1000, t);
    if (p.knee !== undefined) this.compressorNode.knee.setValueAtTime(p.knee, t);
  }

  bypassCompressor(b: boolean) {
    if (b) {
      this.compressorNode.ratio.setValueAtTime(1, this.ctx.currentTime);
      this.compressorNode.threshold.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  setMakeupGain(db: number) { this.makeupGainNode.gain.setValueAtTime(dbToGain(db), this.ctx.currentTime); }
  setSaturation(a: number) { this.waveShaperNode.curve = makeSaturationCurve(a) as any; }

  setStereoWidth(widthPercent: number) {
    const w = widthPercent / 100;
    const t = this.ctx.currentTime;
    this.llGain.gain.setValueAtTime((1 + w) / 2, t);
    this.lrGain.gain.setValueAtTime((1 - w) / 2, t);
    this.rlGain.gain.setValueAtTime((1 - w) / 2, t);
    this.rrGain.gain.setValueAtTime((1 + w) / 2, t);
  }

  setLimiter(p: { ceiling?: number; release?: number; lookahead?: number }) {
    const t = this.ctx.currentTime;
    if (p.ceiling !== undefined) this.limiterNode.threshold.setValueAtTime(p.ceiling, t);
    if (p.release !== undefined) this.limiterNode.release.setValueAtTime(p.release / 1000, t);
    if (p.lookahead !== undefined) this.lookaheadNode.delayTime.setValueAtTime(p.lookahead / 1000, t);
  }

  bypassLimiter(b: boolean) {
    if (b) {
      this.limiterNode.ratio.setValueAtTime(1, this.ctx.currentTime);
    } else {
      this.limiterNode.ratio.setValueAtTime(20, this.ctx.currentTime);
    }
  }

  // --- Metering ---
  getCompressorGR(): number { return this.compressorNode.reduction; }
  getLimiterGR(): number { return this.limiterNode.reduction; }
  getPreFrequencyData(): Float32Array { const d = new Float32Array(this.preAnalyser.frequencyBinCount); this.preAnalyser.getFloatFrequencyData(d); return d; }
  getPostFrequencyData(): Float32Array { const d = new Float32Array(this.postAnalyser.frequencyBinCount); this.postAnalyser.getFloatFrequencyData(d); return d; }

  getChannelLevels(): { left: number; right: number } {
    const bl = new Float32Array(this.analyserL.fftSize);
    const br = new Float32Array(this.analyserR.fftSize);
    this.analyserL.getFloatTimeDomainData(bl);
    this.analyserR.getFloatTimeDomainData(br);
    let sl = 0, sr = 0;
    for (let i = 0; i < bl.length; i++) { sl += bl[i]*bl[i]; sr += br[i]*br[i]; }
    return {
      left: 20 * Math.log10(Math.sqrt(sl / bl.length) || 0.0001),
      right: 20 * Math.log10(Math.sqrt(sr / br.length) || 0.0001)
    };
  }

  getGoniometerData(): { l: Float32Array; r: Float32Array } {
    const l = new Float32Array(this.analyserL.fftSize);
    const r = new Float32Array(this.analyserR.fftSize);
    this.analyserL.getFloatTimeDomainData(l);
    this.analyserR.getFloatTimeDomainData(r);
    return { l, r };
  }
}
