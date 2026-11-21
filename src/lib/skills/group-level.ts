// Level skills: the per-skill assessment and the deep multi-pass analysis.

import type { Skill } from "./run-types";
import { assessBands } from "./level-bands";

export const LEVEL_SKILLS: Skill[] = [
  {
    id: "level.deep",
    name: "Deep level analysis",
    blurb: "Multi-pass analysis of your real work; takes about half a minute.",
    keywords: ["deep analysis", "analyze my level", "deep analyse", "what is my level"],
    async run(_args, ctx) {
      const { bands, verdict } = await assessBands(true, ctx.profile);
      return {
        label: "Ran a deep multi-pass level analysis",
        summary: `Deep analysis finished. Verdict for the reply: "${verdict}". Per-skill bands are attached and render as cards. Give the headline levels (overall plus the strongest and weakest skill) and one concrete next step.`,
        payload: { type: "bands", title: "Deep level analysis", bands, deep: true },
      };
    },
  },
  {
    id: "level.assess",
    name: "Skill assessment",
    blurb: "Per-skill CEFR bands: grammar, vocabulary, writing, speaking, reading, listening, plus overall.",
    keywords: ["assess", "my levels", "per skill", "which level"],
    async run(_args, ctx) {
      const { bands, verdict } = await assessBands(false, ctx.profile);
      return {
        label: "Assessed every skill separately",
        summary: `Assessment finished. Verdict: "${verdict}". Per-skill bands are attached. Mention that each skill is banded separately and give the overall.`,
        payload: { type: "bands", title: "Per-skill assessment", bands, deep: false },
      };
    },
  },
];
