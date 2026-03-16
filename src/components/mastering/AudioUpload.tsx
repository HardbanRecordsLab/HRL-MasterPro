import { useCallback } from 'react';
import { Upload, FileAudio } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';

const AudioUpload = () => {
  const { loadFile, state } = useAudio();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && isAudioFile(file)) loadFile(file);
  }, [loadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }, [loadFile]);

  if (state.audioBuffer) return null;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="panel border-dashed border-2 border-border hover:border-primary/50 transition-colors p-16 text-center cursor-pointer group"
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => document.getElementById('audio-input')?.click()}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Upload className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">Drop your audio file here</p>
            <p className="text-sm text-muted-foreground mt-1">WAV, MP3, FLAC — or click to browse</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
            <FileAudio className="w-3.5 h-3.5" />
            <span>Supported: WAV, MP3, FLAC, OGG, AAC</span>
          </div>
        </div>
        <input
          id="audio-input"
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
};

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || /\.(wav|mp3|flac|ogg|aac)$/i.test(file.name);
}

export default AudioUpload;
