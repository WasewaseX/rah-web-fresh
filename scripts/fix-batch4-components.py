"""Cycle 5 bulk fix, batch 4: live components (labels, purity, deps, dead code).

Empirical rule-book (verified against the repo's own jsx-a11y config):
- only aria-label satisfies control-has-associated-label (htmlFor/label-wrap/
  placeholder do NOT count);
- <datalist> needs its own aria-label; each <option> needs text or aria-label.
"""
import pathlib

ROOT = pathlib.Path("/home/z/my-project/src")

def patch(rel, old, new, count=1):
    p = ROOT / rel
    s = p.read_text()
    n = s.count(old)
    if n == 0 and new in s:
        print(f"skip  {rel}: already applied")
        return
    assert n == count, f"{rel}: expected {count}, found {n}: {old[:70]!r}"
    p.write_text(s.replace(old, new))
    print(f"ok    {rel}: {old.splitlines()[0].strip()[:56]!r}")

# ---------------------------------------------------------------- CoachSidebar
patch("components/rah/CoachSidebar.tsx",
      "import type { ViewId } from \"./App\";\nimport type { AppState } from \"./App\";",
      "import type { AppState, ViewId } from \"./App\";")
patch("components/rah/CoachSidebar.tsx",
      "    } catch {}\n  }\n  return \"(older turn",
      "    } catch {\n      // unparseable protocol marker - fall through to the leak notice\n    }\n  }\n  return \"(older turn")
patch("components/rah/CoachSidebar.tsx",
      "      } catch (e) {\n        if (ctrl.signal.aborted) {",
      "      } catch {\n        if (ctrl.signal.aborted) {")
patch("components/rah/CoachSidebar.tsx",
      "    [running, executeCommand, refresh, loadWorkspace],",
      "    [running, executeCommand, refresh, loadWorkspace, view],")
patch("components/rah/CoachSidebar.tsx",
      "            <input\n              value={input}\n              onChange={(e) => setInput(e.target.value)}\n              placeholder={running ? \"Agent is working",
      "            <input\n              value={input}\n              onChange={(e) => setInput(e.target.value)}\n              aria-label=\"Message the agent\"\n              placeholder={running ? \"Agent is working")

# ---------------------------------------------------------------------- Login
patch("components/rah/Login.tsx",
      "  const [email, setEmail] = useState(\"\");",
      "  const [email, setEmail] = useState(() => recalledEmail());")
patch("components/rah/Login.tsx",
      "  const [accessEmail, setAccessEmail] = useState(\"\");",
      "  const [accessEmail, setAccessEmail] = useState(() => recalledEmail());")
patch("components/rah/Login.tsx",
      "  useEffect(() => {\n    // Keep-me-signed-in UX: recall the email used last time so the owner only\n    // types the access code (no email retyping on every sign-in).\n    const last = recalledEmail();\n    if (last) {\n      setEmail(last);\n      setAccessEmail(last);\n    }\n    fetch(\"/api/auth/session\"",
      "  useEffect(() => {\n    fetch(\"/api/auth/session\"")
patch("components/rah/Login.tsx",
      "  const [email, setEmail] = useState(() => recalledEmail());",
      "  // Keep-me-signed-in UX: the email used last time is seeded straight into\n  // state (lazy initializers), so the owner only types the access code - no\n  // setState inside the mount effect (cascading renders).\n  const [email, setEmail] = useState(() => recalledEmail());")
patch("components/rah/Login.tsx",
      "                  id=\"login-email\"\n                  type=\"email\"",
      "                  id=\"login-email\"\n                  aria-label=\"Email\"\n                  type=\"email\"")
patch("components/rah/Login.tsx",
      "                <input\n                  inputMode=\"numeric\"",
      "                <input\n                  aria-label=\"Login code\"\n                  inputMode=\"numeric\"")
patch("components/rah/Login.tsx",
      "                  id=\"access-email\"\n                  type=\"email\"",
      "                  id=\"access-email\"\n                  aria-label=\"Owner email\"\n                  type=\"email\"")
patch("components/rah/Login.tsx",
      "                  id=\"access-code\"\n                  type=\"text\"",
      "                  id=\"access-code\"\n                  aria-label=\"Access code\"\n                  type=\"text\"")

# ------------------------------------------------------------------ GuidePanel
patch("components/rah/GuidePanel.tsx",
      "  const stale = staleTopics(drills as LedgerDrillMap, Date.now()).filter((s) => s.level === level);",
      "  // Page-load clock: staleness is measured against the moment the panel\n  // mounted (react purity - no Date.now() during render).\n  const [now] = useState(() => Date.now());\n  const stale = staleTopics(drills as LedgerDrillMap, now).filter((s) => s.level === level);")
patch("components/rah/GuidePanel.tsx",
      "          <input\n            value={query}",
      "          <input\n            value={query}\n            aria-label=\"Search guide topics\"")

# ------------------------------------------------------------ next/aisettings
patch("components/rah/next/aisettings.tsx",
      "          id=\"ai-base-url\"\n          value={baseUrl}",
      "          id=\"ai-base-url\"\n          aria-label=\"Base URL\"\n          value={baseUrl}")
patch("components/rah/next/aisettings.tsx",
      "          id=\"ai-api-key\"\n          value={apiKey}",
      "          id=\"ai-api-key\"\n          aria-label=\"API key\"\n          value={apiKey}")
patch("components/rah/next/aisettings.tsx",
      "        <datalist id=\"model-list\">\n          {models.map((m) => <option key={m} value={m} />)}\n        </datalist>",
      "        <datalist id=\"model-list\" aria-label=\"Model suggestions\">\n          {models.map((m) => <option key={m} value={m}>{m}</option>)}\n        </datalist>")

# ------------------------------------------------------------ next/checkpoint
patch("components/rah/next/checkpoint.tsx",
      "              <input\n                value={speaking[k]}",
      "              <input\n                value={speaking[k]}\n                aria-label={label}")
patch("components/rah/next/checkpoint.tsx",
      "          <textarea\n            value={writing}",
      "          <textarea\n            value={writing}\n            aria-label=\"Writing sample\"")

# -------------------------------------------------------- next/coach/Blocks.tsx
patch("components/rah/next/coach/Blocks.tsx",
      "        <textarea\n          dir=\"ltr\"\n          value={answers[q.id] ?? \"\"}\n          onChange={(e) => setAnswer(e.target.value)}\n          rows={6}",
      "        <textarea\n          dir=\"ltr\"\n          value={answers[q.id] ?? \"\"}\n          onChange={(e) => setAnswer(e.target.value)}\n          rows={6}\n          aria-label=\"Written answer\"")
patch("components/rah/next/coach/Blocks.tsx",
      "          <input\n            dir=\"ltr\"\n            value={answers[q.id] ?? \"\"}",
      "          <input\n            dir=\"ltr\"\n            value={answers[q.id] ?? \"\"}\n            aria-label=\"Your answer\"")
patch("components/rah/next/coach/Blocks.tsx",
      "        <input\n          dir=\"ltr\"\n          value={given}",
      "        <input\n          dir=\"ltr\"\n          value={given}\n          aria-label=\"Your answer\"")

# ------------------------------------------------------------ next/grammar
patch("components/rah/next/grammar.tsx",
      "  const load = () => {\n    fetch(\"/api/bootstrap\")\n      .then((r) => r.json())\n      .then(() => {\n        // bootstrap carries only a count; fetch full list from track? keep client list\n      })\n      .catch(() => undefined);\n  };\n\n",
      "")
patch("components/rah/next/grammar.tsx",
      "                  <input\n                    value={inputs[i] ?? \"\"}",
      "                  <input\n                    value={inputs[i] ?? \"\"}\n                    aria-label={r.q}")
patch("components/rah/next/grammar.tsx",
      "                <input\n                  type=\"checkbox\"\n                  checked={prodDone[i] ?? false}",
      "                <input\n                  type=\"checkbox\"\n                  aria-label=\"Practiced out loud\"\n                  checked={prodDone[i] ?? false}")

# ------------------------------------------------------------ next/listening
patch("components/rah/next/listening.tsx",
      "import { useRef, useState } from \"react\";",
      "import { useEffect, useRef, useState } from \"react\";")
patch("components/rah/next/listening.tsx",
      "  const startRef = useRef(Date.now());",
      "  // Clock anchor stamped post-render (react purity: no Date.now() during\n  // render); the mount effect runs before any handler can read it.\n  const startRef = useRef(0);\n  useEffect(() => {\n    if (startRef.current === 0) startRef.current = Date.now();\n  }, []);")
patch("components/rah/next/listening.tsx",
      "          <textarea\n            value={caught}",
      "          <textarea\n            value={caught}\n            aria-label=\"What you caught\"")
patch("components/rah/next/listening.tsx",
      "          <textarea\n            value={detail}",
      "          <textarea\n            value={detail}\n            aria-label=\"What you would say\"")
patch("components/rah/next/listening.tsx",
      "          <textarea\n            value={repro}",
      "          <textarea\n            value={repro}\n            aria-label=\"Reproduce from memory\"")

# ------------------------------------------------------------ next/placement
patch("components/rah/next/placement.tsx",
      "export default function PlacementView({ boot, onDone, go }: { boot: Boot; onDone: () => void; go: (v: string) => void }) {",
      "export default function PlacementView({ onDone, go }: { boot: Boot; onDone: () => void; go: (v: string) => void }) {")
patch("components/rah/next/placement.tsx",
      "          <textarea\n            value={writing}",
      "          <textarea\n            value={writing}\n            aria-label=\"Writing sample\"")

# ------------------------------------------------------------ next/reading
patch("components/rah/next/reading.tsx",
      "export default function ReadingView({ boot, onDone }: { boot: Boot; onDone: () => void }) {",
      "export default function ReadingView({ onDone }: { boot: Boot; onDone: () => void }) {")
patch("components/rah/next/reading.tsx",
      "  const [reading, setReading] = useState(0);\n",
      "")
patch("components/rah/next/reading.tsx",
      "setMode(\"extensive\"); setReading(0); setGloss({});",
      "setMode(\"extensive\"); setGloss({});")
patch("components/rah/next/reading.tsx",
      "          <textarea\n            value={importText}",
      "          <textarea\n            value={importText}\n            aria-label=\"Text to import\"")
patch("components/rah/next/reading.tsx",
      "            <textarea\n              value={recon}",
      "            <textarea\n              value={recon}\n              aria-label=\"Your reconstruction\"")

# ------------------------------------------------------------ next/review
patch("components/rah/next/review.tsx",
      "            <input\n              ref={inputRef as React.RefObject<HTMLInputElement>}\n              value={input}",
      "            <input\n              ref={inputRef as React.RefObject<HTMLInputElement>}\n              value={input}\n              aria-label=\"Your answer\"")
patch("components/rah/next/review.tsx",
      "            <textarea\n              ref={inputRef as React.RefObject<HTMLTextAreaElement>}\n              value={input}",
      "            <textarea\n              ref={inputRef as React.RefObject<HTMLTextAreaElement>}\n              value={input}\n              aria-label=\"Rebuild the sentence\"")

# ------------------------------------------------------------ next/shadowing
patch("components/rah/next/shadowing.tsx",
      "  const report = res?.report;\n  const mintedSet = new Set(res?.minted ?? []);\n",
      "  const report = res?.report;\n")

# ------------------------------------------------------------ next/sound
patch("components/rah/next/sound.tsx",
      "if (m === \"pairs\") setQueue(seededShuffle(MINIMAL_PAIRS.map((p) => p.id), Date.now() >>> 0).slice(0, 10));",
      "if (m === \"pairs\") setQueue(seededShuffle(MINIMAL_PAIRS.map((p) => p.id), ++soundSeed).slice(0, 10));")
patch("components/rah/next/sound.tsx",
      "if (m === \"stress\") setQueue(seededShuffle(STRESS_ITEMS.map((p) => p.id), Date.now() >>> 0).slice(0, 8));",
      "if (m === \"stress\") setQueue(seededShuffle(STRESS_ITEMS.map((p) => p.id), ++soundSeed).slice(0, 8));")
patch("components/rah/next/sound.tsx",
      "type Mode = \"pairs\" | \"stress\" | \"reduce\";",
      "// Monotonic seed: every re-seed gets a fresh shuffle order without an\n// impure Date.now()/Math.random() call inside a component function body.\nlet soundSeed = 0;\n\ntype Mode = \"pairs\" | \"stress\" | \"reduce\";")

# ------------------------------------------------------------ next/speaking
patch("components/rah/next/speaking.tsx",
      "  }, [phase, audioB64]);",
      "  }, [phase, audioB64, runCoach]);")
patch("components/rah/next/speaking.tsx",
      "              <audio ref={audioRef} controls src={audioUrl}",
      "              <audio ref={audioRef} controls src={audioUrl}\n                     aria-label=\"Your recording\"")
patch("components/rah/next/speaking.tsx",
      "              <textarea\n                value={transcript}",
      "              <textarea\n                value={transcript}\n                aria-label=\"What you said\"")
patch("components/rah/next/speaking.tsx",
      "              <input\n                value={ev[k]}",
      "              <input\n                value={ev[k]}\n                aria-label={label}")

# ------------------------------------------------------------ next/tutor
patch("components/rah/next/tutor.tsx",
      "          <textarea\n            value={input}\n            onChange={(e) => setInput(e.target.value)}\n            onKeyDown={(e) => {",
      "          <textarea\n            value={input}\n            onChange={(e) => setInput(e.target.value)}\n            aria-label=\"Message the tutor\"\n            onKeyDown={(e) => {")

# ------------------------------------------------------------ next/writing
patch("components/rah/next/writing.tsx",
      "export default function WritingView({ boot, onDone }: { boot: Boot; onDone: () => void }) {",
      "export default function WritingView({ onDone }: { boot: Boot; onDone: () => void }) {")
patch("components/rah/next/writing.tsx",
      "  const [showModel, setShowModel] = useState(false);\n",
      "")
patch("components/rah/next/writing.tsx",
      "                setShowModel(false);\n",
      "")
patch("components/rah/next/writing.tsx",
      "          <textarea\n            value={text}",
      "          <textarea\n            value={text}\n            aria-label=\"Your writing\"")
patch("components/rah/next/writing.tsx",
      "                <input\n                  type=\"checkbox\"\n                  checked={selfCheck[k] ?? false}",
      "                <input\n                  type=\"checkbox\"\n                  aria-label={label}\n                  checked={selfCheck[k] ?? false}")
patch("components/rah/next/writing.tsx",
      "          <textarea\n            value={repaired}",
      "          <textarea\n            value={repaired}\n            aria-label=\"The error I keep making\"")
patch("components/rah/next/writing.tsx",
      "            <input\n              key={i}\n              value={v}",
      "            <input\n              key={i}\n              value={v}\n              aria-label={`Reuse sentence ${i + 1}`}")

print("batch 4 complete")
