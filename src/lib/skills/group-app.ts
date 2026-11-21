// App-control skills: schedule tuning, the theme plugins, the WebGL backdrop
// switch and the coach memory store.

import { db } from "@/lib/db";
import type { Skill } from "./run-types";
import { parseThemeArg, THEME_PRESETS } from "./appearance-presets";
import { getSetting, setSetting } from "./settings-store";

export const APP_SKILLS: Skill[] = [
  {
    id: "review.tune",
    name: "Schedule tuning",
    blurb: "Adjust daily new cards, daily goal, or target retention.",
    keywords: ["schedule", "new cards per day", "retention", "daily goal"],
    argHint: "e.g. 15 new per day, or retention 0.92",
    async run(args) {
      const a = args.toLowerCase();
      const l = await db.learner.findUnique({ where: { id: "me" } });
      if (!l) throw new Error("Learner row missing.");
      const data: Record<string, number> = {};
      const nNew = a.match(/(\d+)\s*(new|cards)/);
      if (nNew) data.newPerDay = Math.max(3, Math.min(50, parseInt(nNew[1], 10)));
      const nGoal = a.match(/goal\s*(\d+)|(\d+)\s*(minutes|min\b)/);
      if (nGoal) data.dailyGoal = Math.max(5, Math.min(180, parseInt(nGoal[1] || nGoal[2], 10)));
      const nRet = a.match(/retention\s*([\d.]+)/);
      if (nRet) data.retention = Math.max(0.7, Math.min(0.97, parseFloat(nRet[1])));
      if (Object.keys(data).length === 0) {
        return {
          label: "Explained schedule tuning",
          summary: "The request did not parse. Tell the learner the accepted forms: a number plus new, goal N, retention 0.9.",
          payload: { type: "card", title: "Schedule tuning", body: "Try: '15 new per day', 'daily goal 30', or 'retention 0.92'." },
        };
      }
      await db.learner.update({ where: { id: "me" }, data });
      return {
        label: "Retuned the review schedule",
        summary: `Schedule updated: ${JSON.stringify(data)}. Confirm in one sentence what changed and why it helps.`,
      };
    },
  },
  {
    id: "theme.set",
    name: "Theme plugin",
    blurb: "Recolor the whole app live: presets or any hex color.",
    keywords: ["change color", "theme", "dark blue", "make it", "recolor"],
    argHint: "emerald | sunset | violet | ocean | rose | gold | midnight | #hex",
    async run(args) {
      const patch = parseThemeArg(args);
      if (!patch) {
        return {
          label: "Listed theme options",
          summary: "Theme argument did not parse. Offer the presets and the hex form.",
          payload: { type: "card", title: "Theme plugin", body: `Presets: ${Object.keys(THEME_PRESETS).join(", ")}. Or any hex like #7c5cff.` },
        };
      }
      await setSetting("theme", JSON.stringify(patch));
      return {
        label: `Recolored the app (${patch.name})`,
        summary: `Theme "${patch.name}" is applied live to the whole UI. Confirm it in one casual sentence.`,
        payload: { type: "theme", patch },
      };
    },
  },
  {
    id: "theme.reset",
    name: "Theme reset",
    blurb: "Back to the default midnight look.",
    keywords: ["reset theme", "default color", "normal colors"],
    async run() {
      const patch = THEME_PRESETS.midnight;
      await setSetting("theme", JSON.stringify(patch));
      return {
        label: "Reset the theme to midnight",
        summary: "Default theme restored.",
        payload: { type: "theme", patch },
      };
    },
  },
  {
    id: "gui.effect",
    name: "GUI effect plugin",
    blurb: "Switch the WebGL backdrop: aurora, waves, particles, or none.",
    keywords: ["effect", "background", "webgl", "aurora", "waves", "particles"],
    argHint: "aurora | waves | particles | none",
    async run(args) {
      const a = args.trim().toLowerCase();
      const effect = /aurora|northern/.test(a) ? "aurora" : /wave/.test(a) ? "waves" : /particle|star|dot/.test(a) ? "particles" : /none|off|plain/.test(a) ? "none" : "";
      if (!effect) {
        return {
          label: "Listed GUI effects",
          summary: "Effect argument did not parse. Offer: aurora, waves, particles, none.",
          payload: { type: "card", title: "GUI effects", body: "Options: aurora, waves, particles, none. Example: /skill gui.effect waves" },
        };
      }
      await setSetting("effect", effect);
      return {
        label: `Switched the backdrop to ${effect}`,
        summary: `WebGL backdrop set to "${effect}". Confirm in one short sentence.`,
        payload: { type: "effect", effect },
      };
    },
  },
  {
    id: "memory.save",
    name: "Coach memory",
    blurb: "Save a preference or goal the coach should always remember.",
    keywords: ["remember", "keep in mind", "note that"],
    argHint: "the note",
    async run(args) {
      const note = args.trim();
      if (!note) throw new Error("Tell me what to remember.");
      const cur = JSON.parse((await getSetting("memory")) ?? "[]") as string[];
      const next = [...cur, note.slice(0, 200)].slice(-20);
      await setSetting("memory", JSON.stringify(next));
      return {
        label: "Saved to coach memory",
        summary: `Memory saved. Confirm briefly what you will now remember.`,
      };
    },
  },
  {
    id: "memory.show",
    name: "Show memory",
    blurb: "What the coach currently remembers about you.",
    keywords: ["what do you remember", "show memory"],
    async run() {
      const cur = JSON.parse((await getSetting("memory")) ?? "[]") as string[];
      return {
        label: "Recalled coach memory",
        summary: cur.length ? "List the remembered notes briefly." : "Memory is empty; invite the learner to save preferences with /skill memory.save.",
        payload: { type: "card", title: "Coach memory", body: cur.length ? cur.map((n, i) => `${i + 1}. ${n}`).join("\n") : "Nothing saved yet." },
      };
    },
  },
];
