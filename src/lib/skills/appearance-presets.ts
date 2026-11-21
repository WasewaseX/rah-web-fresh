// ---------- theme presets (plugin: appearance) ----------

import type { ThemePatch } from "./run-types";

export const THEME_PRESETS: Record<string, ThemePatch> = {
  midnight: { name: "midnight", primary: "#4e8cff", primaryDeep: "#2650a3", accent: "#9dc0ff", rgb: "78,140,255" },
  emerald: { name: "emerald", primary: "#2fc273", primaryDeep: "#1d8f52", accent: "#8ff0bd", rgb: "47,194,115" },
  sunset: { name: "sunset", primary: "#ff8a4e", primaryDeep: "#c25a24", accent: "#ffc39d", rgb: "255,138,78" },
  violet: { name: "violet", primary: "#9b7bff", primaryDeep: "#6a48c9", accent: "#cbbaff", rgb: "155,123,255" },
  ocean: { name: "ocean", primary: "#38bdf8", primaryDeep: "#0b7fb3", accent: "#a5e8ff", rgb: "56,189,248" },
  rose: { name: "rose", primary: "#fb6f92", primaryDeep: "#c24767", accent: "#ffb3c6", rgb: "251,111,146" },
  gold: { name: "gold", primary: "#f59e0b", primaryDeep: "#b47307", accent: "#fcd34d", rgb: "245,158,11" },
};

function hexToRgb(hex: string): string {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return "";
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function shade(hex: string, f: number): string {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return "";
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * f)));
  return `#${[ch(16), ch(8), ch(0)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function parseThemeArg(arg: string): ThemePatch | null {
  const a = arg.trim().toLowerCase();
  if (!a) return null;
  if (THEME_PRESETS[a]) return THEME_PRESETS[a];
  const hex = a.startsWith("#") ? a : `#${a}`;
  if (/^#[0-9a-f]{6}$/.test(hex) || /^#[0-9a-f]{3}$/.test(hex)) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    return { name: `custom ${hex}`, primary: hex, primaryDeep: shade(hex, 0.55), accent: shade(hex, 1.35), rgb };
  }
  for (const [key, patch] of Object.entries(THEME_PRESETS)) {
    if (a.includes(key)) return patch;
  }
  return null;
}
