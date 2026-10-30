"use client";

import { useEffect, useState } from "react";
import type { Boot } from "@/app/page";
import { SectionTitle, Note } from "./bits";

interface Preset {
  id: string;
  family: string;
  label: string;
  hint: string;
  base: string;
}

export default function SettingsView({ boot, onDone }: { boot: Boot; onDone: () => void }) {
  const [presets, setPresets] = useState<Record<string, Preset>>({});
  const [presetId, setPresetId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<"discover" | "test" | "save" | "builtin-test" | null>(null);
  const [status, setStatus] = useState<{ ok?: boolean; msg: string } | null>(null);
  const [engineMsg, setEngineMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        setPresets(j.presets ?? {});
        const pid: string = j.settings?.providerId ?? "";
        setPresetId(pid === "builtin" ? "" : pid);
        setBaseUrl(j.settings?.baseUrl ?? "");
        setModel(j.settings?.builtin ? "" : (j.settings?.model ?? ""));
        setModels(j.settings?.discovered ? (typeof j.settings.discovered === "string" ? JSON.parse(j.settings.discovered) : j.settings.discovered) : []);
      })
      .catch(() => undefined);
  }, []);

  const choose = (id: string) => {
    setPresetId(id);
    const p = presets[id];
    if (p) {
      setBaseUrl(p.base);
      setModels([]);
      setModel("");
    }
  };

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy("save");
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId, baseUrl, apiKey, model, ...extra }),
      });
      const j = await r.json();
      if (j.ok) onDone();
      return j;
    } finally {
      setBusy(null);
    }
  };

  // presetId "" means: use the built-in engine.
  const useBuiltin = async () => {
    setBusy("save");
    setStatus(null);
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: "", clearProvider: true, model: "" }),
      });
      const j = await r.json();
      if (j.ok) {
        setPresetId("");
        setStatus({ ok: true, msg: "Switched back to the built-in engine." });
        onDone();
      }
    } finally {
      setBusy(null);
    }
  };

  const discover = async () => {
    await save();
    setBusy("discover");
    setStatus(null);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discover" }),
      });
      const j = await r.json();
      if (j.ok) {
        setModels(j.models ?? []);
        setStatus(
          j.managed
            ? { ok: true, msg: "The built-in engine manages its own model. Discovery is for custom endpoints." }
            : { ok: true, msg: `${j.models.length} models found. Pick one below.` }
        );
      } else {
        setStatus({ ok: false, msg: j.error ?? "discovery failed" });
      }
    } catch {
      setStatus({ ok: false, msg: "network error" });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    await save();
    setBusy("test");
    setStatus(null);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const j = await r.json();
      setStatus(j.ok ? { ok: true, msg: `Connected. Replied in ${j.ms} ms.` } : { ok: false, msg: j.error ?? "test failed" });
      onDone();
    } catch {
      setStatus({ ok: false, msg: "network error" });
    } finally {
      setBusy(null);
    }
  };

  const testBuiltin = async () => {
    setBusy("builtin-test");
    setEngineMsg("");
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const j = await r.json();
      setEngineMsg(j.ok ? `Engine replied in ${j.ms} ms. Tutor, writing examiner, quiz builder, speech and transcription are live.` : j.error ?? "engine test failed");
    } catch {
      setEngineMsg("network error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <SectionTitle
        title="AI settings"
        sub="The built-in engine is on by default: tutor, writing examiner, quiz builder, speech and transcription with zero setup. Connect your own provider below if you want a different brain."
      />

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
          <button className="btn-ghost text-[13px]" disabled={busy !== null} onClick={testBuiltin}>
            {busy === "builtin-test" ? "Testing..." : "Test the engine"}
          </button>
          {!boot.ai.builtin ? (
            <button className="btn-primary text-[13px]" disabled={busy !== null} onClick={useBuiltin}>
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
              onClick={() => choose(p.id)}
              className="rounded-2xl border p-4 text-left"
              style={presetId === p.id ? { background: "var(--accent-dim)", borderColor: "transparent" } : { borderColor: "var(--line)" }}
            >
              <div className="font-bold text-[14px]">{p.label}</div>
              <div className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--muted)" }}>{p.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card-rah p-6 mb-4">
        <div className="font-bold text-[14.5px] mb-3">Endpoint and key</div>
        <label className="text-[12.5px] font-bold block mb-1">Base URL</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="w-full rounded-xl border px-4 py-2.5 text-[14px] mb-3"
          style={{ borderColor: "var(--line)", background: "#fff", outline: "none" }}
          placeholder="https://api.openai.com/v1"
        />
        <label className="text-[12.5px] font-bold block mb-1">
          API key {boot.ai.keyset ? <span className="font-normal" style={{ color: "var(--muted)" }}>(saved: {boot.ai.keyMasked}, leave blank to keep)</span> : null}
        </label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          type="password"
          className="w-full rounded-xl border px-4 py-2.5 text-[14px]"
          style={{ borderColor: "var(--line)", background: "#fff", outline: "none" }}
          placeholder={boot.ai.keyset ? "kept secret" : "sk-..."}
          autoComplete="off"
        />
        <div className="flex gap-2 mt-4 flex-wrap">
          <button className="btn-ghost text-[13px]" disabled={busy !== null || !baseUrl} onClick={discover}>
            {busy === "discover" ? "Discovering..." : "Discover models"}
          </button>
          <button className="btn-ghost text-[13px]" disabled={busy !== null || !model} onClick={test}>
            {busy === "test" ? "Testing..." : "Test connection"}
          </button>
          <button className="btn-primary text-[13px]" disabled={busy !== null} onClick={() => save()}>
            {busy === "save" ? "Saving..." : "Save and use this provider"}
          </button>
        </div>
        {status ? (
          <div className="mt-4">
            <Note tone={status.ok ? "accent" : "error"}>{status.msg}</Note>
          </div>
        ) : null}
      </div>

      <div className="card-rah p-6 mb-4">
        <div className="font-bold text-[14.5px] mb-3">Provider model</div>
        <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>
          {models.length ? "Found on your endpoint. Type to filter or paste any name." : "Discover models, or type a known name like gpt-4o-mini."}
        </p>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded-xl border px-4 py-2.5 text-[14px] mb-3"
          style={{ borderColor: "var(--line)", background: "#fff", outline: "none" }}
          placeholder="model id"
          list="model-list"
        />
        <datalist id="model-list">
          {models.map((m) => <option key={m} value={m} />)}
        </datalist>
        {models.length ? (
          <div className="max-h-52 overflow-y-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
            {models.slice(0, 60).map((m) => (
              <button
                key={m}
                onClick={() => setModel(m)}
                className="block w-full text-left px-4 py-2 text-[13px] border-b last:border-0 hover:bg-[#f4f3ec]"
                style={{ borderColor: "var(--line)", color: m === model ? "var(--accent-deep)" : "var(--ink)", fontWeight: m === model ? 700 : 400 }}
              >
                {m}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Note>
        Speech synthesis and transcription always run on the built-in engine. Free local models work too: install Ollama,
        run ollama serve, pick the Ollama preset and press Discover.
      </Note>
    </div>
  );
}
