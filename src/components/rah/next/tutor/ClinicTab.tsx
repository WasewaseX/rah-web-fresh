"use client";

// ---------- Clinic: patterns + instant drill (TutorReport kind=clinic) ----------
// Split out of tutor.tsx: the component owns the hooks, the patterns card is
// a pure render block fed by props.

import { useCallback, useEffect, useState } from "react";
import { DrillCard } from "../coach/Blocks";
import type { Drill, DrillOutcome } from "@/lib/tutor/types";
import type { ClinicPayload } from "./shared";
import { GenerateBtn, TabBusy, TabError, postDrillOutcome, toDrill } from "./shared";

// The recurring-mistake patterns card with the re-mine action.
function PatternsCard({ data, busy, onRemine }: { data: ClinicPayload; busy: boolean; onRemine: () => void }) {
  return (
    <div className="card-rah p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
        Your recurring mistake patterns
      </div>
      <div className="mt-3 space-y-2">
        {data.patterns.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
            <span className="text-[13.5px] font-bold capitalize" style={{ color: "var(--text)" }}>{p.tag.replace(/_/g, " ")}</span>
            <span className="chip">×{p.count}</span>
          </div>
        ))}
      </div>
      {data.message && <div className="mt-3 text-[12.5px]" style={{ color: "var(--muted)" }}>{data.message}</div>}
      <div className="mt-4 text-center">
        <button className="btn-primary text-[13px]" disabled={busy} onClick={onRemine}>
          Re-mine mistakes and rebuild the drill
        </button>
      </div>
    </div>
  );
}

export function ClinicTab() {
  const [data, setData] = useState<ClinicPayload | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [posted, setPosted] = useState(false);

  const load = useCallback(async (generate: boolean) => {
    setBusy(true);
    setError(null);
    setDrill(null);
    setPosted(false);
    try {
      const r = await fetch("/api/tutor/clinic", { method: generate ? "POST" : "GET", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Clinic failed.");
      const payload = (j && j.patterns ? (j as ClinicPayload) : null);
      setData(payload);
      if (payload?.drill && payload.drill.items?.length) setDrill(toDrill(payload.drill));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // one-tick deferral: load() sets busy state synchronously (see above)
    const t = setTimeout(() => void load(false), 0);
    return () => clearTimeout(t);
  }, [load]);

  // DrillCard grades locally; the outcome goes to /api/tutor/event, which
  // records it and pays XP - the recovered loop, now closed.
  const onDrillDone = async (o: DrillOutcome) => {
    if (posted) return;
    setPosted(true);
    await postDrillOutcome(o);
  };

  return (
    <div className="space-y-3">
      {busy && <TabBusy label={loaded ? "Mining your real mistakes..." : "Loading clinic..."} />}
      {!busy && error && <TabError msg={error} retry={() => void load(true)} />}
      {!busy && !error && data && data.patterns.length > 0 && (
        <PatternsCard data={data} busy={busy} onRemine={() => void load(true)} />
      )}
      {!busy && !error && drill && (
        <DrillCard drill={drill} onDone={(o) => void onDrillDone(o)} />
      )}
      {!busy && !error && data && data.patterns.length === 0 && loaded && (
        <div className="card-rah px-5 py-4 text-[13.5px]" style={{ color: "var(--muted)" }}>
          {data.message ?? "No mistakes recorded yet. Use Tutor chat or grade some reviews first; the clinic mines real errors, not guesses."}
        </div>
      )}
      {!busy && !error && !data && loaded && (
        <GenerateBtn label="Mine my mistakes and build a 5-item drill" busy={busy} onClick={() => void load(true)} />
      )}
    </div>
  );
}
