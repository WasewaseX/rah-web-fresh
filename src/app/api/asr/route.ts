import { builtinASR } from "@/lib/builtin-ai";
import { MAX_AUDIO_BASE64_CHARS, wavDurationSeconds, MAX_AUDIO_SECONDS } from "@/lib/asr";

// Server-side speech recognition through the built-in engine. The speaking
// studio records in the browser, posts base64 audio here, and gets a
// transcript that the speaking coach evaluates.

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const audio = String(body?.audio ?? "");
  if (!audio) return Response.json({ ok: false, error: "no audio" }, { status: 400 });
  const stripped = audio.replace(/^data:[^;]+;base64,/, "");
  if (stripped.length > MAX_AUDIO_BASE64_CHARS) {
    return Response.json({ ok: false, error: "recording too large" }, { status: 413 });
  }
  // §8 duration cap: same enforcement as the transcribeAudio funnel - a WAV
  // header is parsed, not trusted from the client.
  const secs = wavDurationSeconds(stripped);
  if (secs !== null && secs > MAX_AUDIO_SECONDS) {
    return Response.json({ ok: false, error: `recording is ${Math.round(secs)}s - the ceiling is ${MAX_AUDIO_SECONDS}s` }, { status: 413 });
  }
  const out = await builtinASR(stripped);
  if (!out.ok) return Response.json({ ok: false, error: out.error }, { status: 502 });
  return Response.json({ ok: true, text: out.text });
}
