import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { metrics, referenceMetrics, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isReferenceMatch = mode === 'reference-match' && referenceMetrics;

    const systemPrompt = isReferenceMatch
      ? `You are an expert mastering engineer. The user wants to match their track's sound to a reference track. Compare the metrics and generate mastering chain settings to make the source track sound closer to the reference. Return ONLY raw JSON, no markdown.`
      : `You are an expert mastering engineer with 20 years of studio experience. Analyze the provided audio metrics and return a precise mastering chain as valid JSON. Rules: (1) Never clip — limiter ceiling max -0.1 dBFS. (2) Respect genre dynamics. (3) Fix detected problems first, then enhance. (4) All EQ gains must be between -12dB and +6dB. (5) Return ONLY raw JSON, no markdown.`;

    let userMessage = `TRACK METRICS:
- LUFS: ${metrics.lufs} | True Peak: ${metrics.truePeak} dBFS | DR: ${metrics.dynamicRange} | LRA: ${metrics.lra} LU
- Crest: ${metrics.crestFactor}dB | Noise Floor: ${metrics.noiseFloor} | Transients: ${metrics.transientDensity}/s
- Freq: Sub ${metrics.frequencyBalance.sub}% | Bass ${metrics.frequencyBalance.bass}% | Mid ${metrics.frequencyBalance.mid}% | HiMid ${metrics.frequencyBalance.highMid}% | Air ${metrics.frequencyBalance.air}%
- Stereo: Corr ${metrics.stereoCorrelation} | Width ${metrics.stereoWidth}% | Mono: ${metrics.isMono}
- Issues: ${metrics.issues.join(', ')} | Genre: ${metrics.estimatedGenre}`;

    if (isReferenceMatch) {
      userMessage += `\n\nREFERENCE TRACK METRICS:
- LUFS: ${referenceMetrics.lufs} | True Peak: ${referenceMetrics.truePeak} dBFS | DR: ${referenceMetrics.dynamicRange}
- Freq: Sub ${referenceMetrics.frequencyBalance.sub}% | Bass ${referenceMetrics.frequencyBalance.bass}% | Mid ${referenceMetrics.frequencyBalance.mid}% | HiMid ${referenceMetrics.frequencyBalance.highMid}% | Air ${referenceMetrics.frequencyBalance.air}%
- Stereo: Width ${referenceMetrics.stereoWidth}% | Genre: ${referenceMetrics.estimatedGenre}

Match the source track to sound like the reference.`;
    }

    userMessage += `\n\nReturn JSON: { "presetName": "string", "genre": "string", "confidence": number, "analysisNotes": "string", "recommendations": ["string"], "inputGain": number, "parametricEQ": [{"freq": number, "gain": number, "q": number, "type": "lowShelf|bell|highShelf"}], "compressor": {"threshold": number, "ratio": number, "attack": number, "release": number, "knee": number, "makeupGain": number}, "stereoWidth": number, "limiter": {"ceiling": number, "release": number}, "targetLUFS": number }`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI analysis failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return new Response(JSON.stringify({ error: "No AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let masteringConfig;
    try { masteringConfig = JSON.parse(jsonStr); } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid JSON", raw: jsonStr }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ config: masteringConfig, metrics }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
