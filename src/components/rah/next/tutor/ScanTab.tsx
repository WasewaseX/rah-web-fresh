"use client";

// ---------- Scan: band diagnostic (TutorReport kind=scan) ----------
// Split out of tutor.tsx: the component owns the hooks, the report card is a
// pure render block fed by props.

import { useCallback, useEffect, useState } from "react";
import type { ScanPayload } from "./shared";
import { GenerateBtn, TabBusy, TabError } from "./shared";

// The diagnosis card: band, verdict, strengths/weaknesses and the "start
// today" actions block.
function ScanReportCard({ scan, busy, onRescan }: { scan: ScanPayload; busy: boolean; onRescan: () => void }) {
  const conf = Math.round((scan.confidence ?? 0) * 100);
  return (
    <div className="card-rah p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
          Where you stand
        </div>
        <span className="chip">{conf < 40 ? "low evidence" : conf < 70 ? "fair evidence" : "strong evidence"}</span>
      </div>
      <div className="mt-2 flex items-end gap-3">
        <div className="display text-[38px] leading-none" style={{ color: "var(--accent-deep)" }}>{scan.band}</div>
        <div className="pb-1.5 text-[12px]" style={{ color: "var(--muted)" }}>provisional CEFR band, practice estimate</div>
      </div>
      <div className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--text)" }}>{scan.verdict}</div>
      {scan.strengths?.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Strengths</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {scan.strengths.map((s, i) => <span key={i} className="chip">{s}</span>)}
          </div>
        </div>
      )}
      {scan.weaknesses?.length > 0 && (
        <div className="mt-4 space-y-2">
          {scan.weaknesses.map((w, i) => (
            <div key={i} className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="text-[13px] font-bold" style={{ color: "var(--text)" }}>{w.point}</div>
              {w.fix && <div className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>Fix: {w.fix}</div>}
            </div>
          ))}
        </div>
      )}
      {scan.actions?.length > 0 && (
        <div className="mt-4 rounded-2xl p-3.5" style={{ background: "var(--accent)", opacity: 0.92 }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">Start today</div>
          <ul className="mt-1.5 space-y-1">
            {scan.actions.map((a, i) => (
              <li key={i} className="text-[13px] font-semibold text-white">· {a}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 text-center">
        <button className="btn-primary text-[13px]" disabled={busy} onClick={onRescan}>
          Re-scan with today&apos;s evidence
        </button>
      </div>
    </div>
  );
}

export function ScanTab() {
  const [scan, setScan] = useState<ScanPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (generate: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tutor/scan", { method: generate ? "POST" : "GET", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Scan failed.");
      if (j && j.report) setScan(j.report as ScanPayload);
      else setScan(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // one-tick deferral: load() sets busy state synchronously, and a mount
    // effect must not setState (cascading renders)
    const t = setTimeout(() => void load(false), 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-3">
      {busy && <TabBusy label={loaded ? "Reading your evidence and grading honestly..." : "Loading last diagnosis..."} />}
      {!busy && error && <TabError msg={error} retry={() => void load(true)} />}
      {!busy && !error && scan && <ScanReportCard scan={scan} busy={busy} onRescan={() => void load(true)} />}
      {!busy && !error && !scan && loaded && (
        <GenerateBtn
          label="Diagnose my level from reviews, writings, speaking and chats"
          busy={busy}
          onClick={() => void load(true)}
        />
      )}
    </div>
  );
}
