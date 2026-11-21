// App-control plugins: theme repaint, view navigation, focus targeting and
// the settings dials (daily goal, new-card pace). No AI involved: these are
// deterministic commands over the learner row.

import { db } from "@/lib/db";
import type { SkillDef, StepTrace } from "../types";
import { parseThemeRequest, presetById, PRESETS } from "../theme";
import { VIEW_WORDS } from "./data";

export const APP_CONTROL_SKILLS: SkillDef[] = [
  {
    id: "theme-control",
    name: "Theme plugin",
    oneLiner: "Repaint the app on command",
    commands: ["theme", "color", "color-scheme"],
    triggers: [/\btheme\b/i, /colou?r (scheme|of the app|palette)/i, /change (the )?colou?rs?/i, /(make|turn) (it|the app) (blue|green|dark|purple|orange|pink|red|violet)/i, /dark mode/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const req = parseThemeRequest(ctx.args || ctx.text);
      if (req.preset || req.tokens) {
        const preset = req.preset ? presetById(req.preset) : undefined;
        const tokens = req.tokens ?? preset!.tokens;
        steps.push({ label: "Applying theme plugin", detail: preset ? preset.name : "custom tokens" });
        await db.learner.update({ where: { id: "me" }, data: { theme: JSON.stringify(tokens) } });
        return {
          skill: "theme-control",
          reply: preset
            ? `Repainted: ${preset.name}. The whole app shifts now, and it stays after reload. Say "theme midnight" to go back.`
            : "Custom tokens applied. Every surface and accent you gave me is live, and it stays after reload.",
          corrections: [],
          fa_note: "",
          steps,
          actions: [{ type: "theme", tokens, preset: req.preset }],
        };
      }
      steps.push({ label: "Theme plugin", detail: "listing presets" });
      return {
        skill: "theme-control",
        reply: `I can repaint the whole app. Presets: ${PRESETS.map((p) => p.id).join(", ")}. Or hand me hex codes. Try: /theme ocean`,
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "navigate",
    name: "Navigation plugin",
    oneLiner: "Opens any view for you",
    commands: ["go", "open"],
    triggers: [/^(take|send) me to/i, /^(open|go to|show) (the )?(home|review|coach|chat|writ(e|ing)|speak(ing)?|listen(ing)?|read(ing)?|placement|progress)\b/i, /navigate to/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      for (const [view, re] of Object.entries(VIEW_WORDS)) {
        if (re.test(ctx.text)) {
          steps.push({ label: "Navigation plugin", detail: `opening ${view}` });
          return {
            skill: "navigate",
            reply: view === "review"
              ? `Opening Review. ${ctx.profile.due} cards are waiting.`
              : `Opening ${view}.`,
            corrections: [],
            fa_note: "",
            steps,
            actions: [{ type: "navigate", view }],
          };
        }
      }
      return {
        skill: "navigate",
        reply: "Which view? home, review, write, speak, listen, read, placement, progress. Name it and I will take you there.",
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "focus-skill",
    name: "Focus plugin",
    oneLiner: "Points the whole app at one skill",
    commands: ["focus"],
    triggers: [/^focus on/i, /set (my )?focus/i, /(work on|practice) (my )?(collocation|grammar|vocabular\w*|writing|speaking|listening|reading|pronunciation)/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const m = ctx.text.match(/(collocation|grammar|vocabular\w*|writing|speaking|listening|reading|pronunciation)/i);
      if (!m) {
        return {
          skill: "focus-skill",
          reply: "Focus can be: collocation, grammar, vocabulary, writing, speaking, listening, reading, pronunciation. Name one.",
          corrections: [],
          fa_note: "",
          steps,
        };
      }
      const skill = m[1].toLowerCase().replace(/vocabular.*/, "vocabulary");
      steps.push({ label: "Focus plugin", detail: `aiming everything at ${skill}` });
      await db.learner.update({ where: { id: "me" }, data: { focusSkill: skill } });
      return {
        skill: "focus-skill",
        reply: `Done. Everything now aims at ${skill}: reviews surface it, my drills pull toward it, exams weight it. Say "focus off" anytime.`,
        corrections: [],
        fa_note: "",
        steps,
        actions: [{ type: "focus", skill }],
      };
    },
  },
  {
    id: "settings",
    name: "Settings plugin",
    oneLiner: "Daily goal and new-card pace",
    commands: ["set"],
    triggers: [/set (my )?(daily )?goal/i, /(\d+) (new )?cards (a|per) day/i, /change (my )?daily goal/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const goal = ctx.text.match(/goal (to |of )?(\d{1,3})/i);
      const cards = ctx.text.match(/(\d{1,2}) (new )?cards (a|per) day/i);
      if (goal) {
        const v = Math.max(5, Math.min(200, parseInt(goal[2], 10)));
        await db.learner.update({ where: { id: "me" }, data: { dailyGoal: v } });
        steps.push({ label: "Settings plugin", detail: `daily goal ${v}` });
        return { skill: "settings", reply: `Daily goal: ${v}. The ring on Home now counts to it.`, corrections: [], fa_note: "", steps };
      }
      if (cards) {
        const v = Math.max(3, Math.min(50, parseInt(cards[1], 10)));
        await db.learner.update({ where: { id: "me" }, data: { newPerDay: v } });
        steps.push({ label: "Settings plugin", detail: `${v} new cards per day` });
        return { skill: "settings", reply: `${v} new cards per day. The queue refills at that pace from now on.`, corrections: [], fa_note: "", steps };
      }
      return { skill: "settings", reply: "I can set your daily goal ('set goal 40') or the new-card pace ('15 cards a day').", corrections: [], fa_note: "", steps };
    },
  },
];
