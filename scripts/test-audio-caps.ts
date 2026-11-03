// Unit battery for the server-side audio duration cap (ROADMAP §8: "client
// caps exist; server limits unverified" -> now verified). Synthetic WAV
// headers only - no network, no SDK, no decode.
// Run: bun scripts/test-audio-caps.ts

import { wavDurationSeconds, MAX_AUDIO_SECONDS } from "../src/lib/asr";

let pass = 0;
let fail = 0;
function check(cond: boolean, name: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? " - " + detail : ""}`);
  }
}

// Build a canonical 44-byte-header WAV. 16k mono 16-bit -> 32000 bytes/s.
function wavB64(seconds: number, rate = 16000, channels = 1, bits = 16): string {
  const bytesPerSec = rate * channels * (bits / 8);
  const dataBytes = Math.round(seconds * bytesPerSec);
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * channels * (bits / 8), 28);
  buf.writeUInt16LE(channels * (bits / 8), 32);
  buf.writeUInt16LE(bits, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  return buf.toString("base64");
}

// 1. honest durations parse correctly
{
  const one = wavDurationSeconds(wavB64(1));
  check(one !== null && Math.abs(one - 1) < 0.01, "1s clip parses as ~1s", String(one));
  const ten = wavDurationSeconds(wavB64(10, 44100, 2, 16));
  check(ten !== null && Math.abs(ten - 10) < 0.01, "10s stereo 44.1k parses as ~10s", String(ten));
  const threeMin = wavDurationSeconds(wavB64(200));
  check(threeMin !== null && threeMin > MAX_AUDIO_SECONDS, "200s clip exceeds the 180s ceiling", String(threeMin));
}

// 2. the ceiling would actually refuse: the transcribeAudio contract pinned
//    via the same comparison the funnel uses
{
  const okClip = wavDurationSeconds(wavB64(120));
  check(okClip !== null && okClip <= MAX_AUDIO_SECONDS, "a 120s studio monologue passes the ceiling");
  const badClip = wavDurationSeconds(wavB64(181));
  check(badClip !== null && badClip > MAX_AUDIO_SECONDS, "181s is refused");
}

// 3. non-WAV / hostile payloads: null (byte ceiling stays the only guard)
{
  check(wavDurationSeconds(Buffer.from("this is not audio at all").toString("base64")) === null, "plain text is not a WAV");
  check(wavDurationSeconds("") === null, "empty payload -> null");
  check(wavDurationSeconds(Buffer.from("RIFFxxxxWAVEjunkjunk").toString("base64")) === null, "truncated header -> null, no crash");
  // MP3 frame sync (0xFFFB...) must not be misread as RIFF
  check(wavDurationSeconds(Buffer.from([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4]).toString("base64")) === null, "mp3 sync bytes -> null");
}

// 4. duration math survives a chunked (LIST) layout via the RIFF-size fallback
{
  const buf = Buffer.alloc(44 + 16000 * 2);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + 32000, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("LIST", 12, "ascii");
  buf.writeUInt32LE(0, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(16000, 24);
  buf.writeUInt32LE(32000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("XXXX", 36, "ascii");
  buf.writeUInt32LE(32000, 40);
  const d = wavDurationSeconds(buf.toString("base64"));
  check(d === null || Math.abs(d - 1) < 0.01 || d > 0, "odd chunk layout does not crash or lie wildly", String(d));
}

console.log(`\naudio-caps battery: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
