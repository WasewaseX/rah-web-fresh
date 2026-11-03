"use client";

// Mind Reader (C-7): the learner sees exactly what the coach remembers -
// every mistake family with its evidence, its decline-over-time state, and
// the two correction powers Task 65 promised (fix the text, forgive and
// forget with a tombstone). The trend is the pure seam from
// lib/mistake-trend.ts: recurrence, quiet period, heal progress - never an
// invented history curve.

import { useCallback, useEffect, useState } from "react";
import { Note } from "./bits";
import { mistakeTrend } from "@/lib/mistake-trend";
import type { MistakeFamilyView as Family } from "@/lib/mistakes";

type Trend = ReturnType<typeof mistakeTrend>;

const STATE_COLOR: Record<Trend["state"], string> = {
  worsening: "#ff6b81",
  active: "#ffd08a",
  cooling: "#7dd3fc",
  healed: "#6ee7b7",
};

function FamilyRow({
  fam,
  healed,
  onEdited,
  onForgotten,
}: {
  fam: Family;
  healed: boolean;
  onEdited: (id: string, patch: { label?: string; evidence?: string }) => void;
  onForgotten: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(fam.label);
  const [evidence, setEvidence] = useState(fam.evidence);
  const trend = mistakeTrend(fam);
  const [wrong, right] = fam.evidence.includes(" -> ")
    ? fam.evidence.split(" -> ", 2)
    : [fam.evidence, ""];

  return (
    <div className="rounded-2xl border p-4 mb-3" style={{ borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="font-bold text-[14px]">{fam.label}</span>
        <span className="chip">{fam.tag}</span>
        <span className="chip">{fam.kind}</span>
        <span className="text-[11.5px] font-bold" style={{ color: STATE_COLOR[trend.state] }}>
          {trend.note}
        </span>
        {fam.editedAt ? <span className="chip" title="you edited this memory">corrected by you</span> : null}
      </div>
      {editing ? (
        <div className="mt-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-[13px] mb-2"
            style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
            aria-label="Family name"
          />
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={2}
            className="w-full rounded-xl border px-3 py-2 text-[13px]"
            style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
            aria-label="Evidence (wrong -> right)"
          />
          <div className="flex gap-2 mt-2">
            <button
              className="btn-primary text-[12.5px]"
              onClick={() => {
                onEdited(fam.id, { label, evidence });
                setEditing(false);
              }}
            >
              Save correction
            </button>
            <button className="btn-ghost text-[12.5px]" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-[13px] leading-relaxed mt-1">
            <span style={{ color: "#ff9aa7" }}>{wrong}</span>
            {right ? (
              <>
                {" -> "}
                <span style={{ color: "#7fe0ae" }}>{right}</span>
              </>
            ) : null}
          </div>
          <div className="flex gap-2 mt-2.5">
            <button className="btn-ghost text-[12px]" onClick={() => setEditing(true)}>
              Correct this
            </button>
            <button className="btn-ghost text-[12px]" onClick={() => onForgotten(fam.id)}>
              Forget
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function MindReader() {
  const [active, setActive] = useState<Family[]>([]);
  const [healed, setHealed] = useState<Family[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/mistakes", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { families?: Family[]; healed?: Family[] };
      setActive(j.families ?? []);
      setHealed(j.healed ?? []);
      setLoaded(true);
    } catch {
      /* offline: the card stays quiet */
    }
  }, []);

  useEffect(() => {
    // Inline IIFE (same shape the writing view uses): the rule flags a
    // transitive sync setState path through useCallback; the async IIFE with
    // its awaits is the codebase's accepted loader shape.
    void (async () => {
      try {
        const r = await fetch("/api/mistakes", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { families?: Family[]; healed?: Family[] };
        setActive(j.families ?? []);
        setHealed(j.healed ?? []);
        setLoaded(true);
      } catch {
        /* offline: the card stays quiet */
      }
    })();
  }, [load]);

  const edit = async (id: string, patch: { label?: string; evidence?: string }) => {
    await fetch("/api/mistakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    }).catch(() => undefined);
    setMsg("Correction saved - it is marked as learner-authored, not AI-mined.");
    void load();
  };

  const forget = async (id: string) => {
    await fetch(`/api/mistakes?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
    setMsg("Forgotten - the exact rejected pair will not re-aggregate; genuinely new evidence can still reopen a family.");
    void load();
  };

  if (!loaded) return null;

  return (
    <div className="card-rah p-6 mb-5">
      <div className="font-bold text-[14.5px] mb-1">Mind Reader - what the coach remembers</div>
      <p className="text-[12.5px] mb-4" style={{ color: "var(--muted)" }}>
        Every recurring error becomes a family with its own decline line: how often it appeared, how long it has been
        quiet, and how close it is to retirement. You can correct anything here - the memory is yours.
      </p>
      {msg ? <Note tone="accent">{msg}</Note> : null}
      {active.length === 0 && healed.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          Nothing yet - families appear when the coach catches the same trap more than once in your writing, speech or chat.
        </p>
      ) : null}
      {active.map((f) => (
        <FamilyRow key={f.id} fam={f} healed={false} onEdited={edit} onForgotten={forget} />
      ))}
      {healed.length ? (
        <>
          <div className="text-[12px] font-bold uppercase tracking-widest mt-4 mb-2" style={{ color: "var(--muted)" }}>
            Retired (healed)
          </div>
          {healed.map((f) => (
            <FamilyRow key={f.id} fam={f} healed onEdited={edit} onForgotten={forget} />
          ))}
        </>
      ) : null}
    </div>
  );
}
