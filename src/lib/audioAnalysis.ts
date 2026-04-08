/**
 * Audio analysis utilities for extracting metrics from an AudioBuffer
 */

export interface AudioMetrics {
  lufs: number;
  truePeak: number;
  dynamicRange: number;
  lra: number;
  crestFactor: number;
  noiseFloor: number;
  transientDensity: number;
  frequencyBalance: {
    sub: number;
    bass: number;
    mid: number;
    highMid: number;
    air: number;
  };
  stereoCorrelation: number;
  stereoWidth: number;
  isMono: boolean;
  issues: string[];
  estimatedGenre: string;
}

export function analyzeAudio(buffer: AudioBuffer): AudioMetrics {
  const sampleRate = buffer.sampleRate;
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const isMono = buffer.numberOfChannels === 1;
  const length = left.length;

  // True Peak
  let truePeak = 0;
  for (let i = 0; i < length; i++) {
    const absL = Math.abs(left[i]);
    const absR = Math.abs(right[i]);
    if (absL > truePeak) truePeak = absL;
    if (absR > truePeak) truePeak = absR;
  }
  const truePeakDb = 20 * Math.log10(truePeak || 0.0001);

  // RMS and LUFS approximation
  let sumSquares = 0;
  for (let i = 0; i < length; i++) {
    const mid = (left[i] + right[i]) / 2;
    sumSquares += mid * mid;
  }
  const rms = Math.sqrt(sumSquares / length);
  const rmsDb = 20 * Math.log10(rms || 0.0001);
  const lufs = rmsDb - 0.691; // Simplified LUFS approximation

  // Dynamic Range
  const windowSize = Math.floor(sampleRate * 0.4); // 400ms windows
  const windowRms: number[] = [];
  for (let i = 0; i < length - windowSize; i += windowSize) {
    let wSum = 0;
    for (let j = 0; j < windowSize; j++) {
      const mid = (left[i + j] + right[i + j]) / 2;
      wSum += mid * mid;
    }
    windowRms.push(Math.sqrt(wSum / windowSize));
  }
  windowRms.sort((a, b) => a - b);
  const dr10 = windowRms[Math.floor(windowRms.length * 0.1)] || 0.0001;
  const dr95 = windowRms[Math.floor(windowRms.length * 0.95)] || 0.0001;
  const dynamicRange = 20 * Math.log10(dr95 / dr10);
  const lra = Math.abs(20 * Math.log10(dr95) - 20 * Math.log10(dr10));

  // Crest Factor
  const crestFactor = truePeakDb - rmsDb;

  // Noise Floor (quietest 5%)
  const noiseIdx = Math.floor(windowRms.length * 0.05);
  const noiseFloor = 20 * Math.log10(windowRms[noiseIdx] || 0.0001);

  // Transient density
  const shortWindow = Math.floor(sampleRate * 0.01); // 10ms
  let transients = 0;
  let prevRms = 0;
  for (let i = 0; i < length - shortWindow; i += shortWindow) {
    let wSum = 0;
    for (let j = 0; j < shortWindow; j++) {
      wSum += left[i + j] * left[i + j];
    }
    const wRms = 20 * Math.log10(Math.sqrt(wSum / shortWindow) || 0.0001);
    if (wRms - prevRms > 6) transients++;
    prevRms = wRms;
  }
  const transientDensity = transients / buffer.duration;

  // Frequency balance via FFT
  const fftSize = 2048;
  const offlineCtx = new OfflineAudioContext(1, fftSize, sampleRate);
  // Simple frequency analysis using manual DFT on a chunk
  const chunk = left.slice(0, Math.min(fftSize * 16, length));
  const bands = { sub: 0, bass: 0, mid: 0, highMid: 0, air: 0 };
  const totalChunkEnergy = chunk.reduce((s, v) => s + v * v, 0);

  // Rough band energy estimation using bandpass filtering approximation
  const freqBins = fftSize / 2;
  const binWidth = sampleRate / fftSize;
  
  // Use simple energy distribution heuristic based on spectral content
  const analyzeChunk = new Float32Array(fftSize);
  for (let i = 0; i < Math.min(fftSize, chunk.length); i++) {
    analyzeChunk[i] = chunk[i];
  }
  
  // Apply Hann window
  for (let i = 0; i < fftSize; i++) {
    analyzeChunk[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / fftSize));
  }

  // Manual DFT for key frequencies
  const getEnergyAtFreq = (targetFreq: number): number => {
    const bin = Math.round(targetFreq / binWidth);
    if (bin >= freqBins) return 0;
    let real = 0, imag = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = -2 * Math.PI * bin * n / fftSize;
      real += analyzeChunk[n] * Math.cos(angle);
      imag += analyzeChunk[n] * Math.sin(angle);
    }
    return real * real + imag * imag;
  };

  // Sample key frequencies per band
  const subFreqs = [20, 40, 60, 80];
  const bassFreqs = [100, 150, 200, 250, 300];
  const midFreqs = [500, 800, 1000, 1500, 2000, 2500, 3000];
  const hiMidFreqs = [3500, 4000, 5000, 6000, 7000, 8000];
  const airFreqs = [9000, 10000, 12000, 14000, 16000];

  const sumEnergy = (freqs: number[]) => freqs.reduce((s, f) => s + getEnergyAtFreq(f), 0);
  
  const subE = sumEnergy(subFreqs);
  const bassE = sumEnergy(bassFreqs);
  const midE = sumEnergy(midFreqs);
  const hiMidE = sumEnergy(hiMidFreqs);
  const airE = sumEnergy(airFreqs);
  const totalE = subE + bassE + midE + hiMidE + airE || 1;

  bands.sub = Math.round((subE / totalE) * 100);
  bands.bass = Math.round((bassE / totalE) * 100);
  bands.mid = Math.round((midE / totalE) * 100);
  bands.highMid = Math.round((hiMidE / totalE) * 100);
  bands.air = Math.round((airE / totalE) * 100);

  // Stereo correlation
  let sumLR = 0, sumL2 = 0, sumR2 = 0;
  for (let i = 0; i < length; i++) {
    sumLR += left[i] * right[i];
    sumL2 += left[i] * left[i];
    sumR2 += right[i] * right[i];
  }
  const stereoCorrelation = isMono ? 1.0 : sumLR / Math.sqrt(sumL2 * sumR2 || 1);

  // Stereo width
  let sumDiff2 = 0, sumSum2 = 0;
  for (let i = 0; i < length; i++) {
    const diff = left[i] - right[i];
    const sum = left[i] + right[i];
    sumDiff2 += diff * diff;
    sumSum2 += sum * sum;
  }
  const stereoWidth = isMono ? 0 : Math.round((Math.sqrt(sumDiff2) / Math.sqrt(sumSum2 || 1)) * 100);

  // Issues detection
  const issues: string[] = [];
  if (truePeakDb > 0) issues.push('clipping detected');
  if (stereoCorrelation < 0) issues.push('phase issues');
  if (bands.bass > 35 && bands.mid > 30) issues.push('muddy low-mids');
  if (bands.highMid > 40) issues.push('harsh high-mids');
  if (bands.sub + bands.bass < 15) issues.push('weak bass');
  if (issues.length === 0) issues.push('none');

  // Genre heuristics
  const genreScores: Record<string, number> = {
    'EDM/Electronic': (bands.sub > 25 && transientDensity > 4 ? 40 : 0),
    'Hip-Hop/Trap': (bands.sub > 20 && bands.mid < 40 ? 35 : 0),
    'Rock/Metal': (bands.mid > 45 && crestFactor < 12 ? 35 : 0),
    'Jazz/Acoustic': (dynamicRange > 14 && bands.air > 15 ? 40 : 0),
    'Classical': (dynamicRange > 18 && stereoCorrelation > 0.8 ? 50 : 0),
    'Ambient': (transientDensity < 1 && lra > 12 ? 45 : 0),
    'Pop': (lufs > -14 && lufs < -9 && bands.mid > 30 && bands.mid < 50 ? 30 : 0),
  };

  let maxGenre = 'Mixed/Unknown';
  let maxScore = 0;
  for (const [genre, score] of Object.entries(genreScores)) {
    if (score > maxScore) {
      maxScore = score;
      maxGenre = genre;
    }
  }

  return {
    lufs: Math.round(lufs * 10) / 10,
    truePeak: Math.round(truePeakDb * 10) / 10,
    dynamicRange: Math.round(dynamicRange * 10) / 10,
    lra: Math.round(lra * 10) / 10,
    crestFactor: Math.round(crestFactor * 10) / 10,
    noiseFloor: Math.round(noiseFloor * 10) / 10,
    transientDensity: Math.round(transientDensity * 10) / 10,
    frequencyBalance: bands,
    stereoCorrelation: Math.round(stereoCorrelation * 100) / 100,
    stereoWidth,
    isMono,
    issues,
    estimatedGenre: maxGenre,
  };
}

/**
 * UNIQUE FEATURE: Tonal Match
 * Compares source and reference to find an EQ correction curve
 */
export function calculateTonalMatch(source: AudioBuffer, reference: AudioBuffer): { freq: number; gain: number }[] {
  const getBands = (buf: AudioBuffer) => {
    const data = buf.getChannelData(0);
    const fftSize = 4096;
    const bins = new Float32Array(5); // Sub, Bass, Mid, HighMid, Air
    // Very coarse FFT simulation for matching
    const metrics = analyzeAudio(buf);
    return [
      metrics.frequencyBalance.sub,
      metrics.frequencyBalance.bass,
      metrics.frequencyBalance.mid,
      metrics.frequencyBalance.highMid,
      metrics.frequencyBalance.air,
    ];
  };

  const sBands = getBands(source);
  const rBands = getBands(reference);
  const freqs = [60, 250, 1000, 4000, 12000];
  
  return freqs.map((f, i) => {
    const diff = rBands[i] - sBands[i];
    // Scale diff to usable EQ gains (-6 to +6)
    const gain = Math.max(-6, Math.min(6, diff * 0.2));
    return { freq: f, gain: Math.round(gain * 10) / 10 };
  });
}

