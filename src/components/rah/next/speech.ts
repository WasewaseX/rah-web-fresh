"use client";

// Real speech through the built-in Rah engine (/api/tts, server side), with
// the browser's own voices as an offline fallback. Every caller gets a
// boolean: true means audio actually played.

type Chunk = { url: string; el: HTMLAudioElement };

const CACHE = new Map<string, string>(); // key -> object URL
let current: Chunk | null = null;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

function stopCurrent() {
  if (current) {
    current.el.pause();
    current.el.currentTime = 0;
    current = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

async function serverSpeak(text: string, speed: number): Promise<boolean> {
  const key = hash(`${speed}|${text}`);
  let url = CACHE.get(key);
  if (!url) {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speed }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (!blob.type.startsWith("audio")) return false;
    url = URL.createObjectURL(blob);
    if (CACHE.size > 60) {
      const first = CACHE.keys().next().value;
      if (first) {
        URL.revokeObjectURL(CACHE.get(first) ?? "");
        CACHE.delete(first);
      }
    }
    CACHE.set(key, url);
  }
  stopCurrent();
  const el = new Audio(url);
  el.playbackRate = 1;
  current = { url, el };
  try {
    await el.play();
    return true;
  } catch {
    return false;
  }
}

// Browser voice fallback (headless test browsers have no voices).
async function localSpeak(text: string, rate: number): Promise<boolean> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return false;
  const pick =
    voices.find((v) => /en[-_]US/i.test(v.lang) && /female|samantha|zira|jenny|aria/i.test(v.name)) ??
    voices.find((v) => /en[-_]US/i.test(v.lang)) ??
    voices.find((v) => /^en/i.test(v.lang));
  if (!pick) return false;
  stopCurrent();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = pick;
  u.lang = pick.lang;
  u.rate = rate;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
  return true;
}

export async function speak(text: string, rate = 1.0): Promise<boolean> {
  const speed = rate <= 0.8 ? 0.75 : rate >= 1.3 ? 1.25 : 1.0;
  try {
    if (await serverSpeak(text, speed)) return true;
  } catch {
    /* fall through to local voices */
  }
  return localSpeak(text, rate);
}

export function ttsAvailable(): boolean {
  return true; // the built-in engine always speaks
}

export function stopSpeak() {
  stopCurrent();
}

export function speakSlow(text: string) {
  return speak(text, 0.65);
}

// Word overlap between what the learner wrote and the transcript (0..100).
export function overlapPct(said: string, target: string): number {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[.,!?;:'"’‘`]/g, "").split(/\s+/).filter(Boolean);
  const a = new Set(norm(said));
  const b = norm(target);
  if (!b.length) return 0;
  let hit = 0;
  for (const w of b) if (a.has(w)) hit += 1;
  return Math.round((hit / b.length) * 100);
}
