import JSZip from 'jszip';

/**
 * Encode AudioBuffer to WAV ArrayBuffer
 */
export function encodeWav(buffer: AudioBuffer, bitDepth: 16 | 24 | 32 = 24): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // format (3=float, 1=PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Get channel data
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = headerSize;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      if (bitDepth === 16) {
        view.setInt16(offset, sample * 0x7FFF, true);
      } else if (bitDepth === 24) {
        const val = Math.round(sample * 0x7FFFFF);
        view.setUint8(offset, val & 0xFF);
        view.setUint8(offset + 1, (val >> 8) & 0xFF);
        view.setUint8(offset + 2, (val >> 16) & 0xFF);
      } else {
        view.setFloat32(offset, sample, true);
      }
      offset += bytesPerSample;
    }
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Render AudioBuffer through OfflineAudioContext (applies gain normalization)
 */
export async function renderOffline(
  buffer: AudioBuffer,
  targetPeakDb: number = -1.0
): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  // Calculate gain for peak normalization
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  const targetPeak = Math.pow(10, targetPeakDb / 20);
  const gainValue = peak > 0 ? targetPeak / peak : 1;

  const gainNode = offlineCtx.createGain();
  gainNode.gain.value = gainValue;

  source.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  source.start(0);

  return offlineCtx.startRendering();
}

export interface ExportFormat {
  id: string;
  bitDepth: 16 | 24 | 32;
  extension: string;
}

const FORMAT_MAP: Record<string, ExportFormat> = {
  wav24: { id: 'wav24', bitDepth: 24, extension: 'wav' },
  wav16: { id: 'wav16', bitDepth: 16, extension: 'wav' },
  wav32: { id: 'wav32', bitDepth: 32, extension: 'wav' },
};

export interface ExportOptions {
  formats: string[];
  filename: string;
  targetPeakDb: number;
  onProgress?: (format: string, progress: number) => void;
}

/**
 * Export audio to selected formats, returns a ZIP blob if multiple or single WAV
 */
export async function exportAudio(
  buffer: AudioBuffer,
  options: ExportOptions
): Promise<{ blob: Blob; filename: string }> {
  const { formats, filename, targetPeakDb, onProgress } = options;
  const baseName = filename.replace(/\.[^.]+$/, '');

  // Render with normalization
  onProgress?.('Rendering', 0);
  const rendered = await renderOffline(buffer, targetPeakDb);
  onProgress?.('Rendering', 100);

  if (formats.length === 1) {
    const fmt = FORMAT_MAP[formats[0]] || FORMAT_MAP.wav24;
    onProgress?.(fmt.id, 0);
    const wavData = encodeWav(rendered, fmt.bitDepth);
    onProgress?.(fmt.id, 100);
    return {
      blob: new Blob([wavData], { type: 'audio/wav' }),
      filename: `${baseName}_master.${fmt.extension}`,
    };
  }

  // Multiple formats → ZIP
  const zip = new JSZip();

  for (const formatId of formats) {
    const fmt = FORMAT_MAP[formatId];
    if (!fmt) continue; // Skip MP3/FLAC (WAV fallback noted)
    
    onProgress?.(fmt.id, 0);
    const wavData = encodeWav(rendered, fmt.bitDepth);
    const suffix = fmt.bitDepth === 16 ? '16bit' : fmt.bitDepth === 32 ? '32float' : '24bit';
    zip.file(`${baseName}_${suffix}.${fmt.extension}`, wavData);
    onProgress?.(fmt.id, 100);
  }

  // For MP3/FLAC, add a note file
  const nonWavFormats = formats.filter(f => !FORMAT_MAP[f]);
  if (nonWavFormats.length > 0) {
    zip.file('_README.txt', 
      `MP3 and FLAC encoding requires server-side processing.\n` +
      `WAV files are provided as lossless alternatives.\n` +
      `Use a converter like ffmpeg to create MP3/FLAC from the WAV files.`
    );
  }

  onProgress?.('ZIP', 0);
  const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
    onProgress?.('ZIP', Math.round(meta.percent));
  });
  onProgress?.('ZIP', 100);

  return {
    blob: zipBlob,
    filename: `${baseName}_masters.zip`,
  };
}

/**
 * Trigger browser download
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
