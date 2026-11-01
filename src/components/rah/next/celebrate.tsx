"use client";

/* ============================================================
   Task 115 — celebration layer.
   Two imperative, dependency-free effects the shell fires from
   its state refresh:
   - xpBurst(n): floating "+n XP" pieces (the dopamine loop for
     every graded card - XP went up, the screen says so).
   - confetti(): a level-up / milestone fanfare, ~90 CSS pieces,
     auto-cleaned, zero libraries ($0 rule).
   Both no-op under prefers-reduced-motion and never block boot:
   they only touch the DOM after the state that triggered them
   already arrived.
   ============================================================ */

const CONFETTI_COLORS = ["#4e8cff", "#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#ff6b81"];

function motionOff(): boolean {
  try {
    return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function confetti(count = 90): void {
  if (typeof document === "undefined" || motionOff()) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "rah-confetti-piece";
    p.setAttribute("aria-hidden", "true");
    const size = 6 + Math.random() * 6;
    p.style.width = `${Math.round(size)}px`;
    p.style.height = `${Math.round(size * (Math.random() > 0.5 ? 1 : 0.45))}px`;
    p.style.left = `${Math.random() * 100}vw`;
    p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    p.style.setProperty("--cx", `${Math.round((Math.random() - 0.5) * 220)}px`);
    p.style.setProperty("--cr", `${Math.round(360 + Math.random() * 720)}deg`);
    p.style.setProperty("--cd", `${(2.2 + Math.random() * 1.6).toFixed(2)}s`);
    p.style.animationDelay = `${(Math.random() * 0.35).toFixed(2)}s`;
    document.body.appendChild(p);
    window.setTimeout(() => p.remove(), 4600);
  }
}

export function xpBurst(amount: number): void {
  if (typeof document === "undefined" || motionOff()) return;
  if (amount <= 0) return;
  const layer = document.createElement("div");
  layer.className = "rah-xp-layer";
  layer.setAttribute("aria-hidden", "true");
  // Anchor: near the quiet header line on desktop, under the top bar on mobile.
  const wide = window.innerWidth >= 768;
  layer.style.top = wide ? "64px" : "76px";
  if (wide) {
    layer.style.right = "48px";
  } else {
    layer.style.left = "50%";
    layer.style.transform = "translateX(-50%)";
  }
  const n = Math.min(3, Math.max(1, Math.round(amount / 10)));
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "rah-xp-piece";
    s.textContent = `+${amount} XP`;
    s.style.animationDelay = `${(i * 0.16).toFixed(2)}s`;
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 2400);
}
