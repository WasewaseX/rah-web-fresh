// Production practice skills: reading, listening, speaking, writing,
// translation, roleplay, error anatomy and word lookup - the AI-content
// generators that hand the learner a card to work with.

import { aiJson, aiText } from "@/lib/ai";
import type { Skill } from "./run-types";

export const PRACTICE_SKILLS: Skill[] = [
  {
    id: "reading.quiz",
    name: "Reading quiz",
    blurb: "Paste a text (or give a topic) and get a comprehension quiz.",
    keywords: ["reading quiz", "comprehension", "quiz this text"],
    argHint: "paste a text or name a topic",
    async run(args, ctx) {
      const src = args || "an everyday B2 topic of your choice";
      const raw = await aiJson<{ title: string; passage: string; questions: { q: string; a: string; why: string }[] }>(
        `You build reading comprehension inside Rah for a ${ctx.profile.level} Farsi speaker. Take the source text or topic and produce: a short title, the passage (or an excerpt if a text was pasted, 120 to 180 words), and 4 questions (two literal, two inferential). Each has the answer and a one-line why. English only. Never use the em dash character.
Output ONE JSON object: {"title": "", "passage": "", "questions": [{"q": "", "a": "", "why": ""}]}`,
        [{ role: "user", content: src.slice(0, 4000) }],
      );
      const body = `${raw.passage}\n\n${(raw.questions ?? []).map((q, i) => `${i + 1}. ${q.q}`).join("\n")}`;
      const reveal = (raw.questions ?? []).map((q, i) => `${i + 1}. ${q.a} (${q.why})`).join("\n");
      return {
        label: "Built a reading quiz",
        summary: "Reading passage plus 4 questions are attached. Invite the learner to answer in chat and offer to check each one.",
        payload: { type: "card", title: String(raw.title ?? "Reading quiz"), body, reveal },
      };
    },
  },
  {
    id: "listening.drill",
    name: "Listening drill",
    blurb: "Fresh graded monologue with comprehension questions.",
    keywords: ["listening", "monologue", "ear training"],
    async run(_args, ctx) {
      const raw = await aiJson<{ title: string; text: string; questions: { q: string; choices: string[]; a: string; why: string }[] }>(
        `You write listening material for a ${ctx.profile.level} Farsi speaker. ONE natural spoken-style monologue, 160 to 220 words, contractions used. Then 4 mcq comprehension questions (two literal, two inferential). English only. Never use the em dash character.
Output ONE JSON object: {"title": "", "text": "", "questions": [{"q": "", "choices": ["","","",""], "a": "exact correct choice", "why": ""}]}`,
        [{ role: "user", content: "Pick a fresh, useful everyday topic this time." }],
      );
      const body = `${raw.text}\n\n${(raw.questions ?? []).map((q, i) => `${i + 1}. ${q.q}\n${(q.choices ?? []).map((c) => `   ${c}`).join("\n")}`).join("\n")}`;
      const reveal = (raw.questions ?? []).map((q, i) => `${i + 1}. ${q.a} (${q.why})`).join("\n");
      return {
        label: "Generated a listening drill",
        summary: "Monologue plus 4 multiple-choice questions are attached, answers hidden until revealed. Tell the learner to read aloud slowly once, then answer.",
        payload: { type: "card", title: String(raw.title ?? "Listening drill"), body, reveal },
      };
    },
  },
  {
    id: "speaking.drill",
    name: "Speaking drill",
    blurb: "A 2-minute speaking prompt with a round-2 constraint.",
    keywords: ["speaking", "speak practice", "talk for 2 minutes"],
    async run(_args, ctx) {
      const raw = await aiJson<{ prompt: string; angle: string; round2: string }>(
        `You design speaking tasks for a ${ctx.profile.level} Farsi speaker. Give ONE prompt (a question that produces opinion plus reasons), one angle to force development, and a round-2 constraint that makes the repeat harder (ban a common verb, demand a counterargument, require hedging). English only. Never use the em dash character.
Output ONE JSON object: {"prompt": "", "angle": "", "round2": ""}`,
        [{ role: "user", content: "New topic, not food or family." }],
      );
      return {
        label: "Designed a speaking task",
        summary: "Speaking prompt attached. Tell the learner to record in the Speaking tab or answer in chat, then you will grade the transcript.",
        payload: { type: "card", title: "2-minute speaking task", body: `Prompt: ${raw.prompt}\nDevelop: ${raw.angle}\nRound 2 constraint: ${raw.round2}` },
      };
    },
  },
  {
    id: "writing.task",
    name: "Writing task",
    blurb: "A B2-to-C1 essay prompt with clear requirements.",
    keywords: ["writing task", "essay prompt", "give me a writing"],
    async run(_args, ctx) {
      const raw = await aiJson<{ prompt: string; requirements: string[] }>(
        `You set writing tasks for a ${ctx.profile.level} Farsi speaker. ONE prompt with 3 concrete requirements (structure, target structures to use, register). English only. Never use the em dash character.
Output ONE JSON object: {"prompt": "", "requirements": ["", "", ""]}`,
        [{ role: "user", content: "A fresh C1-flavored task." }],
      );
      return {
        label: "Set a writing task",
        summary: "Writing task attached. Point the learner to the Writing tab for full grading, or accept a draft in chat.",
        payload: { type: "card", title: "Writing task", body: `${raw.prompt}\nRequirements:\n${(raw.requirements ?? []).map((r) => `- ${r}`).join("\n")}` },
      };
    },
  },
  {
    id: "translation.drill",
    name: "Translation drill",
    blurb: "Farsi sentences to render in natural English.",
    keywords: ["translation", "translate drill", "farsi to english"],
    async run(_args, ctx) {
      const raw = await aiJson<{ items: { fa: string; en: string; note: string }[] }>(
        `You drill Farsi-to-English translation for a ${ctx.profile.level} learner. Produce 5 everyday-but-rich Farsi sentences (formal and informal mix) that expose classic interference: articles, countability, perfect tense, prepositions. Each with a natural English rendering and a one-line English note on the trap. Farsi appears only in the "fa" fields. Never use the em dash character.
Output ONE JSON object: {"items": [{"fa": "", "en": "", "note": ""}]}`,
        [{ role: "user", content: "Generate the 5 sentences." }],
      );
      const body = (raw.items ?? []).map((it, i) => `${i + 1}. ${it.fa}`).join("\n");
      const reveal = (raw.items ?? []).map((it, i) => `${i + 1}. ${it.en} (${it.note})`).join("\n");
      return {
        label: "Built a translation drill",
        summary: "5 Farsi sentences attached, model answers hidden. Ask the learner to translate in chat; grade each against the model plus fair variants.",
        payload: { type: "card", title: "Translate to English", body, reveal },
      };
    },
  },
  {
    id: "roleplay",
    name: "Roleplay",
    blurb: "Live scenario: job interview, airport, debate, you name it.",
    keywords: ["roleplay", "scenario", "pretend"],
    argHint: "scenario",
    async run(args, ctx) {
      const scene = args || "a job interview for a position you want";
      const setup = await aiText(
        `You set up roleplay inside Rah for a ${ctx.profile.level} Farsi speaker. Write a 3 to 4 sentence setup in English: the scene, your role, the learner's role, and your opening line in character. English only, no meta commentary, never use the em dash character.`,
        [{ role: "user", content: `Scenario: ${scene}` }],
      );
      return {
        label: `Started a roleplay (${scene.slice(0, 30)})`,
        summary: `Roleplay is set up. Stay in character in following turns until the learner exits the scenario.`,
        payload: { type: "card", title: "Roleplay", body: setup },
      };
    },
  },
  {
    id: "explain.error",
    name: "Error anatomy",
    blurb: "Paste a sentence; get every problem named and explained.",
    keywords: ["what is wrong", "explain the error", "anatomy", "check this sentence"],
    argHint: "the sentence",
    async run(args, ctx) {
      const s = args || ctx.args;
      if (!s.trim()) throw new Error("Give me the sentence to dissect.");
      const raw = await aiJson<{ errors: { wrong: string; right: string; fa: string; trap: string }[]; verdict: string }>(
        `You dissect one English sentence written by a ${ctx.profile.level} Farsi speaker. List EVERY real problem (grammar, word choice, collocation, register, punctuation); do not invent problems. For each: wrong, right, a Farsi explanation of why Farsi speakers make this mistake, and a trap tag. Then a one-sentence English verdict. Farsi only inside "fa". Never use the em dash character.
Output ONE JSON object: {"errors": [{"wrong": "", "right": "", "fa": "", "trap": ""}], "verdict": ""}`,
        [{ role: "user", content: s.slice(0, 600) }],
      );
      const body = raw.verdict || "Dissected.";
      return {
        label: "Dissected a sentence",
        summary: `Error anatomy done: ${(raw.errors ?? []).length} issues found. Repeat the corrections in your reply's corrections field (same wrong/right/fa), and the verdict as commentary.`,
        payload: { type: "card", title: "Error anatomy", body },
      };
    },
  },
  {
    id: "word.lookup",
    name: "Word lookup",
    blurb: "Meaning, register, collocations, Farsi sense, one example.",
    keywords: ["what does", "lookup", "meaning of", "how to use"],
    argHint: "word or phrase",
    async run(args, ctx) {
      const w = args.trim();
      if (!w) throw new Error("Name the word or phrase.");
      const raw = await aiJson<{ meaning: string; register: string; collocations: string[]; fa: string; example: string }>(
        `You are the dictionary card of Rah for a ${ctx.profile.level} Farsi speaker. For the given word or phrase: meaning (one English line), register (formal, neutral, informal, vulgar), 4 real collocations, the Farsi sense distinction (what Farsi word it maps to and where that mapping breaks), and one natural example sentence. Never use the em dash character.
Output ONE JSON object: {"meaning": "", "register": "", "collocations": ["", "", "", ""], "fa": "", "example": ""}`,
        [{ role: "user", content: w }],
      );
      const body = [
        String(raw.meaning ?? ""),
        `Register: ${raw.register ?? "neutral"}`,
        `Collocations: ${(raw.collocations ?? []).join(", ")}`,
        String(raw.example ?? ""),
      ].join("\n");
      return {
        label: `Looked up "${w.slice(0, 24)}"`,
        summary: "Word card attached. Farsi sense note is inside the card.",
        payload: { type: "card", title: w, body },
      };
    },
  },
];
