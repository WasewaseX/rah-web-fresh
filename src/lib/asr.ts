// Server-side speech-to-text seam (Task 64 - the acoustic tier).
//
// The audit's Azure gate asked for a decision: pronunciation scoring moves
// from honest-inference to MEASURED. Decision: the built-in SDK ASR gives a
// real acoustic transcript today (validated: TTS->ASR roundtrip reproduces
// target sentences exactly), and src/lib/azure-speech.ts carries the Azure
// pronunciation-assessment adapter that activates the moment the learner sets
// AZURE_SPEECH_KEY + AZURE_SPEECH_REGION. No code changes needed to switch.
//
// Backend only: z-ai-web-dev-sdk must never be imported client-side.

import ZAI from "z-ai-web-dev-sdk";

// ~7.5MB of binary audio. Read-aloud clips are seconds long (a sentence is
// ~300-500KB base64); this is a ceiling, not a target (abuse-limit belt
// alongside aiRateLimit). Task 90: calibrated UNDER the platform request-body
// cap observed at ~10.5MB with the auth proxy in the path - a ceiling above
// that would be unreachable (the body dies before the route can 413 it).
export const MAX_AUDIO_BASE64_CHARS = 9_000_000;

// Server-side DURATION cap (ROADMAP §8 optimization ledger: "server limits
// unverified" -> now verified and enforced). The client caps recordings at
// 120s (speaking studio) and sentence reads are seconds long; the server no
// longer takes the client's word for it. WAV payloads (what the client
// encodes) carry their duration in the header - parsed here deterministically
// at zero cost. Non-WAV payloads keep the byte-ceiling proxy only.
export const MAX_AUDIO_SECONDS = 180;

/**
 * Duration of a base64 WAV (RIFF) payload in seconds, or null when the bytes
 * are not a parsable WAV. Reads the fmt + data chunk sizes; no decode, no
 * allocation beyond the header slice.
 */
export function wavDurationSeconds(b64: string): number | null {
  try {
    const head = Buffer.from(b64.slice(0, 200), "base64");
    if (head.length < 44) return null;
    if (head.toString("ascii", 0, 4) !== "RIFF" || head.toString("ascii", 8, 12) !== "WAVE") return null;
    const fmt = head.toString("ascii", 12, 16);
    if (fmt !== "fmt ") return null;
    const channels = head.readUInt16LE(22);
    const sampleRate = head.readUInt32LE(24);
    const bitsPerSample = head.readUInt16LE(34);
    if (!sampleRate || !channels || !bitsPerSample) return null;
    // The data chunk header sits after the fixed 16-byte fmt chunk (+ its size field).
    const dataHdr = head.toString("ascii", 36, 40);
    let dataBytes: number;
    if (dataHdr === "data") {
      dataBytes = head.readUInt32LE(40);
    } else {
      // Non-standard layout: fall back to the RIFF file size - 44 header bytes.
      dataBytes = head.readUInt32LE(4) - 36;
    }
    if (!Number.isFinite(dataBytes) || dataBytes <= 0) return null;
    return dataBytes / (sampleRate * channels * (bitsPerSample / 8));
  } catch {
    return null;
  }
}

export interface TranscribeResult {
  text: string;
  provider: "zai-asr";
}

type ZaiClient = Awaited<ReturnType<typeof ZAI.create>>;

let cachedClient: ZaiClient | null = null;

async function client(): Promise<ZaiClient> {
  if (!cachedClient) cachedClient = await ZAI.create();
  return cachedClient;
}

function stripDataUrl(b64: string): string {
  return b64.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, "");
}

/**
 * Transcribe a base64 audio payload (wav/mp3/m4a/flac/ogg; the client encodes
 * 16k-mono WAV before upload). Throws speakable Error messages - the route
 * maps them to honest 4xx/5xx responses.
 */
export async function transcribeAudio(rawBase64: string): Promise<TranscribeResult> {
  const b64 = stripDataUrl(String(rawBase64 ?? ""));
  if (!b64) throw new Error("No audio reached the server - record again.");
  if (b64.length > MAX_AUDIO_BASE64_CHARS) throw new Error("Audio clip too large (9MB ceiling).");
  // Server-side duration enforcement (§8): a WAV is parsed, not trusted; the
  // 180s ceiling matches the longest legitimate surface (2-minute monologue).
  const secs = wavDurationSeconds(b64);
  if (secs !== null && secs > MAX_AUDIO_SECONDS) {
    throw new Error(`Recording is ${Math.round(secs)}s - the ceiling is ${MAX_AUDIO_SECONDS}s. Record in shorter takes.`);
  }

  const zai = await client();
  const res = (await zai.audio.asr.create({ file_base64: b64 })) as { text?: string };
  const text = String(res?.text ?? "").trim();
  if (!text) throw new Error("The recognizer heard nothing usable - try a quieter room or speak up.");
  return { text, provider: "zai-asr" };
}
