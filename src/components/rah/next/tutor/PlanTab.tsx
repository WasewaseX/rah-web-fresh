"use client";

// ---------- Plan: 7-day plan (TutorReport kind=plan) ----------
// Split out of tutor.tsx; the load/defer effect pattern is the shared tab
// convention (one-tick deferral so no effect body sets state synchronously).

import { useCallback, useEffect, useState } from "react";
import type { PlanPayload } from "./shared";
import { GenerateBtn, TabBusy, TabError } from "./shared";

export function PlanTab() {
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (generate: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tutor/plan", { method: generate ? "POST" : "GET", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Plan failed.");
      if (j && j.days) setPlan(j as PlanPayload);
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

  return (
    <div className="space-y-3">
      {busy && <TabBusy label={loaded ? "Writing your 7-day plan..." : "Loading plan..."} />}
      {!busy && error && <TabError msg={error} retry={() => void load(true)} />}
      {!busy && !error && plan && (
        <div className="card-rah p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
            This week, one goal
          </div>
          <div className="mt-1.5 text-[15px] font-bold leading-relaxed" style={{ color: "var(--text)" }}>{plan.goal}</div>
          <div className="mt-4 space-y-2.5">
            {plan.days.map((d) => (
              <div key={d.day} className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black" style={{ background: "var(--accent)", color: "#fff" }}>
                    {d.day}
                  </span>
                  <span className="text-[13.5px] font-bold" style={{ color: "var(--text)" }}>{d.focus}</span>
                </div>
                <div className="mt-2 space-y-1 pl-8">
                  {d.tasks.map((t, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span style={{ color: "var(--text-soft)" }}>{t.text}</span>
                      <span className="shrink-0 text-[11px] font-bold" style={{ color: "var(--muted)" }}>{t.minutes}m</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <button className="btn-primary text-[13px]" disabled={busy} onClick={() => void load(true)}>
              Rewrite the plan from today&apos;s evidence
            </button>
          </div>
        </div>
      )}
      {!busy && !error && !plan && loaded && (
        <GenerateBtn label="Build my 7-day plan" busy={busy} onClick={() => void load(true)} />
      )}
    </div>
  );
}
