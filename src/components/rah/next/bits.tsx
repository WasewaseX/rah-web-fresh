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
   Task 117 — professional identity system (holder direction:
   "different colored buttons dont suit the ui and are
   unprofessional"). Identity is carried by the GLYPH, never by
   hue: every strand tile shares one neutral raised surface, so
   plan cards, stats and the login strip read as one system.
   Color is reserved for semantic signals (streak amber, success
   green, danger red) and the single app accent on actions.
   ============================================================ */
type StrandSpec = { icon: LucideIcon; label: string };
const STRANDS: Record<string, StrandSpec> = {
  review: { icon: RotateCcw, label: "spaced retrieval" },
  listening: { icon: Headphones, label: "listening" },
  reading: { icon: BookOpen, label: "reading" },
  speaking: { icon: Mic, label: "speaking" },
  writing: { icon: PenLine, label: "writing" },
  sound: { icon: AudioWaveform, label: "pronunciation" },
  grammar: { icon: BookMarked, label: "grammar" },
  placement: { icon: Target, label: "placement" },
  checkpoint: { icon: Target, label: "checkpoint" },
  tutor: { icon: MessageCircle, label: "coach" },
  arcade: { icon: Gamepad2, label: "arcade" },
  progress: { icon: BarChart3, label: "progress" },
  other: { icon: Layers, label: "study" },
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
      } as React.CSSProperties}
    >
      <Icon style={{ width: isz, height: isz }} strokeWidth={2.2} />
    </span>
  );
}

export function strandColors(_strand: string): { deep: string; bright: string } {
  // Task 117: strand hues retired. Kept as a neutral shim so any straggler
  // caller compiles; new code must use the single accent token instead.
  return { deep: "var(--rah-primary-action)", bright: "var(--rah-primary-action)" };
}

/* Task 117 — the Rah logo. "Rah" (راه) means "the road": the mark is a
   rounded-square tile in the app's accent with a white geometric R whose
   leg kicks forward like a road bending out of frame. Pure SVG, no
   fonts, no images; the PNG icon set in public/icons is rendered from
   the same geometry. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden role="img">
      <defs>
        <linearGradient id="rah-logo-g" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
          {/* Theme-following stops (owner request: the whole UI follows the
             chosen theme). Presentation attributes ignore var(), so the
             colors ride on style. color-mix darkens the deep stop with the
             same hue instead of a hardcoded navy. */}
          <stop offset="0" style={{ stopColor: "var(--rah-primary, #4e8cff)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--rah-primary-deep, #2f62c4)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--rah-primary-deep, #2f62c4) 78%, black)" }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#rah-logo-g)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="rgba(255,255,255,0.22)" />
      <rect x="2" y="2" width="28" height="12" rx="6" fill="white" opacity="0.08" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.2 23.2V8.8h7.3c3.15 0 5.25 1.9 5.25 4.7 0 1.95-1.05 3.5-2.75 4.2l3.35 5.5h-3.95l-2.85-4.9h-2.75v4.9H9.2zm3.6-7.9h3.45c1.55 0 2.5-.85 2.5-2.15s-.95-2.15-2.5-2.15H12.8v4.3z"
        fill="#ffffff"
      />
    </svg>
  );
}

export function Logo({ size = 26, showFa = false }: { size?: number; showFa?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <LogoMark size={size} />
      <span className="display font-bold" style={{ fontSize: size * 0.85 }}>
        Rah
      </span>
      {showFa ? (
        <span dir="rtl" className="fa-text font-bold" style={{ fontSize: size * 0.62, color: "var(--muted)" }}>
          راه
        </span>
      ) : null}
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
