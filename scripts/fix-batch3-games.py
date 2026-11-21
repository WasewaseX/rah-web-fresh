"""Cycle 5 bulk fix, batch 3: games.

Typed-answer game inputs gain aria-labels (control-has-associated-label),
autoFocus comes off (no-autofocus), and the two dead normalize helpers go.
"""
import pathlib

ROOT = pathlib.Path("/home/z/my-project/src/components/rah/games")

def patch(fn, old, new, count=1):
    p = ROOT / fn
    s = p.read_text()
    n = s.count(old)
    if n == 0 and new in s:
        print(f"skip  {fn}: already applied")
        return
    assert n == count, f"{fn}: expected {count}, found {n}: {old[:60]!r}"
    p.write_text(s.replace(old, new))
    print(f"ok    {fn}: {old.splitlines()[0].strip()[:52]!r}")

# --- Gauntlet ---------------------------------------------------------------
patch("Gauntlet.tsx",
      "\nfunction normalize(s: string): string {\n  return s.toLowerCase().replace(/[.,!?;:'\"()]/g, \"\").replace(/\\s+/g, \" \").trim();\n}\n",
      "")
patch("Gauntlet.tsx",
      "                  placeholder=\"One life. Answer...\"\n",
      "                  placeholder=\"One life. Answer...\"\n                  aria-label=\"Gauntlet answer\"\n")
patch("Gauntlet.tsx",
      "                  className=\"min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[var(--rah-primary)]/50\"\n                  autoFocus\n",
      "                  className=\"min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[var(--rah-primary)]/50\"\n")

# --- Dungeon ------------------------------------------------------------------
patch("Dungeon.tsx",
      "\nfunction normalize(s: string): string {\n  return s.toLowerCase().replace(/[.,!?;:'\"()]/g, \"\").replace(/\\s+/g, \" \").trim();\n}\n",
      "")
patch("Dungeon.tsx",
      "                  placeholder=\"Write your answer...\"\n",
      "                  placeholder=\"Write your answer...\"\n                  aria-label=\"Dungeon answer\"\n")
patch("Dungeon.tsx",
      "                  className=\"min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[var(--rah-primary)]/50\"\n                  autoFocus\n",
      "                  className=\"min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[var(--rah-primary)]/50\"\n")

# --- Flow ---------------------------------------------------------------------
patch("Flow.tsx",
      "                  placeholder=\"Calm and precise...\"\n",
      "                  placeholder=\"Calm and precise...\"\n                  aria-label=\"Flow answer\"\n")
patch("Flow.tsx",
      "                  className=\"min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[#3ccb7f]/50\"\n                  autoFocus\n",
      "                  className=\"min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[#3ccb7f]/50\"\n")

# --- Duel -----------------------------------------------------------------------
patch("Duel.tsx",
      "                  placeholder=\"Fast - type it...\"\n",
      "                  placeholder=\"Fast - type it...\"\n                  aria-label=\"Duel answer\"\n")
patch("Duel.tsx",
      "                  className=\"min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[var(--rah-primary)]/50\"\n                  autoFocus\n",
      "                  className=\"min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[var(--rah-primary)]/50\"\n")

# --- BossBattle ------------------------------------------------------------------
patch("BossBattle.tsx",
      "                  placeholder={item.q.includes(\"___\") ? \"Fill the blank\" : \"Type the English\"}\n                  className=\"min-h-12 flex-1 rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-base text-[#f2f5fa] outline-none placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]\"\n                  dir=\"ltr\"\n",
      "                  placeholder={item.q.includes(\"___\") ? \"Fill the blank\" : \"Type the English\"}\n                  aria-label=\"Boss battle answer\"\n                  className=\"min-h-12 flex-1 rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-base text-[#f2f5fa] outline-none placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]\"\n                  dir=\"ltr\"\n")

# --- SpeedRound -------------------------------------------------------------------
patch("SpeedRound.tsx",
      "                  placeholder={item.q.includes(\"___\") ? \"Fill the blank\" : \"Type the English\"}\n                  className=\"min-h-12 flex-1 rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-base text-[#f2f5fa] outline-none placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]\"\n                  dir=\"ltr\"\n",
      "                  placeholder={item.q.includes(\"___\") ? \"Fill the blank\" : \"Type the English\"}\n                  aria-label=\"Speed round answer\"\n                  className=\"min-h-12 flex-1 rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-base text-[#f2f5fa] outline-none placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]\"\n                  dir=\"ltr\"\n")

print("batch 3 complete")
