// ---------- BYO engine layer (Task 102 reconstruction) ----------
// The built-in Rah engine is the $0 default and needs zero setup. A BYO
// (bring-your-own) provider can take the wheel: any OpenAI-compatible
// endpoint with a key the learner pastes into Settings. If the BYO call ever
// fails, smartChat silently falls back to the built-in engine so the coach
// is never unreachable. builtin-ai.ts exposes the same SimpleResult shape so
// callers swap engines without branching.

import { db } from "@/lib/db";
import { builtinChat, BUILTIN_LABEL } from "./builtin-ai";
import type { ChatMsg } from "./ai-types";

export type AiProfile = {
  builtin: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  label: string;
};

export const BUILTIN_MODEL = "rah-engine";

export const BUILTIN_PROFILE: AiProfile = {
  builtin: true,
  baseUrl: "",
  apiKey: "",
  model: BUILTIN_MODEL,
  label: BUILTIN_LABEL,
};

// Free-tier OpenAI-compatible endpoints the learner can paste a key into.
// All listed here have genuine free tiers; none is required - the built-in
// engine works without any of them (strict $0 rule).
export interface AiPreset {
  name: string;
  base: string;
  docs: string;
  note: string;
}

export const presets: Record<string, AiPreset> = {
  openrouter: {
    name: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    docs: "https://openrouter.ai/docs",
    note: "Has free models; the key covers all of them.",
  },
  groq: {
    name: "Groq",
    base: "https://api.groq.com/openai/v1",
    docs: "https://console.groq.com/docs",
    note: "Generous free tier, very fast.",
  },
  gemini: {
    name: "Google Gemini",
    base: "https://generativelanguage.googleapis.com/gemini/v1beta/openai",
    docs: "https://ai.google.dev/docs",
    note: "OpenAI-compatible endpoint; free tier available.",
  },
  cerebras: {
    name: "Cerebras",
    base: "https://api.cerebras.ai/v1",
    docs: "https://inference-docs.cerebras.ai",
    note: "Free tier with high rate limits.",
  },
  mistral: {
    name: "Mistral",
    base: "https://api.mistral.ai/v1",
    docs: "https://docs.mistral.ai",
    note: "Has a free experiment tier.",
  },
  custom: {
    name: "Custom endpoint",
    base: "",
    docs: "",
    note: "Any OpenAI-compatible base URL.",
  },
};

function presetLabel(providerId: string): string {
  const p = presets[providerId];
  return p ? p.name : "Custom endpoint";
}

export function isBuiltin(p: AiProfile): boolean {
  return p.builtin || !p.baseUrl || !p.model;
}

// The active profile: the AiSettings row when a BYO provider is fully
// configured, the built-in engine otherwise. Never throws - a missing row or
// a broken DB read degrades to the built-in engine.
export async function effectiveProfile(): Promise<AiProfile> {
  try {
    const row = await db.aiSettings.findUnique({ where: { id: "main" } });
    if (row && row.baseUrl && row.model) {
      return {
        builtin: false,
        baseUrl: row.baseUrl.replace(/\/+$/, ""),
        apiKey: row.apiKey ?? "",
        model: row.model,
        label: presetLabel(row.provider),
      };
    }
  } catch {
    /* table missing or DB unreachable - built-in engine still works */
  }
  return BUILTIN_PROFILE;
}

// What the client may see: the engine identity and a masked key hint, never
// the key itself.
export function profileView(row: {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
} | null): {
  builtin: boolean;
  baseUrl: string;
  model: string;
  label: string;
  preset: string;
  hasKey: boolean;
  keyset: boolean;
  keyMasked: string;
} {
  if (!row || !row.baseUrl || !row.model) {
    return {
      builtin: true,
      baseUrl: "",
      model: BUILTIN_MODEL,
      label: BUILTIN_LABEL,
      preset: "",
      hasKey: false,
      keyset: false,
      keyMasked: "",
    };
  }
  const key = row.apiKey ?? "";
  return {
    builtin: false,
    baseUrl: row.baseUrl,
    model: row.model,
    label: presetLabel(row.provider),
    preset: row.provider,
    hasKey: Boolean(key),
    keyset: Boolean(key),
    keyMasked: key ? `${key.slice(0, 3)}...${key.slice(-4)}` : "",
  };
}

// One BYO chat call. Returns SimpleResult (same shape as builtinChat) so
// engines are swappable at every call site.
export async function chat(
  p: AiProfile,
  system: string,
  msgs: ChatMsg[],
  maxOut = 1400,
  jsonMode = false,
): Promise<{ ok: boolean; error: string; text: string }> {
  if (isBuiltin(p)) return builtinChat(system, msgs, maxOut, jsonMode);
  try {
    const cap = Math.min(Math.max(maxOut, 700), 4000);
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: "system", content: system }, ...msgs],
        temperature: 0.4,
        max_tokens: cap,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `provider said HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}`, text: "" };
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) return { ok: false, error: "the provider returned an empty response", text: "" };
    return { ok: true, error: "", text };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "the provider could not be reached", text: "" };
  }
}

// Engine-of-record chat: BYO when configured, automatic built-in fallback on
// any BYO failure. Most feature routes call this.
export async function smartChat(
  system: string,
  msgs: ChatMsg[],
  maxOut = 1400,
  jsonMode = false,
): Promise<{ ok: boolean; error: string; text: string }> {
  const p = await effectiveProfile();
  if (isBuiltin(p)) return builtinChat(system, msgs, maxOut, jsonMode);
  const out = await chat(p, system, msgs, maxOut, jsonMode);
  if (out.ok) return out;
  console.log(`[ai] BYO provider failed (${out.error.slice(0, 120)}) - falling back to the built-in engine`);
  return builtinChat(system, msgs, maxOut, jsonMode);
}

// One-shot plain-text completion (no JSON envelope). Throws on failure so
// coach-agent tool runs surface the error honestly.
export async function aiText(system: string, msgs: ChatMsg[], maxOut = 1400): Promise<string> {
  const out = await smartChat(system, msgs, maxOut, false);
  if (!out.ok) throw new Error(out.error || "the engine could not be reached");
  return out.text;
}

// Discover the model list at a BYO endpoint (OpenAI-compatible /models).
export async function listModels(
  p: AiProfile,
): Promise<{ ok: boolean; models: string[]; error: string }> {
  if (isBuiltin(p)) {
    return { ok: true, models: [BUILTIN_PROFILE.model], error: "" };
  }
  try {
    const res = await fetch(`${p.baseUrl}/models`, {
      headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {},
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return { ok: false, models: [], error: `provider said HTTP ${res.status}` };
    }
    const data = (await res.json()) as { data?: { id?: string }[] };
    const models = (data.data ?? []).map((m) => String(m.id ?? "")).filter(Boolean);
    return { ok: true, models, error: "" };
  } catch (e: unknown) {
    return { ok: false, models: [], error: e instanceof Error ? e.message : "model discovery failed" };
  }
}
