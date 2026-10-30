"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path d="M9 23V9h7.2c3 0 5 1.8 5 4.5 0 2.2-1.3 3.8-3.4 4.3L23 23h-4.2l-4.5-4.8H12.4V23H9zm3.4-7.7h3.4c1.5 0 2.4-.8 2.4-2s-.9-1.9-2.4-1.9h-3.4v3.9z" fill="#fff" />
      </svg>
      <span className="display font-bold" style={{ fontSize: size * 0.85 }}>
        Rah
      </span>
    </span>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="display text-[26px] md:text-[32px] font-bold leading-tight">{title}</h1>
        {sub ? <p className="text-[13.5px] mt-1" style={{ color: "var(--muted)" }}>{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Stat({ value, label, delta, accent }: { value: string | number; label: string; delta?: number; accent?: boolean }) {
  return (
    <div className="card-rah p-4 flex-1 min-w-[120px]">
      <div className="flex items-baseline gap-2">
        <span className={cn("text-[26px] font-bold display", accent && "")} style={accent ? { color: "var(--accent)" } : undefined}>
          {value}
        </span>
        {delta !== undefined && delta !== 0 ? (
          <span className="text-[12px] font-bold" style={{ color: delta > 0 ? "var(--accent)" : "var(--danger)" }}>
            {delta > 0 ? "+" : ""}{delta}%
          </span>
        ) : null}
      </div>
      <div className="text-[12px] mt-0.5 font-medium" style={{ color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

export function Bar({ pct, color = "var(--accent)", h = 8 }: { pct: number; color?: string; h?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: "#efeee7", height: h }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

export function Ring({ pct, size = 74, stroke = 8, children }: { pct: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, pct / 100)));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#efeee7" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--accent)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Fa({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span dir="rtl" className={cn("fa-text inline-block", className)} style={{ color: "var(--muted)" }}>
      {children}
    </span>
  );
}

export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "error" | "accent" }) {
  const bg = tone === "warn" ? "var(--amber-dim)" : tone === "error" ? "var(--danger-dim)" : tone === "accent" ? "var(--accent-dim)" : "#f4f3ec";
  const fg = tone === "warn" ? "#8a5a12" : tone === "error" ? "#a03030" : tone === "accent" ? "var(--accent-deep)" : "var(--muted)";
  return (
    <div className="rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed" style={{ background: bg, color: fg }}>
      {children}
    </div>
  );
}

// Hands-free countdown used by speaking + checkpoints.
export function Countdown({ seconds, onDone, paused }: { seconds: number; onDone: () => void; paused?: boolean }) {
  const [left, setLeft] = useState(seconds);
  const cbRef = useRef(onDone);
  useEffect(() => {
    cbRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (paused) return;
    if (left <= 0) {
      cbRef.current();
      return;
    }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left, paused]);
  const pct = ((seconds - left) / seconds) * 100;
  return (
    <div className="flex items-center gap-3">
      <Ring pct={pct} size={52} stroke={6}>
        <span className="text-[13px] font-bold">{left}</span>
      </Ring>
    </div>
  );
}

export function RecordButton({ state, onClick }: { state: "idle" | "recording" | "unavailable"; onClick: () => void }) {
  if (state === "unavailable") return null;
  return (
    <button
      onClick={onClick}
      className={cn("btn-primary inline-flex items-center gap-2", state === "recording" && "animate-pulse")}
      style={state === "recording" ? { background: "var(--danger)" } : undefined}
    >
      <span className="inline-block w-3 h-3 rounded-full bg-white" style={{ opacity: state === "recording" ? 1 : 0.7 }} />
      {state === "recording" ? "Stop recording" : "Record"}
    </button>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card-rah p-10 text-center">
      <div className="display text-[20px] font-bold mb-2">{title}</div>
      <p className="text-[14px] mb-5 max-w-md mx-auto leading-relaxed" style={{ color: "var(--muted)" }}>{body}</p>
      {action}
    </div>
  );
}
