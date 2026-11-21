"use client";

import { useEffect, useState } from "react";
import type { Boot } from "@/app/page";
import { SectionTitle, Note } from "./bits";

// Task 109: this interface described a shape the API never sent (label/hint)
// - every preset button rendered an empty box. The real wire shape is
// { name, base, docs, note } (src/lib/ai.ts presets).
interface Preset {
  id: string;
  name: string;
  base: string;
  docs: string;
  note: string;
}

type Busy = "discover" | "test" | "save" | "builtin-test" | null;
type Status = { ok?: boolean; msg: string };

function loadSettings(o: {
  setPresets: (p: Record<string, Preset>) => void;
  setPresetId: (v: string) => void;
  setBaseUrl: (v: string) => void;
  setModel: (v: string) => void;
  setModels: (m: string[]) => void;
}) {
  fetch("/api/settings")
    .then((r) => r.json())
    .then((j) => {
      o.setPresets(j.presets ?? {});
      const pid: string = j.settings?.providerId ?? "";
      o.setPresetId(pid === "builtin" ? "" : pid);
      o.setBaseUrl(j.settings?.baseUrl ?? "");
      o.setModel(j.settings?.builtin ? "" : (j.settings?.model ?? ""));
      o.setModels(j.settings?.discovered ? (typeof j.settings.discovered === "string" ? JSON.parse(j.settings.discovered) : j.settings.discovered) : []);
    })
    .catch(() => undefined);
}

function choosePreset(id: string, presets: Record<string, Preset>, setPresetId: (v: string) => void, setBaseUrl: (v: string) => void, setModels: (m: string[]) => void, setModel: (v: string) => void) {
  setPresetId(id);
  const p = presets[id];
  if (p) {
    setBaseUrl(p.base);
    setModels([]);
    setModel("");
  }
}

async function saveSettings(o: {
  presetId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  extra: Record<string, unknown>;
  setBusy: (b: Busy) => void;
  onDone: () => void;
}) {
  o.setBusy("save");
  try {
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: o.presetId, baseUrl: o.baseUrl, apiKey: o.apiKey, model: o.model, ...o.extra }),
    });
    const j = await r.json();
    if (j.ok) o.onDone();
    return j;
  } finally {
    o.setBusy(null);
  }
}

// presetId "" means: use the built-in engine.
async function useBuiltinEngine(o: { setBusy: (b: Busy) => void; setStatus: (s: Status | null) => void; setPresetId: (v: string) => void; onDone: () => void }) {
  o.setBusy("save");
  o.setStatus(null);
  try {
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: "", clearProvider: true, model: "" }),
    });
    const j = await r.json();
    if (j.ok) {
      o.setPresetId("");
      o.setStatus({ ok: true, msg: "Switched back to the built-in engine." });
      o.onDone();
    }
  } finally {
    o.setBusy(null);
  }
}

async function discoverModels(o: { save: () => Promise<unknown>; setBusy: (b: Busy) => void; setStatus: (s: Status | null) => void; setModels: (m: string[]) => void }) {
  await o.save();
  o.setBusy("discover");
  o.setStatus(null);
  try {
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "discover" }),
    });
    const j = await r.json();
    if (j.ok) {
      o.setModels(j.models ?? []);
      o.setStatus(
        j.managed
          ? { ok: true, msg: "The built-in engine manages its own model. Discovery is for custom endpoints." }
          : { ok: true, msg: `${j.models.length} models found. Pick one below.` }
      );
    } else {
      o.setStatus({ ok: false, msg: j.error ?? "discovery failed" });
    }
  } catch {
    o.setStatus({ ok: false, msg: "network error" });
  } finally {
    o.setBusy(null);
  }
}

async function testProvider(o: { save: () => Promise<unknown>; setBusy: (b: Busy) => void; setStatus: (s: Status | null) => void; onDone: () => void }) {
  await o.save();
  o.setBusy("test");
  o.setStatus(null);
  try {
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const j = await r.json();
    o.setStatus(j.ok ? { ok: true, msg: `Connected. Replied in ${j.ms} ms.` } : { ok: false, msg: j.error ?? "test failed" });
    o.onDone();
  } catch {
    o.setStatus({ ok: false, msg: "network error" });
  } finally {
    o.setBusy(null);
  }
}

async function testBuiltinEngine(o: { setBusy: (b: Busy) => void; setEngineMsg: (m: string) => void }) {
  o.setBusy("builtin-test");
  o.setEngineMsg("");
  try {
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const j = await r.json();
    o.setEngineMsg(j.ok ? `Engine replied in ${j.ms} ms. Tutor, writing examiner, quiz builder, speech and transcription are live.` : j.error ?? "engine test failed");
  } catch {
    o.setEngineMsg("network error");
  } finally {
    o.setBusy(null);
  }
}

function BuiltinEngineCard({ boot, busy, engineMsg, onTest, onUse }: {
  boot: Boot;
  busy: Busy;
  engineMsg: string;
  onTest: () => void;
  onUse: () => void;
}) {
  return (
    <div className="card-rah p-6 mb-4" style={boot.ai.builtin ? { borderColor: "var(--accent)", borderWidth: 2 } : undefined}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-[14.5px]">Built-in engine</div>
        <span className="chip chip-accent">{boot.ai.builtin ? "active" : "standby"}</span>
      </div>
      <p className="text-[13px] leading-relaxed mb-4" style={{ color: "var(--muted)" }}>
        Runs on the server Rah is hosted on. Powers the Socratic tutor, the CEFR writing examiner, quiz building, card
        import, real speech synthesis and speech-to-text for the speaking studio. No key, no endpoint, nothing to configure.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn-ghost text-[13px]" disabled={busy !== null} onClick={onTest}>
          {busy === "builtin-test" ? "Testing..." : "Test the engine"}
        </button>
        {!boot.ai.builtin ? (
          <button className="btn-primary text-[13px]" disabled={busy !== null} onClick={onUse}>
            Use the built-in engine
          </button>
        ) : null}
      </div>
      {engineMsg ? (
        <div className="mt-3">
          <Note tone="accent">{engineMsg}</Note>
        </div>
      ) : null}
    </div>
  );
}

function ProviderPresetCard({ presets, presetId, onChoose }: {
  presets: Record<string, Preset>;
  presetId: string;
  onChoose: (id: string) => void;
}) {
  return (
    <div className="card-rah p-6 mb-4">
      <div className="font-bold text-[14.5px] mb-1">Bring your own provider (optional)</div>
      <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>
        A configured provider takes over all text features and falls back to the built-in engine on any failure. The key
        is stored in your local database, masked in the interface, and sent nowhere except the provider you choose.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {Object.values(presets).map((p) => (
          <button
            key={p.id}
            onClick={() => onChoose(p.id)}
            className="rounded-2xl border p-4 text-left"
            style={presetId === p.id ? { background: "var(--accent-dim)", borderColor: "transparent" } : { borderColor: "var(--line)" }}
          >
            <div className="font-bold text-[14px]">{p.name}</div>
            <div className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--muted)" }}>{p.note}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EndpointCard({ boot, baseUrl, setBaseUrl, apiKey, setApiKey, model, busy, status, onDiscover, onTest, onSave }: {
  boot: Boot;
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  model: string;
  busy: Busy;
  status: Status | null;
  onDiscover: () => void;
  onTest: () => void;
  onSave: () => void;
}) {
  return (
    <div className="card-rah p-6 mb-4">
      <div className="font-bold text-[14.5px] mb-3">Endpoint and key</div>
      <label htmlFor="ai-base-url" className="text-[12.5px] font-bold block mb-1">Base URL</label>
      <input
        id="ai-base-url"
        aria-label="Base URL"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        className="w-full rounded-xl border px-4 py-2.5 text-[14px] mb-3"
        style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
        placeholder="https://api.openai.com/v1"
      />
      <label htmlFor="ai-api-key" className="text-[12.5px] font-bold block mb-1">
        API key {boot.ai.keyset ? <span className="font-normal" style={{ color: "var(--muted)" }}>(saved: {boot.ai.keyMasked}, leave blank to keep)</span> : null}
      </label>
      <input
        id="ai-api-key"
        aria-label="API key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        type="password"
        className="w-full rounded-xl border px-4 py-2.5 text-[14px]"
        style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
        placeholder={boot.ai.keyset ? "kept secret" : "sk-..."}
        autoComplete="off"
      />
      <div className="flex gap-2 mt-4 flex-wrap">
        <button className="btn-ghost text-[13px]" disabled={busy !== null || !baseUrl} onClick={onDiscover}>
          {busy === "discover" ? "Discovering..." : "Discover models"}
        </button>
        <button className="btn-ghost text-[13px]" disabled={busy !== null || !model} onClick={onTest}>
          {busy === "test" ? "Testing..." : "Test connection"}
        </button>
        <button className="btn-primary text-[13px]" disabled={busy !== null} onClick={onSave}>
          {busy === "save" ? "Saving..." : "Save and use this provider"}
        </button>
      </div>
      {status ? (
        <div className="mt-4">
          <Note tone={status.ok ? "accent" : "error"}>{status.msg}</Note>
        </div>
      ) : null}
    </div>
  );
}

function ModelCard({ model, setModel, models }: {
  model: string;
  setModel: (v: string) => void;
  models: string[];
}) {
  return (
    <div className="card-rah p-6 mb-4">
      <div className="font-bold text-[14.5px] mb-3">Provider model</div>
      <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>
        {models.length ? "Found on your endpoint. Type to filter or paste any name." : "Discover models, or type a known name like gpt-4o-mini."}
      </p>
      <input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        aria-label="Model"
        className="w-full rounded-xl border px-4 py-2.5 text-[14px] mb-3"
        style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
        placeholder="model id"
        list="model-list"
      />
      <datalist id="model-list" aria-label="Model suggestions">
        {models.map((m) => <option key={m} value={m}>{m}</option>)}
      </datalist>
      {models.length ? (
        <div className="max-h-52 overflow-y-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
          {models.slice(0, 60).map((m) => (
            <button
              key={m}
              onClick={() => setModel(m)}
              className="block w-full text-left px-4 py-2 text-[13px] border-b last:border-0 hover:bg-white/[0.07]"
              style={{ borderColor: "var(--line)", color: m === model ? "var(--accent-deep)" : "var(--ink)", fontWeight: m === model ? 700 : 400 }}
            >
              {m}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SettingsView({ boot, onDone }: { boot: Boot; onDone: () => void }) {
  const [presets, setPresets] = useState<Record<string, Preset>>({});
  const [presetId, setPresetId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [engineMsg, setEngineMsg] = useState("");

  useEffect(() => {
    loadSettings({ setPresets, setPresetId, setBaseUrl, setModel, setModels });
  }, []);

  const save = (extra: Record<string, unknown> = {}) =>
    saveSettings({ presetId, baseUrl, apiKey, model, extra, setBusy, onDone });
  const choose = (id: string) => choosePreset(id, presets, setPresetId, setBaseUrl, setModels, setModel);
  const useBuiltin = () => void useBuiltinEngine({ setBusy, setStatus, setPresetId, onDone });
  const discover = () => void discoverModels({ save, setBusy, setStatus, setModels });
  const test = () => void testProvider({ save, setBusy, setStatus, onDone });
  const testBuiltin = () => void testBuiltinEngine({ setBusy, setEngineMsg });

  return (
    <div className="max-w-2xl mx-auto">
      <SectionTitle
        title="AI settings"
        sub="The built-in engine is on by default: tutor, writing examiner, quiz builder, speech and transcription with zero setup. Connect your own provider below if you want a different brain."
      />

      <BuiltinEngineCard boot={boot} busy={busy} engineMsg={engineMsg} onTest={testBuiltin} onUse={useBuiltin} />
      <ProviderPresetCard presets={presets} presetId={presetId} onChoose={choose} />
      <EndpointCard boot={boot} baseUrl={baseUrl} setBaseUrl={setBaseUrl} apiKey={apiKey} setApiKey={setApiKey} busy={busy} status={status}
        onDiscover={discover} onTest={test} onSave={() => void save()} model={model} />
      <ModelCard model={model} setModel={setModel} models={models} />

      <Note>
        Speech synthesis and transcription always run on the built-in engine. Free local models work too: install Ollama,
        run ollama serve, pick the Ollama preset and press Discover.
      </Note>
    </div>
  );
}
