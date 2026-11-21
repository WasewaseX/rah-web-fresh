"""Cycle 5 bulk fix, batch 1: api routes.

Each replacement asserts its exact source string occurs once, so a drifted
codebase fails loudly instead of silently mis-editing.
"""
import pathlib

ROOT = pathlib.Path("/home/z/my-project/src")

def patch(rel, old, new, count=1):
    p = ROOT / rel
    s = p.read_text()
    n = s.count(old)
    assert n == count, f"{rel}: expected {count} occurrence(s), found {n}: {old[:60]!r}"
    p.write_text(s.replace(old, new))
    print(f"ok  {rel}: {old.splitlines()[0].strip()[:52]!r}")

# --- unused imports -------------------------------------------------------
patch("app/api/ai/route.ts",
      "import { chat, smartChat, effectiveProfile, extractJson, listModels, presets, isBuiltin, BUILTIN_PROFILE } from \"@/lib/ai\";",
      "import { chat, smartChat, effectiveProfile, extractJson, listModels, isBuiltin, BUILTIN_PROFILE } from \"@/lib/ai\";")

patch("app/api/arcade/dungeon/route.ts",
      "import { awardGameXp, bumpStat, progressQuest, registerMiss, hasPerk, learnerPerks } from \"@/lib/arcade\";",
      "import { awardGameXp, bumpStat, progressQuest, registerMiss, hasPerk } from \"@/lib/arcade\";")

patch("app/api/bootstrap/route.ts",
      "import { DECK, CARD_BY_ID } from \"@/lib/content\";",
      "import { DECK } from \"@/lib/content\";")

patch("app/api/quiz/route.ts",
      "import { buildProfile, bumpDaily } from \"@/lib/server\";",
      "import { buildProfile } from \"@/lib/server\";")

# --- dead locals ----------------------------------------------------------
patch("app/api/ai/route.ts",
      "    if (out.ok) {\n      const s = await getSettings();\n      await db.aiSettings.update({",
      "    if (out.ok) {\n      await db.aiSettings.update({")

patch("app/api/arcade/duel/route.ts",
      "  const l = await getLearner();\n  const recent = await db.dailyStat.findMany(",
      "  const recent = await db.dailyStat.findMany(")

patch("app/api/arcade/pairs/route.ts",
      "  const ms = Math.min(600_000, Math.max(1_000, Math.round(Number(b.ms ?? 60_000))));\n",
      "")

patch("app/api/arcade/speed/route.ts",
      "  const ms = Math.min(300_000, Math.max(1_000, Math.round(Number(b.ms ?? 60_000))));\n",
      "")

patch("app/api/flow/route.ts",
      "  const ms = Math.min(3_600_000, Math.max(30_000, Math.round(Number(b.ms ?? 900_000))));\n",
      "")

patch("app/api/coach/briefing/route.ts",
      "  const b = (await req.json()) as { persona?: string; regen?: boolean };\n  const l = await getLearner();\n",
      "  const b = (await req.json()) as { persona?: string; regen?: boolean };\n")

patch("app/api/placement/route.ts",
      "export async function GET() {\n  const l = await getLearner();\n  const row = await readRow();",
      "export async function GET() {\n  const row = await readRow();")

patch("app/api/review/queue/route.ts",
      "  const byId = new Map(all.map((s) => [s.cardId, s]));\n  const l = await getLearner();\n",
      "  const byId = new Map(all.map((s) => [s.cardId, s]));\n")

# --- empty catches get documented ------------------------------------------
patch("app/api/guide-checklist/route.ts",
      "        }\n      } catch {}\n    }",
      "        }\n      } catch {\n        // stored checklist was not valid JSON - fall through to fresh ratings\n      }\n    }")

patch("app/api/guide-practice/route.ts",
      "  if (row) {\n    try {\n      drills = parseDrillMap(JSON.parse(row.value));\n    } catch {}\n  }\n  // Task 141",
      "  if (row) {\n    try {\n      drills = parseDrillMap(JSON.parse(row.value));\n    } catch {\n      // stored drills were not valid JSON - start from an empty map\n    }\n  }\n  // Task 141")

patch("app/api/guide-practice/route.ts",
      "  if (row) {\n    try {\n      drills = parseDrillMap(JSON.parse(row.value));\n    } catch {}\n  }\n  const prev = drills[topicId]?.count ?? 0;",
      "  if (row) {\n    try {\n      drills = parseDrillMap(JSON.parse(row.value));\n    } catch {\n      // stored drills were not valid JSON - treat as no history for this topic\n    }\n  }\n  const prev = drills[topicId]?.count ?? 0;")

print("batch 1 complete")
