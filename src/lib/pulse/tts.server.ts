/**
 * HALISIA Pulse — server-side text-to-speech with provider switching.
 * ElevenLabs → Azure Speech → Google Cloud TTS, each used only when its
 * credentials exist. When none are configured (or all fail) the caller is told
 * to fall back to the browser Web Speech API.
 */
export type TtsEngine = "elevenlabs" | "azure" | "google";

export type TtsResult =
  | { ok: true; engine: TtsEngine; mimeType: string; audioBase64: string }
  | { ok: false; reason: string; tried: TtsEngine[] };

const ELEVEN_VOICE = "JBFqnCBsd6RMkjVDRZzb"; // George

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function availableEngines(): TtsEngine[] {
  const out: TtsEngine[] = [];
  if (process.env["ELEVENLABS_API_KEY"]) out.push("elevenlabs");
  if (process.env["AZURE_SPEECH_KEY"] && process.env["AZURE_SPEECH_REGION"]) out.push("azure");
  if (process.env["GOOGLE_TTS_API_KEY"]) out.push("google");
  return out;
}

async function elevenlabs(text: string): Promise<{ mimeType: string; audioBase64: string }> {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new Error("ElevenLabs is not configured");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text().catch(() => "")}`);
  return { mimeType: "audio/mpeg", audioBase64: toBase64(await res.arrayBuffer()) };
}

async function azure(text: string): Promise<{ mimeType: string; audioBase64: string }> {
  const key = process.env["AZURE_SPEECH_KEY"];
  const region = process.env["AZURE_SPEECH_REGION"];
  if (!key || !region) throw new Error("Azure Speech is not configured");
  const ssml = `<speak version="1.0" xml:lang="en-KE"><voice name="en-KE-ChilembaNeural">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure ${res.status}: ${await res.text().catch(() => "")}`);
  return { mimeType: "audio/mpeg", audioBase64: toBase64(await res.arrayBuffer()) };
}

async function google(text: string): Promise<{ mimeType: string; audioBase64: string }> {
  const key = process.env["GOOGLE_TTS_API_KEY"];
  if (!key) throw new Error("Google Cloud TTS is not configured");
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "en-KE", ssmlGender: "MALE" },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) throw new Error("Google TTS returned no audio");
  return { mimeType: "audio/mpeg", audioBase64: json.audioContent };
}

const RUNNERS: Record<
  TtsEngine,
  (t: string) => Promise<{ mimeType: string; audioBase64: string }>
> = { elevenlabs, azure, google };

/** Synthesize with the preferred engine, degrading through the rest. */
export async function synthesize(text: string, preferred?: TtsEngine): Promise<TtsResult> {
  const script = text.slice(0, 4000).trim();
  if (!script) return { ok: false, reason: "Nothing to read aloud.", tried: [] };

  const available = availableEngines();
  const order = preferred
    ? [preferred, ...available.filter((e) => e !== preferred)]
    : (["elevenlabs", "azure", "google"] as TtsEngine[]).filter((e) => available.includes(e));

  const tried: TtsEngine[] = [];
  const errors: string[] = [];
  for (const engine of order) {
    tried.push(engine);
    try {
      const out = await RUNNERS[engine](script);
      return { ok: true, engine, ...out };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return {
    ok: false,
    reason: errors.length
      ? errors.join(" | ")
      : "No cloud speech provider is configured — using the browser voice instead.",
    tried,
  };
}
