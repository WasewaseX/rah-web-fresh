"use client";

// Shared 16k-mono WAV encoder for the measured speech surfaces (read-aloud,
// voice shadowing). Browser-only: decodes the MediaRecorder blob, renders it
// through an OfflineAudioContext, emits base64 PCM WAV for the server ASR.

export async function clipToWav16kMono(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
  const decoded = await new Ctx().decodeAudioData(buf);
  const rate = 16000;
  const frames = Math.max(1, Math.ceil(decoded.length * (rate / decoded.sampleRate)));
  const off = new OfflineAudioContext(1, frames, rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  const pcm = rendered.getChannelData(0);

  const bytes = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(bytes);
  const ascii = (off2: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off2 + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let bin = "";
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode(...u8.subarray(i, i + 8192));
  return btoa(bin);
}

// Chip colors shared by the word-level report (status: hit | near | miss).
export const WORD_STYLE: Record<string, string> = {
  hit: "border-[#2fc273]/50 bg-[#2fc273]/[0.12] text-[#7fe0ae]",
  near: "border-[#ffb02e]/50 bg-[#ffb02e]/[0.12] text-[#ffd08a]",
  miss: "border-[#ff6b81]/50 bg-[#ff6b81]/[0.12] text-[#ff9aa7]",
};
