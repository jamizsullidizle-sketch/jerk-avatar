// Supabase Edge Function: speak
// Takes { text } and returns MP3 audio from ElevenLabs text-to-speech.
//
// Env vars:
//   ELEVENLABS_API_KEY   (required)
//   ELEVENLABS_VOICE_ID  (required) the ID of Jimmy's cloned voice
//   ELEVENLABS_MODEL_ID  (optional) default: eleven_turbo_v2_5 (fast + cheap)

import { corsHeaders, json } from "../_shared/cors.ts";

const MAX_TEXT_CHARS = 400; // keeps each clip short and cheap

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Use POST" }, 405);
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID");
  if (!apiKey || !voiceId) {
    // The front end treats 503 as "use the free browser voice instead".
    return json({
      error:
        "Voice not set up. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID.",
      configured: false,
    }, 503);
  }

  let text = "";
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }
  if (!text) return json({ error: "text is required" }, 400);

  const modelId = Deno.env.get("ELEVENLABS_MODEL_ID") || "eleven_turbo_v2_5";

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${
        encodeURIComponent(voiceId)
      }?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, MAX_TEXT_CHARS),
          model_id: modelId,
          voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.5 },
        }),
      },
    );

    if (!res.ok || !res.body) {
      const detail = await res.text();
      console.error("ElevenLabs error", res.status, detail.slice(0, 500));
      return json({ error: `Voice provider error (${res.status})` }, 502);
    }

    return new Response(res.body, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (err) {
    console.error("speak failed", err);
    return json({ error: "Could not reach ElevenLabs" }, 502);
  }
});
