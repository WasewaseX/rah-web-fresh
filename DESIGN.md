---
name: Rah
description: One learner's honest road from B2 to C1 — a midnight-dark, single-learner English tutor.
colors:
  midnight-base: "#10131a"
  midnight-surface: "#1a1f2b"
  midnight-surface-deep: "#151c2b"
  midnight-card-grad-end: "#121826"
  rah-primary: "#4e8cff"
  rah-primary-deep: "#2650a3"
  rah-primary-action: "#2f62c4"
  rah-accent-cyan: "#4cc9f0"
  ink-high: "#f2f5fa"
  ink-mid: "#dbe3f0"
  ink-soft: "#a9b4c6"
  ink-faint: "#8b96a9"
  signal-green: "#3ccb7f"
  signal-gold: "#ffb02e"
  signal-red: "#ff6b81"
  line-hairline: "rgba(255, 255, 255, 0.07)"
  primary-ink: "#0b1220"
  strand-review: "#4d7c0f"
  strand-review-bright: "#a3e635"
  strand-listening: "#2563eb"
  strand-listening-bright: "#60a5fa"
  strand-reading: "#7c3aed"
  strand-reading-bright: "#a78bfa"
  strand-speaking: "#059669"
  strand-speaking-bright: "#34d399"
  strand-writing: "#d97706"
  strand-writing-bright: "#fbbf24"
  strand-sound: "#0d9488"
  strand-sound-bright: "#2dd4bf"
  strand-grammar: "#b45309"
  strand-grammar-bright: "#fbbf24"
  strand-other: "#475569"
  strand-other-bright: "#94a3b8"
  xp-gold: "#ffd166"
  deck-new: "#d9d7cd"
  grade-hard: "#b7791f"
  scrollbar-thumb: "#2a3242"
  scrollbar-thumb-hover: "#39445a"
  shadow-ink: "rgba(0, 0, 0, 0.6)"
  perk-gold: "#ffd08a"
  perk-mint: "#7fe0ac"
  perk-sky: "#9de6fb"
  mail-bg: "#16233e"
  mail-band: "#2a3a5c"
  mail-link: "#9dc0ff"
  mail-muted: "#5d6879"
typography:
  display:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontWeight: 900
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontWeight: 800
  body:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontWeight: 400
  label:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontWeight: 700
  farsi:
    fontFamily: "var(--font-vazir), system-ui, sans-serif"
rounded:
  card: "18px"
  control: "12px"
  field: "16px"
  chip: "999px"
  base: "0.75rem"
spacing:
  card-pad: "24px"
  grid-gap: "16px"
  section-gap: "20px"
components:
  card:
    backgroundColor: "linear-gradient(180deg, {colors.midnight-surface-deep} 0%, {colors.midnight-card-grad-end} 100%)"
    textColor: "{colors.ink-high}"
    rounded: "{rounded.card}"
  button-primary:
    backgroundColor: "{colors.rah-primary-action}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "11px 18px"
    edge: "rah-3d hard offset 0 4px 0 0 {colors.rah-primary-deep} - INTENTIONAL tactile press edge (Duolingo-style), not a slop shadow"
  button-primary-hover:
    backgroundColor: "{colors.rah-primary}"
  chip:
    backgroundColor: "rgba(255, 255, 255, 0.045)"
    textColor: "{colors.ink-mid}"
    rounded: "{rounded.chip}"
    padding: "3px 10px"
---

# Design System: Rah

## Overview

**Creative North Star: "The Night Road"**

Rah looks like studying at night by good lamplight on a long road: a midnight room (deep blue-gray, never pure black), one blue signal light for everything that wants your action, and warm gold only where memory needs marking. The road metaphor governs composition — progress is a path with a day count, not a dashboard of vanity dials. Density is calm: one primary action per view, generous card padding, no nested cards, no decoration that doesn't carry information.

This is an **Operate** product (the visitor completes study tasks) with one Persuade-adjacent surface (the home road). Ambition shows as precision and restraint: native-feeling controls, Duolingo-grade pressable buttons, Farsi text rendered with its own face and true RTL.

**Key Characteristics:**
- Dark-by-design Midnight theme; a single blue accent family; green/gold/red reserved as semantic signals (correct, attention, error).
- **Strand identity (Task 117, holder-directed: "different colored buttons dont suit the ui and are unprofessional"):** identity is carried by the GLYPH, never by hue. Every strand tile shares one neutral raised surface (`rah-tile`: #2d3648→#232b3c, hairline border, ink glyph); plan bars and progress fills wear the single accent. The Task 115 per-strand hue pairs are RETIRED from controls, tiles, bars and charts — the rainbow reads amateur, and color is now spent only where it means something: the one action accent (One Light Rule), semantic signals (correct green, streak gold, danger red, deck-state tones). Progress/strand charts that need series separation use the accent ramp by LIGHTNESS, not by hue.
- Two hairline layer systems: `--line` borders and one soft ambient gradient wash on the body — depth comes from tonal layering, not stacked shadows.
- Pressable 3D buttons with a solid bottom edge that compresses on `:active` — tactile, physical, never glossy.
- Motion is short, spring-eased and purposeful: rise-in on view change, pop on reveal, pulse only while recording, shake only on a misstep. Ambient identity loops (bar sheen sweep, hero breathe, streak flame flicker) are the one sanctioned exception to the 400ms ceiling — they carry mood, not information, and all of them go still under `prefers-reduced-motion`.
- Celebration is earned, never ambient: XP gains float a brief "+n XP" burst; level-ups rain a one-shot CSS confetti (zero dependencies). Both are DOM-spawned, self-cleaning and motion-off aware.

## Colors

A restrained midnight palette: one blue light source, three semantic signals, layered neutrals.

### Primary
- **Rah Signal Blue** (#4e8cff): the only action color. Primary buttons, links, active nav, bars that mean "this is your work", focus rings. The deep variant (#2650a3) is the button's bottom edge.

### Secondary
- **Lamp Cyan** (#4cc9f0): informational highlights inside payloads and charts; never a button fill. Partner wash: rgba(78,140,255,.07) ambient gradients.

### Tertiary
- **Proven Green** (#3ccb7f): correctness, mature memory, pass states.
- **Attention Gold** (#ffb02e): young/fragile memory, warnings, "worth another look".
- **Honest Red** (#ff6b81): errors, lapses, recording state. Recording uses the same red as errors deliberately: both mean "live and needs care".

### Neutral
- **Midnight Base** (#10131a): app background.
- **Surface** (#1a1f2b) and its card gradient (#151c2b→#121826): cards, sheets, sidebar.
- **Ink High** (#f2f5fa) / **Ink Mid** (#dbe3f0) / **Ink Soft** (#a9b4c6) / **Ink Faint** (#8b96a9): the four-level text ladder. Body text never sits below Ink Soft on interactive surfaces.
- **Hairline** (rgba(255,255,255,.07)): every border in the app. Two hairlines never stack.
- **Browser surfaces** (scrollbar-thumb #2a3242, hover #39445a): the parts the browser draws still carry the palette.
- **shadow-ink** (rgba(0,0,0,.6)): the one deep card shadow's ink; depth comes from tonal layering plus this single shadow.
- **Perk tones** (perk-gold #ffd08a, perk-mint #7fe0ac, perk-sky #9de6fb): tinted highlights on earned battle-card perk names — tints of the gold/green/cyan signals, never new hues.
- **Mail medium** (mail-bg #16233e, mail-band #2a3a5c, mail-link #9dc0ff, mail-muted #5d6879): the login-code email renders inside mail clients where app tokens don't reach; it keeps the same midnight family.

### Named Rules
**The One Light Rule.** Signal blue is the only element that may demand action on a screen. If two competing blues fight for attention, one of them is wrong.
**The Earned Color Rule.** Green/gold/red appear only as measurements of real learner data — never as decoration.
**No Purple Gradient Rule.** The holder's standing ban: no purple gradients, no generic AI aesthetics, no decorative pills, no fake metrics.
**Data-viz ramp rule.** Chart fills use the tokenized strand ramp (`--rah-strand-*`, one hue per strand; review strand = signal blue) and the deck-state tones (`--rah-deck-new` parchment for new, gold for young, blue for mature) — ramp colors are measurements, never decoration.

## Typography

**Display Font:** Geist Sans (system-ui fallback) — weights 900/800 for display and headings
**Body Font:** Geist Sans (system-ui fallback) — 400–600
**Farsi Font:** Vazir (`--font-vazir`), always with `dir="rtl"` and the `.fa-text` class

**Character:** One sans family across the app; hierarchy is carried by weight and size, not by mixing faces. Farsi gets its own face and true RTL — it is a first-class language here, not an afterthought.

### Hierarchy
- **Display** (900, 19–26px, -0.02em tracking): view titles, the big number in a stat, stage headlines.
- **Headline** (800, 14.5–17px): card titles, section leads.
- **Body** (400–500, 13.5–15.5px, 1.6–1.8 line-height): explanations, prompt text; the "why" paragraphs are the voice of the product.
- **Label** (700, 11.5–13px): chips, stat labels, nav, buttons (800).
- **Farsi** (400–500, 12.5–14px): explanation lines under English corrections.

### Named Rules
**The Why Paragraph Rule.** Every exercise carries a short paragraph explaining why it exists; it renders at body size in Ink Soft — the product teaches in prose, and prose is never smaller than 13px.

## Layout

Single-column study flow, max-width ~3xl (768px) for reading/writing surfaces; 2-column card grids (md:grid-cols-2, 16px gap) for dashboards; 4-across stat rows collapsing 2×2 on mobile. Sidebar rail on desktop (icons + labels), bottom-adjacent mobile nav at 390px. Section rhythm: 20px between blocks, 24px card padding. Reading measure 60–75ch. Content sits above a fixed ambient gradient wash; the optional WebGL backdrop is room lighting behind everything, never behind text panels.

## Elevation & Depth

Tonal layering first, one shadow vocabulary second. Cards are a vertical gradient two steps lighter than base with a hairline border and a single deep soft shadow (`0 14px 34px -22px rgba(0,0,0,.6)`). Primary buttons cast a colored ambient shadow (`0 10px 22px -8px rgba(78,140,255,.55)`) plus their solid bottom edge — the edge IS the depth cue, and it compresses on press. No floating popovers above cards; sheets replace modals where possible.

## Shapes

Cards 18px radius; controls (buttons, inputs, option rows) 12–16px; chips and dots 999px. One border weight everywhere: 1px hairline. Inputs are filled fields (#262d3b family) with hairline borders, focus marked by the signal-blue ring, never by a color change alone.

## Components

- **card-rah**: the universal container. Gradient surface + hairline + one shadow. Never nested inside another card-rah.
- **btn-primary**: signal blue, 800 weight, 12px radius, pressable 3D edge. One per view. Destructive/recording actions use Honest Red with the same geometry.
- **chip**: metadata only (word ranges, states). 700 weight, 12px. Not a decoration system — if a view needs more than ~3 chips, the hierarchy is wrong.
- **Stat**: big display number + 11.5px Ink Soft label; delta rendered as signed colored value (green up, red down) only when the delta is real.
- **Bar**: 4–8px rounded track with fill in the signal color; percentage labels honest (0 shows 0).
- **Empty state**: one calm sentence in Ink Soft naming what will appear here and why it matters; never an illustration-only void, never a fake number.
- **Loading**: text-first ("crunching your history..."), never a spinner on a blank page.
- **Error/auth state**: honest sentence + the recovery path ("Sign in again from the Home screen…").

## Do's and Don'ts

- **Do** keep one primary action per view; everything else is secondary (ghost/quiet).
- **Do** show real numbers only. An empty stat shows 0 or the state is omitted, never estimated.
- **Don't** introduce a second ACTION accent hue (One Light Rule), a glassmorphism panel, or a new chip color per section. (Amended Task 117: per-strand identity hues are retired everywhere — tiles, bars, chips, charts; color on controls is the single action accent plus semantic signals only. Purple as an ACTION color and decorative purple gradients remain banned.)
- **Don't** nest cards inside cards; use hairline dividers inside a card instead.
- **Don't** animate anything longer than 400ms except the recording pulse; honor `prefers-reduced-motion` everywhere (the backdrop already does).
- **Don't** render Farsi without `.fa-text` + `dir="rtl"`.
- **Don't** add a dependency for what a CSS token or 20-line keyframe can do (4 GB budget, $0 rule).

### Strand identity map (Task 117)

`StrandIcon` (in `next/bits.tsx`) is the identity unit: ONE neutral raised tile (linear-gradient #2d3648→#232b3c, hairline border, inset highlight) carrying the strand's lucide glyph in ink (#dbe3f0, ≥3:1 on the surface). The glyph DIFFERENTIATES; the surface never does. `Bar` wears the single action accent. The per-strand hue map, the `--rah-strand-*` chart ramp and the deep/bright `Bar` props are retired (Task 117); charts needing series separation step the accent's LIGHTNESS. The logo (`Logo` in bits.tsx + `public/logo.svg` + `public/icons/*.png` rendered by `scripts/render-logo.sh`) is the accent tile with a white geometric R — "Rah" (راه) means "the road".

| Strand | Glyph |
|---|---|
| review | RotateCcw |
| listening | Headphones |
| reading | BookOpen |
| speaking | Mic |
| writing | PenLine |
| sound | AudioWaveform |
| grammar | BookMarked |
| placement/checkpoint | Target |
| tutor | MessageCircle |
| arcade | Gamepad2 |
| other | Layers |
