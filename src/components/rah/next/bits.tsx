"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import {
  AudioWaveform,
  BarChart3,
  BookMarked,
  BookOpen,
  Gamepad2,
  Headphones,
  Layers,
  MessageCircle,
  Mic,
  PenLine,
  RotateCcw,
  Target,
  type LucideIcon,
} from "lucide-react";

/* ============================================================
   Task 115 — visual stimulation wave.
   StrandIcon: the vivid identity unit. Every strand owns a hue
   pair (bright -> deep) and a glyph; the tile paints gradients
   with a matching glow, so the home screen and progress surfaces
   read as a colorful system instead of a wall of identical gray
   cards. White glyphs sit on the 600-level deep stop (>=3:1
   graphics floor).
   ============================================================ */
type StrandSpec = { icon: LucideIcon; deep: string; bright: string; glow: string; label: string };
const STRANDS: Record<string, StrandSpec> = {
  review: { icon: RotateCcw, deep: "#4d7c0f", bright: "#a3e635", glow: "rgba(163, 230, 53, 0.35)", label: "spaced retrieval" },
  listening: { icon: Headphones, deep: "#2563eb", bright: "#60a5fa", glow: "rgba(96, 165, 250, 0.4)", label: "listening" },
  reading: { icon: BookOpen, deep: "#7c3aed", bright: "#a78bfa", glow: "rgba(167, 139, 250, 0.4)", label: "reading" },
  speaking: { icon: Mic, deep: "#059669", bright: "#34d399", glow: "rgba(52, 211, 153, 0.4)", label: "speaking" },
  writing: { icon: PenLine, deep: "#d97706", bright: "#fbbf24", glow: "rgba(251, 191, 36, 0.4)", label: "writing" },
  sound: { icon: AudioWaveform, deep: "#0d9488", bright: "#2dd4bf", glow: "rgba(45, 212, 191, 0.4)", label: "pronunciation" },
  grammar: { icon: BookMarked, deep: "#b45309", bright: "#fbbf24", glow: "rgba(251, 191, 36, 0.35)", label: "grammar" },
  placement: { icon: Target, deep: "#dc2626", bright: "#f87171", glow: "rgba(248, 113, 113, 0.4)", label: "placement" },
  checkpoint: { icon: Target, deep: "#dc2626", bright: "#f87171", glow: "rgba(248, 113, 113, 0.4)", label: "checkpoint" },
  tutor: { icon: MessageCircle, deep: "#4f46e5", bright: "#818cf8", glow: "rgba(129, 140, 248, 0.4)", label: "coach" },
  arcade: { icon: Gamepad2, deep: "#db2777", bright: "#f472b6", glow: "rgba(244, 114, 182, 0.4)", label: "arcade" },
  progress: { icon: BarChart3, deep: "#0d9488", bright: "#2dd4bf", glow: "rgba(45, 212, 191, 0.4)", label: "progress" },
  other: { icon: Layers, deep: "#475569", bright: "#94a3b8", glow: "rgba(148, 163, 184, 0.35)", label: "study" },
};

export function StrandIcon({
  strand,
  size = 40,
  iconSize,
  radius = 14,
}: {
  strand: string;
  size?: number;
  iconSize?: number;
  radius?: number;
}) {
  const spec = STRANDS[strand] ?? STRANDS.other;
  const Icon = spec.icon;
  const isz = iconSize ?? Math.round(size * 0.5);
  return (
    <span
      aria-hidden
      className="rah-tile"
      title={spec.label}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${spec.bright} 0%, ${spec.deep} 100%)`,
        "--tile-glow": spec.glow,
      } as React.CSSProperties}
    >
      <Icon style={{ width: isz, height: isz }} strokeWidth={2.4} />
    </span>
  );
}

export function strandColors(strand: string): { deep: string; bright: string } {
  const spec = STRANDS[strand] ?? STRANDS.other;
  return { deep: spec.deep, bright: spec.bright };
}
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
  // Task 109: sub used to share the row with `right`, so a long sentence
  // collided with the right-side element on narrow screens. The title row
  // (title + right) stands alone; the sub gets the full width below it.
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="display text-[26px] md:text-[32px] font-bold leading-tight">{title}</h1>
        {right}
      </div>
      {sub ? <p className="text-[13.5px] mt-1.5 leading-relaxed" style={{ color: "var(--muted)" }}>{sub}</p> : null}
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
      </div>
      {/* Task 109: the delta was a squished inline "-20%" that read like a
         typo. It gets its own line, an arrow, and names its comparison. */}
      {delta !== undefined && delta !== 0 ? (
        <div
          className="text-[12px] mt-0.5 font-bold"
          style={{ color: delta > 0 ? "var(--c-green)" : "var(--danger)" }}
          title="change vs the previous week"
        >
          {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} pts vs last week
        </div>
      ) : null}
      <div className={cn("text-[12px] mt-0.5 font-medium", delta !== undefined && delta !== 0 && "mt-1")} style={{ color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

export function Bar({
  pct,
  color = "var(--accent)",
  h = 8,
  deep,
  bright,
}: {
  pct: number;
  color?: string;
  h?: number;
  deep?: string;
  bright?: string;
}) {
  // Task 115: the fill is now a gradient (deep -> bright) with a sheen
  // sweep; callers pass a strand's pair via deep/bright or keep the old
  // single-color API (color feeds both stops). Reduced motion stills the
  // sheen in globals.css.
  const fillDeep = deep ?? color;
  const fillBright = bright ?? color;
  return (
    // Task 109: the track was the light-era cream #efeee7 - a pale fossil
    // on the Midnight theme. Track = hairline white, like every border.
    <div className="rah-bar" style={{ height: h }}>
      <div
        className="rah-bar-fill"
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          "--bar-deep": fillDeep,
          "--bar-bright": fillBright,
        } as React.CSSProperties}
      />
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
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255, 255, 255, 0.08)" strokeWidth={stroke} fill="none" />
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
  // Task 109: the info tone was a light-era cream block (#f4f3ec) with
  // light-theme text colors - a blinding fossil inside Midnight views.
  // All four tones now come from the theme's dim/tint token families.
  const bg = tone === "warn" ? "var(--amber-dim)" : tone === "error" ? "var(--danger-dim)" : tone === "accent" ? "var(--accent-dim)" : "rgba(255, 255, 255, 0.045)";
  const fg = tone === "warn" ? "var(--c-gold-tint)" : tone === "error" ? "var(--c-red-tint)" : tone === "accent" ? "var(--accent-deep)" : "var(--text-soft)";
  return (
    <div className="rounded-2xl border px-4 py-3 text-[13.5px] leading-relaxed" style={{ background: bg, color: fg, borderColor: tone === "warn" ? "rgba(255, 176, 46, 0.25)" : tone === "error" ? "rgba(255, 107, 129, 0.25)" : "var(--line)" }}>
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

export function EmptyState({
  title,
  body,
  action,
  strand,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  strand?: string;
}) {
  // Task 115: an optional strand tile gives the empty state a face -
  // a glowing gradient glyph instead of bare text on a gray card.
  return (
    <div className="card-rah rah-lift p-10 text-center">
      {strand ? (
        <div className="mb-4 flex justify-center">
          <StrandIcon strand={strand} size={56} radius={18} />
        </div>
      ) : null}
      <div className="display text-[20px] font-bold mb-2">{title}</div>
      <p className="text-[14px] mb-5 max-w-md mx-auto leading-relaxed" style={{ color: "var(--muted)" }}>{body}</p>
      {action}
    </div>
  );
}
