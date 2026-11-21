"""Cycle 5 bulk fix, batch 2: lib + hooks.

Same discipline as batch 1: every replacement asserts its source string occurs
exactly once before writing.
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
    assert n == count, f"{rel}: expected {count}, found {n}: {old[:60]!r}"
    p.write_text(s.replace(old, new))
    print(f"ok  {rel}: {old.splitlines()[0].strip()[:52]!r}")

def lib(rel):
    return f"lib/{rel}"

# --- use-toast: value-only-used-as-type becomes a type ----------------------
patch("hooks/use-toast.ts",
      "const actionTypes = {\n  ADD_TOAST: \"ADD_TOAST\",\n  UPDATE_TOAST: \"UPDATE_TOAST\",\n  DISMISS_TOAST: \"DISMISS_TOAST\",\n  REMOVE_TOAST: \"REMOVE_TOAST\",\n} as const\n",
      "")
patch("hooks/use-toast.ts",
      "type ActionType = typeof actionTypes\n",
      "type ActionType = {\n  ADD_TOAST: \"ADD_TOAST\"\n  UPDATE_TOAST: \"UPDATE_TOAST\"\n  DISMISS_TOAST: \"DISMISS_TOAST\"\n  REMOVE_TOAST: \"REMOVE_TOAST\"\n}\n")

# --- exam-gate: vestigial alias ---------------------------------------------
patch(lib("agent/exam-gate.ts"),
      "  const key = out; // order-preserving dedupe below\n",
      "")

# --- mode-flow: unused import + unused positional param ----------------------
patch(lib("agent/mode-flow.ts"),
      "import { aiJson, profileBlock } from \"@/lib/ai\";",
      "import { aiJson } from \"@/lib/ai\";")
patch(lib("agent/mode-flow.ts"),
      "async function dailyTurn(\n  text: string,\n  data: ModeData,\n  p: ProfileJson,",
      "async function dailyTurn(\n  text: string,\n  data: ModeData,\n  _p: ProfileJson,")

# --- skills-power: unused type import, ctx params, dead Promise.all slot ----
patch(lib("agent/skills-power.ts"),
      "import type { SkillDef, SkillContext, StepTrace } from \"./types\";",
      "import type { SkillDef, StepTrace } from \"./types\";")
patch(lib("agent/skills-power.ts"),
      "    commands: [\"end\", \"exit\", \"stop\"],\n    triggers: [],\n    run: async (ctx) => {",
      "    commands: [\"end\", \"exit\", \"stop\"],\n    triggers: [],\n    run: async (_ctx) => {")
patch(lib("agent/skills-power.ts"),
      "    triggers: [/\\b(recurring )?mistakes?\\b/i, /what do i keep (getting )?wrong/i, /\\bmy (weak|leak\\w*) (points|spots|families)\\b/i, /\\berror (families|patterns)\\b/i],\n    run: async (ctx) => {",
      "    triggers: [/\\b(recurring )?mistakes?\\b/i, /what do i keep (getting )?wrong/i, /\\bmy (weak|leak\\w*) (points|spots|families)\\b/i, /\\berror (families|patterns)\\b/i],\n    run: async (_ctx) => {")
patch(lib("agent/skills-power.ts"),
      "      const [reviewCount, lapseRows, writes, speaks, corrections, quizItems, levels] = await Promise.all([\n        db.reviewLog.count({ where: { userId: evidenceUser } }),\n        db.reviewLog.findMany({ where: { userId: evidenceUser, grade: 1 }, orderBy: { id: \"desc\" }, take: 20 }),\n        db.writingSub.findMany({ where: { userId: evidenceUser }, orderBy: { id: \"desc\" }, take: 3 }),\n        db.speakSession.findMany({ where: { userId: evidenceUser }, orderBy: { id: \"desc\" }, take: 3 }),\n        db.chatMsg.findMany({ where: { userId: evidenceUser, role: \"coach\" }, orderBy: { id: \"desc\" }, take: 25 }),\n        db.quizItem.count(),\n        getSkillLevels(),",
      "      const [reviewCount, lapseRows, writes, speaks, corrections, levels] = await Promise.all([\n        db.reviewLog.count({ where: { userId: evidenceUser } }),\n        db.reviewLog.findMany({ where: { userId: evidenceUser, grade: 1 }, orderBy: { id: \"desc\" }, take: 20 }),\n        db.writingSub.findMany({ where: { userId: evidenceUser }, orderBy: { id: \"desc\" }, take: 3 }),\n        db.speakSession.findMany({ where: { userId: evidenceUser }, orderBy: { id: \"desc\" }, take: 3 }),\n        db.chatMsg.findMany({ where: { userId: evidenceUser, role: \"coach\" }, orderBy: { id: \"desc\" }, take: 25 }),\n        getSkillLevels(),")
patch(lib("agent/skills-power.ts"),
      "    triggers: [/(skill|progress) report/i, /\\bbands?\\b/i, /my (strong|weak) (skill|spot)/i, /skill levels/i],\n    run: async (ctx) => {",
      "    triggers: [/(skill|progress) report/i, /\\bbands?\\b/i, /my (strong|weak) (skill|spot)/i, /skill levels/i],\n    run: async (_ctx) => {")
patch(lib("agent/skills-power.ts"),
      "    run: async (ctx) => {\n      const steps: StepTrace[] = [];\n      steps.push({ label: \"Loading graded exams\", detail: \"newest first\" });",
      "    run: async (_ctx) => {\n      const steps: StepTrace[] = [];\n      steps.push({ label: \"Loading graded exams\", detail: \"newest first\" });")

# --- skills-util: dead function + unused param -------------------------------
patch(lib("agent/skills-util.ts"),
      "function extractTurn(raw: string): TurnResult {\n  const cleaned = cleanEmDash(raw.trim());\n  const fence = cleaned.match(/```(?:json)?\\s*([\\s\\S]*?)```/);\n  const body = fence ? fence[1] : cleaned;\n  const start = body.indexOf(\"{\");\n  const end = body.lastIndexOf(\"}\");\n  if (start === -1) throw new Error(\"no json\");\n  const candidate = end > start ? body.slice(start, end + 1) : body.slice(start);\n  try {\n    return JSON.parse(candidate) as TurnResult;\n  } catch {\n    return JSON.parse(repairJson(candidate)) as TurnResult;\n  }\n}\n\n",
      "")
patch(lib("agent/skills-util.ts"),
      "  system: string,\n  ctx: SkillContext,\n  steps: StepTrace[],",
      "  system: string,\n  ctx: SkillContext,\n  _steps: StepTrace[],")

# --- arcade-items: dead fill helper ------------------------------------------
patch(lib("arcade-items.ts"),
      "  const fill = (n: number, pool: Card[], start: number): Card[] => {\n    const out: Card[] = [];\n    for (const c of pool) {\n      if (out.length >= n) break;\n      if (!out.includes(c) && !hotPool.slice(0, start).includes(c)) out.push(c);\n    }\n    for (const c of rest) {\n      if (out.length >= n) break;\n      if (!out.includes(c)) out.push(c);\n    }\n    return out;\n  };\n",
      "")

# --- azure-speech: unused response interfaces --------------------------------
patch(lib("azure-speech.ts"),
      "interface AzureResponse {\n  DisplayText?: string;\n  NBest?: AzureBest[];\n}\n\n",
      "")

# --- exam-tracks: unused positional param ------------------------------------
patch(lib("exam-tracks.ts"),
      "export function trackCount(track: ExamTrack, requested: number): number {",
      "export function trackCount(_track: ExamTrack, requested: number): number {")

# --- phonemes: dead backtrack candidate ---------------------------------------
patch(lib("phonemes.ts"),
      "    const up = dp[i - 1][j] - 1;\n    const left = dp[i][j - 1] - 1;\n",
      "    const up = dp[i - 1][j] - 1;\n")

# --- portable: unused type import ---------------------------------------------
patch(lib("portable.ts"),
      "import { db } from \"@/lib/db\";\nimport type { PrismaClient } from \"@prisma/client\";\n",
      "import { db } from \"@/lib/db\";\n")

# --- skills/exam: dead string --------------------------------------------------
patch(lib("skills/exam.ts"),
      "  const weak = ctx.profile.weakSkills.join(\", \") || \"none recorded\";\n",
      "")

# --- skills/prompts: unused positional param -----------------------------------
patch(lib("skills/prompts.ts"),
      "export function assessSynthesisSystem(p: ProfileJson, previous: string, parts: string): string {",
      "export function assessSynthesisSystem(_p: ProfileJson, previous: string, parts: string): string {")

# --- tutor-intents: unused import ----------------------------------------------
patch(lib("tutor-intents.ts"),
      "import { PRESETS, presetById, sanitizeTokens } from \"@/lib/agent/theme\";",
      "import { presetById, sanitizeTokens } from \"@/lib/agent/theme\";")

# --- coach-agent/tools: five empty catches get documented ----------------------
patch(lib("coach-agent/tools.ts"),
      "            parts.push(`${s.level}: ${r.easy}/${r.total} easy, ${r.mid} some difficulty, ${r.hard} difficult - ${r.verdict}`);\n          }\n        } catch {}\n      }",
      "            parts.push(`${s.level}: ${r.easy}/${r.total} easy, ${r.mid} some difficulty, ${r.hard} difficult - ${r.verdict}`);\n          }\n        } catch {\n          // malformed checklist row - skip that level, the rest still report\n        }\n      }")
patch(lib("coach-agent/tools.ts"),
      "      if (parts.length > 0) guideSelfRatings = parts.join(\"; \");\n    }\n  } catch {}",
      "      if (parts.length > 0) guideSelfRatings = parts.join(\"; \");\n    }\n  } catch {\n    // guide state unavailable - the briefing just omits the self-ratings line\n  }")
patch(lib("coach-agent/tools.ts"),
      "      guideDrills = guideStateLine(JSON.parse(drillRow.value));\n    }\n  } catch {}",
      "      guideDrills = guideStateLine(JSON.parse(drillRow.value));\n    }\n  } catch {\n    // practice ledger unavailable or malformed - omit the drill-request line\n  }")
patch(lib("coach-agent/tools.ts"),
      "      ratings[lv] = JSON.parse(row.value);\n    } catch {}\n  }",
      "      ratings[lv] = JSON.parse(row.value);\n    } catch {\n      // malformed checklist row - that level contributes no ratings\n    }\n  }")
patch(lib("coach-agent/tools.ts"),
      "      rawDrills = JSON.parse(drillRow.value);\n    } catch {}\n  }",
      "      rawDrills = JSON.parse(drillRow.value);\n    } catch {\n      // malformed practice ledger - weekly progress line is omitted\n    }\n  }")

print("batch 2 complete")
