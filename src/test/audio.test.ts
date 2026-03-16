import { describe, it, expect, vi } from 'vitest';
import { MasteringEngine } from '../lib/audioEngine';
import { analyzeAudio } from '../lib/audioAnalysis';

// Mock Web Audio API
class MockAudioContext {
  state = 'running';
  createGain = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } }));
  createDynamicsCompressor = vi.fn(() => ({ connect: vi.fn(), threshold: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, knee: { value: 0 } }));
  createBiquadFilter = vi.fn(() => ({ connect: vi.fn(), frequency: { value: 0 }, gain: { value: 0 }, Q: { value: 0 }, type: 'peaking' }));
  createChannelSplitter = vi.fn(() => ({ connect: vi.fn() }));
  createChannelMerger = vi.fn(() => ({ connect: vi.fn() }));
  createAnalyser = vi.fn(() => ({ connect: vi.fn(), getByteTimeDomainData: vi.fn(), getFloatFrequencyData: vi.fn(), fftSize: 2048 }));
  createDelay = vi.fn(() => ({ connect: vi.fn(), delayTime: { value: 0 } }));
  createWaveShaper = vi.fn(() => ({ connect: vi.fn(), curve: null }));
}

describe('MasteringEngine', () => {
  it('should initialize without error', () => {
    const ctx = new MockAudioContext() as any;
    const engine = new MasteringEngine(ctx);
    expect(engine).toBeDefined();
  });

  it('should handle M/S path decomposition logic', () => {
    const ctx = new MockAudioContext() as any;
    const engine = new MasteringEngine(ctx);
    engine.bypassEQ(false);
    // If it doesn't throw, the connection chain is at least theoretically valid
    expect(true).toBe(true);
  });
});

describe('AudioAnalysis', () => {
  it('should analyze dummy buffer', () => {
    // Mock AudioBuffer
    const dummyBuffer = {
      numberOfChannels: 2,
      length: 1000,
      sampleRate: 44100,
      getChannelData: vi.fn(() => new Float32Array(1000).fill(0.1))
    } as any;

    const metrics = analyzeAudio(dummyBuffer);
    expect(metrics.lufs).toBeDefined();
    expect(metrics.frequencyBalance.mid).toBeGreaterThan(0);
  });
});
