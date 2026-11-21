// Interactive power skills: the repair loops and the live scene modes
// (roleplay, socratic, explain, debate) where the coach stays in character.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { SkillDef, StepTrace } from "../types";
import { generateRepairDrill, type DrillPoint } from "../drill";
import { topMistakes } from "@/lib/mistakes";
import { TAG_TO_SKILL } from "./data";

export const INTERACTIVE_SKILLS: SkillDef[] = [
  {
    id: "remediate",
    name: "Repair loop",
    oneLiner: "Rebuilds your actual exam misses as a fresh drill until they are beaten",
    commands: ["remediate", "repair"],
    triggers: [
      /\b(practice|redo|retry|retest|drill) (my )?(misses|wrong( ones?)?|mistakes?|fails?)\b/i,
      /\brepair (drill|my (misses|mistakes))\b/i,
      /\bhelp me (overcome|beat|fix) (my )?(misses|mistakes?|weak\w*)\b/i,
      /\bwont ever let it happen\b/i,
    ],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Collecting your misses", detail: "last graded exams" });
      const graded = await db.exam.findMany({ where: { status: "graded" }, orderBy: { createdAt: "desc" }, take: 3 });
      const points: DrillPoint[] = [];
      for (const row of graded) {
        let items: { id: string; q: string; a: string; why: string; skill: string; tag?: string }[] = [];
        let result: { verdicts?: { itemId: string; given: string; correct: boolean }[] } = {};
        try {
          items = JSON.parse(row.items);
          result = JSON.parse(row.result ?? "{}");
        } catch {
          continue;
        }
        for (const v of result.verdicts ?? []) {
          if (v.correct || !v.given) continue;
          const it = items.find((x) => x.id === v.itemId);
          if (!it) continue;
          points.push({
            point: `${it.why} (question: ${it.q.slice(0, 100)})`,
            wrong: v.given,
            right: it.a,
            tag: it.tag,
            skill: it.skill,
          });
        }
      }
      if (points.length === 0) {
        return {
          skill: "remediate",
          reply: "Clean sheet: your recent exams have no misses to repair. Ask for a fresh exam ('generate an exam') and I will hunt your mistake families inside it instead.",
          corrections: [],
          fa_note: "",
          steps,
        };
      }
      const drill = await generateRepairDrill(ctx.profile, points.slice(0, 6), (l, d) => steps.push({ label: l, detail: d }), "Repair drill: your misses");
      if (!drill) {
        return { skill: "remediate", reply: "I could not build the drill that time - say 'practice my misses' once more.", corrections: [], fa_note: "", steps };
      }
      return {
        skill: "remediate",
        reply: `${points.length} miss(es) found. This drill retests the EXACT same teaching points in fresh sentences - prove the lesson landed and the families behind them move toward retirement. Submit when done.`,
        corrections: [],
        fa_note: "",
        steps,
        exam: drill.client,
      };
    },
  },
  {
    id: "repair-drill",
    name: "Weak-spot drill",
    oneLiner: "Five fresh items on one named weak spot, right now",
    commands: ["drill"],
    triggers: [
      /^\/drill\b/i,
      /\bdrill (my )?(statives?|articles?|prepositions?|countability|copula|perfect|question order|adjectives?|word choice|register|collocations?|spelling|weak\w*|spot|famil\w*|mistake)\b/i,
    ],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const families = await topMistakes(6, true);
      const lower = ctx.text.toLowerCase();
      const named = families.filter((f) => lower.includes(f.tag.replace(/_/g, " ")) || lower.includes(f.tag));
      let points: DrillPoint[];
      if (named.length > 0) {
        points = named.map((f) => ({ point: f.label, wrong: f.evidence.split(" -> ")[0], right: f.evidence.split(" -> ")[1] ?? "", tag: f.tag, skill: TAG_TO_SKILL[f.tag] ?? "grammar" }));
        steps.push({ label: "Aiming at your families", detail: named.map((f) => f.tag).join(", ") });
      } else {
        const topic = ctx.text.replace(/^\/?drill\s*/i, "").replace(/\b(my|a|the|some|spot|weakness|weak)\b/gi, " ").replace(/\s+/g, " ").trim() || "your weakest skill";
        points = [{ point: `Focused practice: ${topic}`, skill: TAG_TO_SKILL[topic.replace(/ /g, "_")] ?? "grammar" }];
        steps.push({ label: "Building the drill", detail: topic });
      }
      const drill = await generateRepairDrill(ctx.profile, points, (l, d) => steps.push({ label: l, detail: d }), "Weak-spot drill");
      if (!drill) {
        return { skill: "repair-drill", reply: "Drill build failed that time - run /drill once more.", corrections: [], fa_note: "", steps };
      }
      return {
        skill: "repair-drill",
        reply: "Fresh drill, same target. Name the weak spot next time ('drill prepositions') or say 'practice my misses' to retest your actual exam errors. Submit when done.",
        corrections: [],
        fa_note: "",
        steps,
        exam: drill.client,
      };
    },
  },
  {
    id: "roleplay",
    name: "Roleplay",
    oneLiner: "Live scenario practice: interviews, airports, doctors - in character",
    commands: ["roleplay", "scene"],
    triggers: [/\brole[- ]?play\b/i, /\bscene\b.{0,40}\b(interview|airport|doctor|restaurant|hotel|shop|meeting|order)\b/i, /simulate (a|an)/i, /practice (talking|speaking) (with|to|in) (a|an|the)/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const t = ctx.text.toLowerCase();
      let scene = "A casual conversation with a new English-speaking colleague";
      let partner = "the colleague";
      let goal = "Keep the conversation natural for five exchanges";
      if (t.includes("interview") || t.includes("job")) {
        scene = "A job interview for a position you really want";
        partner = "the hiring manager";
        goal = "Present yourself, answer the hard questions, and land a second interview";
      } else if (t.includes("airport") || t.includes("flight") || t.includes("check-in")) {
        scene = "An airport check-in counter where your connecting flight is delayed";
        partner = "the check-in agent";
        goal = "Sort out the rebooking and get something for the inconvenience";
      } else if (t.includes("doctor") || t.includes("sick") || t.includes("clinic")) {
        scene = "A doctor's appointment; you have felt unwell for a week";
        partner = "the doctor";
        goal = "Describe symptoms precisely and understand the advice";
      } else if (t.includes("restaurant") || t.includes("order") || t.includes("food")) {
        scene = "A restaurant where the wrong dish just arrived";
        partner = "the waiter";
        goal = "Fix the order politely and order dessert after";
      } else if (t.includes("hotel") || t.includes("room")) {
        scene = "A hotel reception; your room is not what you booked";
        partner = "the receptionist";
        goal = "Get the room fixed or an upgrade, without losing your temper";
      } else if (t.includes("meeting") || t.includes("present") || t.includes("work")) {
        scene = "A work meeting where you must present an idea to skeptical colleagues";
        partner = "a skeptical colleague";
        goal = "Defend the idea with reasons and handle pushback";
      } else if (ctx.text.replace(/\b(roleplay|scene|simulate|a|an|the|practice)\b/gi, " ").trim().length > 8) {
        scene = ctx.text.replace(/^.*\b(roleplay|scene|simulate)\b:?\s*/i, "").trim() || scene;
        partner = "your scene partner";
        goal = "Stay in the scene and communicate naturally";
      }
      steps.push({ label: "Scene set", detail: scene });
      await db.learner.update({ where: { id: "me" }, data: { mode: "roleplay", modeData: JSON.stringify({ scene, partner, goal, startedAt: Date.now() }) } });
      const open = await aiJson<{ reply?: string }>(
        `You are ${partner} in this roleplay for a Farsi speaker around ${ctx.profile.level}: ${scene}. Their goal: ${goal}.
Open the scene IN CHARACTER: 1 to 3 sentences that put the learner on the spot in a natural way and end with something they must respond to. English only, spoken register. No JSON, no Farsi, no em dash.`,
        [{ role: "user", content: "open the scene" }],
        () => ({}),
        { deep: false, temperature: 0.7 },
      );
      const firstLine = String(open.reply ?? "").trim() || "So, let's begin - tell me why you are here.";
      return {
        skill: "roleplay",
        reply: `Scene: ${scene}\nYour goal: ${goal}\n\n${firstLine}\n\n(I stay in character; real errors get corrected on the cards under my replies. Say "end scene" any time to get feedback and return to coach mode.)`,
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "socratic",
    name: "Socratic mode",
    oneLiner: "I refuse to hand you the answer; my questions drag it out of you",
    commands: ["socratic"],
    triggers: [/\bsocratic\b/i, /guide me (to|through)/i, /dont tell me (the )?answer/i, /make me (think|figure it out)/i, /let me discover/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const families = await topMistakes(3, true);
      const goal = ctx.text.replace(/\bsocratic( mode)?\b/gi, " ").replace(/\b(guide me|on|about|for)\b/gi, " ").trim() || families[0]?.label || "their most common grammar slip";
      steps.push({ label: "Socratic mode on", detail: goal });
      await db.learner.update({ where: { id: "me" }, data: { mode: "socratic", modeData: JSON.stringify({ goal, startedAt: Date.now() }) } });
      const open = await aiJson<{ reply?: string }>(
        `You are Rah in SOCRATIC MODE for a Farsi speaker around ${ctx.profile.level}. Target: ${goal}.
Open with ONE short guiding question or minimal pair that makes them produce the target form themselves. Max 30 words. No explanation, no rule, no answer. English only, no em dash.`,
        [{ role: "user", content: "begin" }],
        () => ({}),
        { deep: false, temperature: 0.6 },
      );
      return {
        skill: "socratic",
        reply: `${String(open.reply ?? "").trim() || "Try this sentence for me: 'Yesterday I ___ (go) to the gym.' Which form fits, and why not the others?"}\n\n(Socratic mode is on: I guide with questions, never hand you the rule. Correction cards still reveal when you err. "end" returns to normal coaching.)`,
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "explain",
    name: "Explain",
    oneLiner: "The one skill where I break Socratic silence and just teach the rule",
    commands: ["explain"],
    triggers: [/\bexplain\b/i, /what('s| is) the difference between/i, /when (do|should) (i|you) use\b/i, /how (do|does) (present perfect|past simple|a\/an|the) work/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const topic = ctx.text.replace(/^\/?explain\s*/i, "").replace(/what('s| is) the difference between/i, "").trim() || ctx.text;
      steps.push({ label: "Preparing the lesson", detail: topic.slice(0, 60) });
      const out = await aiJson<{ reply?: string; fa?: string; check?: string[] }>(
        `You are the linguist inside Rah, teaching a Farsi speaker around ${ctx.profile.level} who explicitly ASKED for the rule (this is the one mode where lecturing is allowed).
Topic: ${topic}

reply: the clearest possible explanation, max 130 words. Include: the rule in one line, 2 contrasting examples (wrong vs right), and the Farsi-interference angle if there is one.
fa: one or two Farsi sentences summarizing the interference or the takeaway.
check: 2 tiny check questions (with answers hidden in your reply's last line as "Quick check: 1) ... 2) ...").
Output ONE JSON object: {"reply": "", "fa": "", "check": ["", ""]}
No em dash anywhere.`,
        [{ role: "user", content: ctx.text }],
        () => ({}),
        { deep: false, temperature: 0.5 },
      );
      const reply = String(out.reply ?? "").trim();
      const check = Array.isArray(out.check) ? out.check.filter(Boolean).slice(0, 2) : [];
      return {
        skill: "explain",
        reply: `${reply}${check.length ? `\n\nQuick check: ${check.join(" ")}` : ""}`,
        corrections: [],
        fa_note: String(out.fa ?? "").trim(),
        steps,
      };
    },
  },
  {
    id: "debate",
    name: "Debate",
    oneLiner: "Three scored rounds: I take the other side and push back hard",
    commands: ["debate"],
    triggers: [/\bdebate\b/i, /argue (with|against) me/i, /convince me/i, /play devil'?s advocate/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      let topic = ctx.text.replace(/^\/?debate\s*(about|on|over)?\s*/i, "").trim();
      if (topic.length < 6 || /^(with|against) me$/i.test(topic)) {
        const pool = ["Remote work is better than office work", "Social media does more harm than good", "Exams measure nothing real", "Learning grammar rules beats learning phrases", "Cities are better than small towns for raising kids"];
        topic = pool[Math.floor(Math.random() * pool.length)];
      }
      steps.push({ label: "Motion set", detail: topic });
      const side = await aiJson<{ side?: string }>(
        `Debate topic: "${topic}". A Farsi-speaking learner around ${ctx.profile.level} will argue; YOU must take the opposing side. State your side in max 8 words. Output ONE JSON object: {"side": ""}`,
        [{ role: "user", content: "pick your side" }],
        () => ({}),
        { deep: false, temperature: 0.6 },
      );
      const mySide = String(side.side ?? "").trim() || "the opposite position";
      await db.learner.update({ where: { id: "me" }, data: { mode: "debate", modeData: JSON.stringify({ topic, side: mySide, round: 0, startedAt: Date.now() }) } });
      const open = await aiJson<{ reply?: string }>(
        `You are the debate opponent in Rah for a learner around ${ctx.profile.level}. Topic: "${topic}". Your side: ${mySide}.
Open the debate: 2 or 3 sentences with your strongest opening argument, ending with a direct challenge at them. English only, sharp register, no em dash.`,
        [{ role: "user", content: "open the debate" }],
        () => ({}),
        { deep: false, temperature: 0.7 },
      );
      return {
        skill: "debate",
        reply: `Motion: ${topic}\nMy side: ${mySide}\n\n${String(open.reply ?? "").trim()}\n\n(3 rounds, then a scored verdict on argument and language. Real errors get corrected on cards. Say "end debate" any time.)`,
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
];
