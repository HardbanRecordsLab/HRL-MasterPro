import { useState } from 'react';
import { Download, FileArchive, FileText, Loader2, X, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudio } from '@/contexts/AudioContext';
import { PLATFORM_TARGETS } from '@/lib/masterPresets';
import { toast } from 'sonner';

// ============================================================
// WAV ENCODER
// ============================================================
function encodeWAV(samples: Float32Array[], sampleRate: number, bitDepth: number): Blob {
  const numSamples = samples[0].length;
  const numChannels = samples.length;
  const bytesPerSample = bitDepth === 32 ? 4 : bitDepth === 24 ? 3 : 2;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // 3=IEEE float, 1=PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data'); view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, samples[ch][i]));
      if (bitDepth === 32) {
        view.setFloat32(offset, s, true); offset += 4;
      } else if (bitDepth === 24) {
        const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7FFFFF);
        view.setUint8(offset, v & 0xFF); view.setUint8(offset + 1, (v >> 8) & 0xFF); view.setUint8(offset + 2, (v >> 16) & 0xFF);
        offset += 3;
      } else {
        view.setInt16(offset, Math.round(s < 0 ? s * 0x8000 : s * 0x7FFF), true); offset += 2;
      }
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function computeLUFS(ch0: Float32Array, ch1: Float32Array): number {
  let sum = 0; const len = ch0.length;
  for (let i = 0; i < len; i++) { const m = (ch0[i] + ch1[i]) / 2; sum += m * m; }
  const rms = Math.sqrt(sum / len);
  return rms > 0 ? 20 * Math.log10(rms) - 0.691 : -60;
}

function applyGainToChannels(channels: Float32Array[], gainDb: number): Float32Array[] {
  const g = Math.pow(10, gainDb / 20);
  return channels.map(ch => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) out[i] = Math.max(-1, Math.min(1, ch[i] * g));
    return out;
  });
}

async function renderOffline(
  audioBuffer: AudioBuffer,
  targetLUFS: number,
  targetCeiling: number,
  onProgress: (pct: number) => void
): Promise<Float32Array[]> {
  const sr = audioBuffer.sampleRate;
  const len = audioBuffer.length;
  const nch = audioBuffer.numberOfChannels;

  const off = new OfflineAudioContext(nch, len, sr);
  const src = off.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(off.destination);
  src.start(0);
  onProgress(10);

  const rendered = await off.startRendering();
  onProgress(60);

  let channels: Float32Array[] = [];
  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    channels.push(new Float32Array(rendered.getChannelData(ch)));
  }
  if (channels.length === 1) channels.push(channels[0]);

  // LUFS normalization
  const currentLUFS = computeLUFS(channels[0], channels[1]);
  const gainNeeded = targetLUFS - currentLUFS;
  const clampedGain = Math.min(3, gainNeeded);
  channels = applyGainToChannels(channels, clampedGain);
  onProgress(80);

  // True peak ceiling
  const ceilLin = Math.pow(10, targetCeiling / 20);
  channels = channels.map(ch => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) out[i] = Math.max(-ceilLin, Math.min(ceilLin, ch[i]));
    return out;
  });
  onProgress(95);
  return channels;
}

function buildID3(meta: Record<string, string>): Uint8Array {
  const frames: Uint8Array[] = [];
  const encFrame = (id: string, str: string): Uint8Array | null => {
    if (!str) return null;
    const bytes = new TextEncoder().encode(str);
    const frame = new Uint8Array(10 + 1 + bytes.length);
    for (let i = 0; i < 4; i++) frame[i] = id.charCodeAt(i);
    const size = 1 + bytes.length;
    frame[4] = (size >> 24) & 0xFF; frame[5] = (size >> 16) & 0xFF; frame[6] = (size >> 8) & 0xFF; frame[7] = size & 0xFF;
    frame[10] = 3; frame.set(bytes, 11);
    return frame;
  };
  const tags = [['TIT2', meta.title], ['TPE1', meta.artist], ['TALB', meta.album], ['TDRC', meta.year], ['TCON', meta.genre], ['TBPM', meta.bpm], ['TKEY', meta.key], ['TSRC', meta.isrc]];
  tags.forEach(([id, v]) => { const f = encFrame(id, v || ''); if (f) frames.push(f); });
  let totalSize = frames.reduce((s, f) => s + f.length, 0);
  const header = new Uint8Array(10);
  header[0] = 0x49; header[1] = 0x44; header[2] = 0x33; header[3] = 3; header[4] = 0; header[5] = 0;
  header[6] = (totalSize >> 21) & 0x7F; header[7] = (totalSize >> 14) & 0x7F;
  header[8] = (totalSize >> 7) & 0x7F; header[9] = totalSize & 0x7F;
  const parts = [header, ...frames];
  const full = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off2 = 0; parts.forEach(p => { full.set(p, off2); off2 += p.length; });
  return full;
}

// ============================================================
// FORMATS / PLATFORMS
// ============================================================
const FORMATS = [
  { id: 'wav24', label: 'WAV 24-bit', desc: 'Lossless master' },
  { id: 'wav16', label: 'WAV 16-bit', desc: 'CD standard' },
  { id: 'wavFloat', label: 'WAV 32f', desc: 'Archival' },
  { id: 'mp3320', label: 'MP3 320kbps', desc: 'Universal' },
  { id: 'mp3192', label: 'MP3 192kbps', desc: 'Streaming' },
];

const METADATA_FIELDS = [
  { k: 'title', w: 90 }, { k: 'artist', w: 80 }, { k: 'album', w: 75 },
  { k: 'genre', w: 60 }, { k: 'year', w: 42 }, { k: 'bpm', w: 38 }, { k: 'key', w: 38 },
] as const;

// ============================================================
// EXPORT PANEL
// ============================================================
const ExportPanel = () => {
  const { state, dispatch } = useAudio();
  const [showModal, setShowModal] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [isExporting, setIsExporting] = useState(false);

  const platform = PLATFORM_TARGETS[state.exportPlatform] ?? { lufs: -14, ceiling: -1.0 };

  const setFmtProgress = (fmt: string, pct: number) => {
    setProgressMap(prev => ({ ...prev, [fmt]: pct }));
  };

  const handleExport = async () => {
    if (!state.audioBuffer) {
      toast.error('No audio file loaded. Load a WAV, MP3 or FLAC first.');
      return;
    }
    if (state.exportFormats.length === 0) {
      toast.error('Select at least one export format.');
      return;
    }

    setIsExporting(true);
    setProgressMap({});
    const files: Record<string, Blob> = {};

    try {
      // Render
      setFmtProgress('render', 5);
      const channels = await renderOffline(
        state.audioBuffer,
        platform.lufs,
        platform.ceiling,
        p => setFmtProgress('render', p)
      );
      setFmtProgress('render', 100);

      const sr = state.audioBuffer.sampleRate;
      const basename = (state.exportMetadata.title || 'master').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const platName = state.exportPlatform.replace(/\s+/g, '_');

      // WAV formats
      for (const fmt of state.exportFormats.filter(f => f.startsWith('wav'))) {
        setFmtProgress(fmt, 10);
        const bits = fmt === 'wav16' ? 16 : fmt === 'wavFloat' ? 32 : 24;
        files[`${basename}_${platName}_${bits}bit.wav`] = encodeWAV(channels, sr, bits);
        setFmtProgress(fmt, 100);
      }

      // MP3 formats (via lamejs CDN)
      for (const fmt of state.exportFormats.filter(f => f.startsWith('mp3'))) {
        setFmtProgress(fmt, 5);
        try {
          if (typeof (window as unknown as Record<string, unknown>).lamejs === 'undefined') {
            await new Promise<void>((res, rej) => {
              const s = document.createElement('script');
              s.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
              s.onload = () => res(); s.onerror = () => rej(new Error('lamejs load failed'));
              document.head.appendChild(s);
            });
          }
          const kbps = fmt === 'mp3320' ? 320 : 192;
          const lamejs = (window as unknown as Record<string, unknown>).lamejs as { Mp3Encoder: new (ch: number, sr: number, kbps: number) => { encodeBuffer: (l: Int16Array, r: Int16Array) => Int8Array; flush: () => Int8Array } };
          const mp3enc = new lamejs.Mp3Encoder(2, sr, kbps);
          const L = channels[0], R = channels[1];
          const chunkSize = 1152;
          const mp3Data: (Uint8Array | Int8Array)[] = [buildID3({
            title: state.exportMetadata.title,
            artist: state.exportMetadata.artist,
            album: state.exportMetadata.album,
            year: state.exportMetadata.year,
            genre: state.exportMetadata.genre,
            bpm: state.exportMetadata.bpm,
            key: state.exportMetadata.key,
            isrc: state.exportMetadata.isrc,
          })];

          for (let i = 0; i < L.length; i += chunkSize) {
            const lc = new Int16Array(chunkSize);
            const rc = new Int16Array(chunkSize);
            for (let j = 0; j < chunkSize && (i + j) < L.length; j++) {
              lc[j] = Math.round(Math.max(-1, Math.min(1, L[i + j])) * 32767);
              rc[j] = Math.round(Math.max(-1, Math.min(1, R[i + j])) * 32767);
            }
            const buf = mp3enc.encodeBuffer(lc, rc);
            if (buf.length > 0) mp3Data.push(new Int8Array(buf));
            if (i % 44100 === 0) setFmtProgress(fmt, Math.min(90, Math.round(i / L.length * 85) + 5));
          }
          const tail = mp3enc.flush();
          if (tail.length > 0) mp3Data.push(new Int8Array(tail));
          files[`${basename}_${platName}_${kbps}kbps.mp3`] = new Blob(mp3Data, { type: 'audio/mp3' });
          setFmtProgress(fmt, 100);
        } catch {
          setFmtProgress(fmt, -1);
          const blob = encodeWAV(channels, sr, 24);
          files[`${basename}_${platName}_mp3_fallback.wav`] = blob;
        }
      }

      // Download
      const entries = Object.entries(files);
      if (entries.length === 1) {
        const [name, blob] = entries[0];
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast.success(`Exported: ${name}`);
      } else {
        // ZIP
        try {
          if (typeof (window as unknown as Record<string, unknown>).JSZip === 'undefined') {
            await new Promise<void>((res, rej) => {
              const s = document.createElement('script');
              s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
              s.onload = () => res(); s.onerror = () => rej(new Error('JSZip load failed'));
              document.head.appendChild(s);
            });
          }
          const JSZip = (window as unknown as Record<string, unknown>).JSZip as { new(): { file: (name: string, blob: Blob) => void; generateAsync: (opts: Record<string, unknown>) => Promise<Blob> } };
          const zip = new JSZip();
          entries.forEach(([name, blob]) => zip.file(name, blob));
          setFmtProgress('zip', 10);
          const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
          setFmtProgress('zip', 100);
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a'); a.href = url; a.download = `${basename}_${platName}_master.zip`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          toast.success(`Exported ${entries.length} files as ZIP`);
        } catch {
          for (const [name, blob] of entries) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            await new Promise(r => setTimeout(r, 300));
            URL.revokeObjectURL(url);
          }
          toast.success(`Exported ${entries.length} files`);
        }
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed: ' + (err instanceof Error ? err.message : 'unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleGeneratePDF = async () => {
    toast.info('Generating PDF report…');
    try {
      if (typeof (window as unknown as Record<string, unknown>).jspdf === 'undefined') {
        await new Promise<void>((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          s.onload = () => res(); s.onerror = () => rej(new Error('jsPDF load failed'));
          document.head.appendChild(s);
        });
      }
      const jspdf = (window as unknown as Record<string, unknown>).jspdf as { jsPDF: new (opts: Record<string, unknown>) => Record<string, unknown> };
      const doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const d = doc as Record<string, (...args: unknown[]) => unknown>;
      // Simple PDF with track info and meters
      d.setFillColor(10, 10, 11); d.rect(0, 0, 210, 297, 'F');
      d.setTextColor(232, 160, 32); d.setFontSize(14); d.setFont('helvetica', 'bold');
      d.text('MASTERAI PRO — MASTERING REPORT', 18, 18);
      d.setTextColor(128, 128, 144); d.setFontSize(8); d.setFont('helvetica', 'normal');
      d.text(`Generated: ${new Date().toLocaleString()}`, 18, 25);
      d.setTextColor(232, 232, 236); d.setFontSize(10);
      d.text(`Track: ${state.exportMetadata.title || 'Untitled'} — ${state.exportMetadata.artist || 'Unknown Artist'}`, 18, 35);
      d.text(`Platform: ${state.exportPlatform} (${platform.lufs} LUFS)`, 18, 42);
      if (state.meters.lufs > -90) {
        d.text(`Integrated LUFS: ${state.meters.lufs.toFixed(1)} LUFS`, 18, 52);
        d.text(`True Peak: ${state.meters.peak.toFixed(1)} dBFS`, 18, 59);
        d.text(`Phase Correlation: ${state.meters.correlation.toFixed(2)}`, 18, 66);
      }
      if (state.aiReport) {
        d.setTextColor(232, 160, 32); d.setFontSize(11); d.setFont('helvetica', 'bold');
        d.text('AI MASTERING REPORT', 18, 80);
        d.setTextColor(192, 192, 204); d.setFontSize(9); d.setFont('helvetica', 'normal');
        d.text(`Preset: ${state.aiReport.presetName} (${state.aiReport.genre}, ${state.aiReport.confidence}% confidence)`, 18, 88);
        const lines = (d.splitTextToSize as (t: string, w: number) => string[])(state.aiReport.analysisNotes, 172);
        d.text(lines, 18, 96);
      }
      const title = (state.exportMetadata.title || 'master').replace(/[^a-zA-Z0-9_-]/g, '_');
      (d.save as (name: string) => void)(`${title}_mastering_report.pdf`);
      toast.success('PDF report generated!');
    } catch (err) {
      toast.error('PDF generation failed: ' + (err instanceof Error ? err.message : 'error'));
    }
  };

  return (
    <>
      {/* Compact bar always visible */}
      <div className="panel p-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Formats */}
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1.5">Formats</div>
            <div className="flex gap-2 flex-wrap">
              {FORMATS.map(f => (
                <label key={f.id} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.exportFormats.includes(f.id)}
                    onChange={() => dispatch({ type: 'TOGGLE_EXPORT_FORMAT', fmt: f.id })}
                    className="accent-primary w-3 h-3"
                  />
                  <span className={`text-[10px] ${state.exportFormats.includes(f.id) ? 'text-primary' : 'text-muted-foreground'}`}>
                    {f.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="w-px h-8 bg-border" />

          {/* Platform */}
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1.5">Platform</div>
            <div className="flex gap-1 flex-wrap">
              {Object.entries(PLATFORM_TARGETS).map(([p, t]) => (
                <button
                  key={p}
                  onClick={() => dispatch({ type: 'SET_EXPORT_PLATFORM', platform: p })}
                  className="text-[8px] px-1.5 py-0.5 rounded-sm border transition-all font-mono"
                  style={{
                    border: `1px solid ${state.exportPlatform === p ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                    background: state.exportPlatform === p ? 'hsl(var(--primary) / 0.12)' : 'transparent',
                    color: state.exportPlatform === p ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {p} <span className="opacity-60">{t.lufs}L</span>
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-8 bg-border" />

          {/* Metadata */}
          <div className="flex-1 min-w-[200px]">
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1.5">Metadata</div>
            <div className="flex gap-1.5 flex-wrap">
              {METADATA_FIELDS.map(f => (
                <input
                  key={f.k}
                  value={state.exportMetadata[f.k]}
                  placeholder={f.k.charAt(0).toUpperCase() + f.k.slice(1)}
                  onChange={e => dispatch({ type: 'SET_METADATA', key: f.k, value: e.target.value })}
                  style={{ width: f.w }}
                  className="bg-secondary border border-border rounded-sm px-1.5 py-0.5 text-[9px] text-foreground font-mono focus:border-primary/50 focus:outline-none"
                />
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              className="gap-1.5 text-[10px] uppercase tracking-wider font-bold h-8"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleGeneratePDF}
              className="gap-1.5 text-[10px] h-8"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-card border border-primary/30 rounded-xl p-7 w-[540px] max-w-[95vw] shadow-[0_0_60px_hsl(36_80%_52%/0.12)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-primary">Export Master</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Render through signal chain · Normalize for {state.exportPlatform}
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Format selection */}
            <div className="mb-5">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-3">Select Formats</div>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map(f => (
                  <label
                    key={f.id}
                    className="flex items-center gap-2 p-2.5 rounded-md cursor-pointer transition-all border"
                    style={{
                      background: state.exportFormats.includes(f.id) ? 'hsl(36 80% 52% / 0.08)' : 'hsl(var(--secondary))',
                      borderColor: state.exportFormats.includes(f.id) ? 'hsl(36 80% 52% / 0.4)' : 'hsl(var(--border))',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={state.exportFormats.includes(f.id)}
                      onChange={() => dispatch({ type: 'TOGGLE_EXPORT_FORMAT', fmt: f.id })}
                      className="accent-primary rounded"
                    />
                    <div>
                      <div className={`text-[10px] font-bold ${state.exportFormats.includes(f.id) ? 'text-primary' : 'text-muted-foreground'}`}>
                        {f.label}
                      </div>
                      <div className="text-[8px] text-muted-foreground">{f.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="mb-5 p-3 bg-background rounded-md border border-border">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Export Preview</div>
              <div className="flex gap-6">
                <div>
                  <div className="text-[8px] text-muted-foreground">Target LUFS</div>
                  <div className="text-xl font-mono font-black text-primary">{platform.lufs}</div>
                </div>
                <div>
                  <div className="text-[8px] text-muted-foreground">True Peak</div>
                  <div className="text-xl font-mono font-black text-primary">{platform.ceiling}</div>
                </div>
                <div>
                  <div className="text-[8px] text-muted-foreground">Current LUFS</div>
                  <div className={`text-xl font-mono font-black ${state.meters.lufs > -90 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {state.meters.lufs > -90 ? state.meters.lufs.toFixed(1) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-[8px] text-muted-foreground">Files</div>
                  <div className="text-xl font-mono font-black text-[hsl(145,60%,50%)]">
                    {state.exportFormats.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bars */}
            {isExporting && (
              <div className="mb-4 space-y-2">
                <div className="text-[9px] text-primary font-bold animate-pulse">⟳ Rendering & exporting…</div>
                {Object.entries(progressMap).map(([key, pct]) => (
                  <div key={key}>
                    <div className="flex justify-between text-[8px] mb-0.5">
                      <span className="text-muted-foreground uppercase tracking-wide">{key}</span>
                      <span
                        className="font-mono"
                        style={{ color: pct === -1 ? 'hsl(0 70% 55%)' : pct === 100 ? 'hsl(145 60% 50%)' : 'hsl(36 80% 52%)' }}
                      >
                        {pct === -1 ? 'FALLBACK' : pct === 100 ? 'DONE' : pct + '%'}
                      </span>
                    </div>
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(0, pct)}%`,
                          background: pct === -1 ? 'hsl(0 70% 55%)' : pct === 100 ? 'hsl(145 60% 50%)' : 'hsl(36 80% 52%)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!state.audioBuffer && (
              <div className="mb-4 p-2.5 bg-destructive/10 border border-destructive/30 rounded-md text-[10px] text-destructive">
                ⚠ No audio file loaded. Load a file first.
              </div>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2 font-bold text-xs uppercase tracking-wider"
                onClick={handleExport}
                disabled={isExporting || !state.audioBuffer || state.exportFormats.length === 0}
              >
                {isExporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</> : <><Download className="w-3.5 h-3.5" /> Start Export</>}
              </Button>
              <Button
                variant="secondary"
                className="gap-2 text-xs"
                onClick={handleGeneratePDF}
              >
                <FileText className="w-3.5 h-3.5" /> PDF Report
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Temporarily suppress unused import warnings
void FileArchive;
void ChevronUp;

export default ExportPanel;
