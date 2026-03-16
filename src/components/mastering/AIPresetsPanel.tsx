import { useState, useMemo } from 'react';
import { Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudio } from '@/contexts/AudioContext';
import { MASTER_PRESETS, TAG_COLORS, ALL_TAGS } from '@/lib/masterPresets';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const QUICK_TAG_FILTERS = ['ALL', 'POP', 'EDM', 'HIP-HOP', 'ROCK', 'JAZZ', 'AMBIENT', 'STREAMING', 'PODCAST'];

async function fetchAIAnalysis(metrics: Record<string, unknown>): Promise<Record<string, unknown>> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.hardbanrecordslab.online';
  
  // Get Supabase token for auth
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const prompt = `Analyze this audio track and provide expert mastering settings as JSON.
  
  TRACK METRICS:
  - LUFS: ${metrics.lufs}
  - True Peak: ${metrics.truePeak} dBFS
  - Dynamic Range: ${metrics.dynamicRange}
  - Frequency Balance: Sub:${metrics.sub}%, Bass:${metrics.bass}%, Mid:${metrics.mid}%, HiMid:${metrics.highMid}%, Air:${metrics.air}%
  - Issues detected: ${metrics.issues}
  - Estimated Genre: ${metrics.estimatedGenre}

  REQUIRED JSON STRUCTURE:
  {
    "presetName": "short creative name",
    "genre": "${metrics.estimatedGenre}",
    "confidence": 90,
    "analysisNotes": "Brief expert analysis of the audio spectrum",
    "recommendations": ["list of 3 specific mastering adjustments"],
    "signalChain": {
      "inputGain": 0,
      "parametricEQ": {
        "enabled": true,
        "bands": [
          {"type": "lowShelf", "freq": 100, "gain": 0.5, "q": 0.7},
          {"type": "bell", "freq": 400, "gain": -1.0, "q": 1.5},
          {"type": "bell", "freq": 2500, "gain": 1.2, "q": 1.2},
          {"type": "highShelf", "freq": 12000, "gain": 0.8, "q": 0.7}
        ]
      },
      "compressor": {"enabled": true, "threshold": -18, "ratio": 2.5, "attack": 20, "release": 150, "knee": 4, "makeupGain": 2},
      "stereoWidth": 105,
      "limiter": {"ceiling": -0.3, "release": 100, "lookahead": 3}
    }
  }`;

  const res = await fetch(`${apiBaseUrl}/auth/ai/proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      provider: 'gemini',
      payload: {
        contents: [{
          parts: [{ text: prompt }]
        }],
        systemInstruction: {
          parts: [{ text: "You are a world-class mastering engineer. Provide precise, professional settings based on audio analysis. Return ONLY valid JSON." }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4
        }
      },
    }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Please log in to use AI features.');
    if (res.status === 402) throw new Error('AI credits exhausted.');
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error ${res.status}`);
  }

  const data = await res.json();
  // Gemini 1.5 Flash returns content in candidates[0].content.parts[0].text
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('AI returned an empty response. Please try again.');
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse AI JSON:', text);
    throw new Error('AI returned invalid formatting. Please try again.');
  }
}

const AIPresetsPanel = () => {
  const { state, setProcessing, applyPreset, dispatch, getAudioAnalysis } = useAudio();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('ALL');
  const [showReport, setShowReport] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);

  const filteredPresets = useMemo(() => {
    return MASTER_PRESETS.filter(p => {
      const matchTag = activeTag === 'ALL' || p.tag === activeTag;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.tag.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
      return matchTag && matchSearch;
    });
  }, [activeTag, searchQuery]);

  const handlePresetClick = (presetId: string) => {
    const preset = MASTER_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    applyPreset(preset);
    toast.success(`Preset applied: ${preset.name}`);
  };

  const handleAIAnalyze = async () => {
    setIsAnalyzing(true);
    dispatch({ type: 'SET_AI_STATUS', status: 'analyzing' });

    try {
      setAnalysisStep('Performing forensic audio analysis...');
      let metrics;
      if (state.audioBuffer) {
        metrics = getAudioAnalysis();
      } else {
        metrics = {
          lufs: -16.4, truePeak: -1.2, dynamicRange: 11, lra: 7.2,
          crestFactor: 14.2, noiseFloor: -72, transientDensity: 3.4,
          frequencyBalance: { sub: 18, bass: 24, mid: 38, highMid: 13, air: 7 },
          stereoCorrelation: 0.71, stereoWidth: 65, isMono: false,
          issues: ['low mid resonance', 'lacking high-end air'], estimatedGenre: 'Pop',
        };
      }

      if (metrics) {
        dispatch({ type: 'SET_AI_METRICS', metrics: metrics as any });
      }

      setAnalysisStep('Tuning AI Mastering Brain...');
      const flatMetrics = {
        lufs: metrics?.lufs ?? -16,
        truePeak: metrics?.truePeak ?? -1,
        dynamicRange: metrics?.dynamicRange ?? 10,
        lra: metrics?.lra ?? 8,
        crestFactor: metrics?.crestFactor ?? 12,
        noiseFloor: metrics?.noiseFloor ?? -70,
        transientDensity: metrics?.transientDensity ?? 3,
        sub: metrics?.frequencyBalance?.sub ?? 20,
        bass: metrics?.frequencyBalance?.bass ?? 20,
        mid: metrics?.frequencyBalance?.mid ?? 30,
        highMid: metrics?.frequencyBalance?.highMid ?? 20,
        air: metrics?.frequencyBalance?.air ?? 10,
        correlation: metrics?.stereoCorrelation ?? 0.8,
        stereoWidth: metrics?.stereoWidth ?? 70,
        isMono: metrics?.isMono ?? false,
        issues: metrics?.issues?.join(', ') || 'none',
        estimatedGenre: metrics?.estimatedGenre || 'Pop',
      };

      setAnalysisStep('Gemini AI is processing your sound...');
      const report = await fetchAIAnalysis(flatMetrics);
      
      dispatch({ type: 'SET_AI_REPORT', report: report as any });
      setShowReport(true);
      toast.success('AI Analysis Successful!');
      
      // Auto-apply suggested settings
      const config = (report as any).signalChain;
      if (config) {
        setProcessing(p => ({
          ...p,
          inputGain: config.inputGain ?? 0,
          eqBands: config.parametricEQ?.bands?.map((b: any) => ({
            ...b,
            type: (b.type === 'lowShelf' ? 'lowshelf' : b.type === 'highShelf' ? 'highshelf' : 'peaking')
          })) || p.eqBands,
          compEnabled: config.compressor?.enabled ?? true,
          compThreshold: config.compressor?.threshold ?? -18,
          compRatio: config.compressor?.ratio ?? 2.5,
          compAttack: config.compressor?.attack ?? 20,
          compRelease: config.compressor?.release ?? 150,
          compKnee: config.compressor?.knee ?? 4,
          compMakeup: config.compressor?.makeupGain ?? 2,
          stereoWidth: config.stereoWidth ?? 100,
          limiterCeiling: config.limiter?.ceiling ?? -0.3,
          limiterRelease: config.limiter?.release ?? 100,
          limiterLookahead: config.limiter?.lookahead ?? 3,
        }));
      }

    } catch (error) {
      console.error('AI Mastering Error:', error);
      toast.error(error instanceof Error ? error.message : 'Analysis failed');
      dispatch({ type: 'SET_AI_STATUS', status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  return (
    <div className="panel h-full flex flex-col overflow-hidden border-primary/20 bg-card/40 backdrop-blur-sm">
      <div className="p-4 border-b border-border/50 bg-secondary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">HRL AI Intelligence</h2>
          </div>
          <Button
            size="sm"
            onClick={handleAIAnalyze}
            disabled={isAnalyzing}
            className="gap-2 bg-primary hover:bg-primary/90 text-black font-bold h-8 px-4 rounded-full shadow-lg shadow-primary/20"
          >
            {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {isAnalyzing ? 'Processing...' : 'Start AI Master'}
          </Button>
        </div>

        {isAnalyzing && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/10 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                    <span className="text-[10px] font-mono text-primary uppercase font-bold tracking-wider">{analysisStep}</span>
                </div>
            </div>
        )}

        <div className="relative">
          <input
            type="text"
            placeholder="Search genres, vibes, keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary/30 outline-none pr-10 hover:border-border transition-colors font-medium"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs opacity-50">#AI</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {showReport && state.aiReport && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 space-y-3 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-30 group-hover:opacity-100 transition-opacity">
                <Zap className="w-4 h-4 text-primary fill-primary" />
            </div>
            
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Mastering Insight</h3>
                <span className="text-[8px] bg-primary/20 px-2 py-0.5 rounded-full text-primary font-bold">{state.aiReport.confidence}% Perfect</span>
            </div>
            
            <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">Suggested Tone: {state.aiReport.presetName}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed italic opacity-80">"{state.aiReport.analysisNotes}"</p>
            </div>

            <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-primary/10">
              {state.aiReport.recommendations.map((rec, i) => (
                <div key={i} className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <div className="w-1 h-1 bg-primary rounded-full" />
                  {rec}
                </div>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-7 text-[9px] uppercase tracking-widest hover:bg-primary/10 text-primary border border-primary/20"
              onClick={() => setShowReport(false)}
            >
              Close Insight
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-2">
          {QUICK_TAG_FILTERS.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                activeTag === tag
                  ? 'bg-primary text-black shadow-md shadow-primary/10'
                  : 'bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {filteredPresets.map(preset => (
            <div
              key={preset.id}
              onClick={() => handlePresetClick(preset.id)}
              onMouseEnter={() => setExpandedPresetId(preset.id)}
              onMouseLeave={() => setExpandedPresetId(null)}
              className={`relative group cursor-pointer p-3 rounded-xl border border-border/50 hover:border-primary/40 transition-all duration-300 ${
                state.activePresetId === preset.id ? 'bg-primary/5 border-primary/30' : 'bg-background/20 hover:bg-secondary/20'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-black text-foreground group-hover:text-primary transition-colors truncate">
                        {preset.name}
                    </span>
                    {state.activePresetId === preset.id && (
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_5px_var(--primary)]" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-secondary/50"
                      style={{ color: TAG_COLORS[preset.tag] || '#ccc' }}
                    >
                      {preset.tag}
                    </span>
                    <span className="text-[9px] text-muted-foreground truncate opacity-60 font-medium">
                      {preset.desc}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] font-mono text-primary font-bold">{preset.targetLUFS} LUFS</span>
                  <div className="flex gap-0.5">
                    {preset.platforms.slice(0, 2).map(p => (
                        <div key={p} className="w-3 h-3 rounded-full bg-secondary flex items-center justify-center text-[6px] font-black opacity-40 group-hover:opacity-100 transition-opacity">
                            {p[0]}
                        </div>
                    ))}
                  </div>
                </div>
              </div>

              {expandedPresetId === preset.id && (
                <div className="mt-2 pt-2 border-t border-border/30 animate-in fade-in slide-in-from-top-1">
                    <div className="grid grid-cols-4 gap-2">
                        <div className="flex flex-col">
                            <span className="text-[7px] text-muted-foreground uppercase opacity-60">Width</span>
                            <span className="text-[9px] font-mono">{preset.stereoWidth}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[7px] text-muted-foreground uppercase opacity-60">Peak</span>
                            <span className="text-[9px] font-mono">{preset.limiter.ceiling} dB</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[7px] text-muted-foreground uppercase opacity-60">Comp</span>
                            <span className="text-[9px] font-mono">{preset.compressor.ratio}:1</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[7px] text-muted-foreground uppercase opacity-60">Gain</span>
                            <span className="text-[9px] font-mono">+{preset.compressor.makeupGain} dB</span>
                        </div>
                    </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-border/50 bg-secondary/10">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>HRL Engine optimized for reference-grade mastering.</span>
        </div>
      </div>
    </div>
  );
};

export default AIPresetsPanel;
