// The B1-C1 guide map (Task 130): the complete structure of "The Ultimate
// Guide to B1 B2 C1 Grammar & Vocabulary" (English with Lucy, Lucy Bella
// Simkins, (c) 2023, 92 pages), embedded in the app and in the AI's memory.
//
// Provenance, stated honestly:
// - Titles and page numbers below are harvested VERBATIM from the book's
//   printed table of contents (public extracts of the document).
// - The B2 and C1 checklist items are VERBATIM quotes from the book (public
//   mirror). The B1 checklist item LIST in the book was not in any public
//   extract, so those items are DERIVED from the B1 grammar/vocabulary topic
//   map and labeled "derived".
// - Topic hints are the app's own teaching notes for that topic (standard
//   CEFR grammar), not quotes from the book.
// - The intro quote and the method description come from the book/author page.

export type GuideLevelId = "B1" | "B2" | "C1";
export type GuideSectionId = "grammar" | "vocabulary" | "pronunciation" | "checklist" | "study_plan";

export interface GuideTopic {
  id: string; // stable, e.g. "b2.cleft_sentences"
  title: string; // verbatim TOC title
  page: number;
  hint: string; // the app's teaching note for this topic (not a book quote)
  tags: string[]; // overlap with the app's trap tags / curriculum evidence
  node?: string; // curriculum node id this topic feeds (validated at import)
}

export interface GuideChecklist {
  pages: string;
  source: "verbatim" | "derived";
  note: string;
  items: string[]; // self-assessment questions, 3-box rating in the book
}

export interface GuideLevelSection {
  level: GuideLevelId;
  titlePage: number;
  overview: { page: number; text: string }; // our factual summary, not a quote
  grammar: GuideTopic[];
  vocabulary: GuideTopic[];
  pronunciation: { pages: string; note: string };
  checklist: GuideChecklist;
  studyPlan: { pages: string; months: number; note: string };
}

export const GUIDE_META = {
  title: "The Ultimate Guide to B1 B2 C1 Grammar & Vocabulary",
  subtitle: "Your Straightforward Path to English Fluency - From Intermediate to Advanced",
  author: "Lucy Bella Simkins (English with Lucy)",
  year: 2023,
  pages: 92,
  source: "https://www.scribd.com/document/862508903/B1-C1-English-eBook",
  method:
    "Grammar points with examples per level; vocabulary topics with phrasal verbs, idioms and word formation; printable self-rating checklists (easy / some difficulty / difficult); example study plans to reach each level in 3 months.",
  intro:
    "Hello lovely students, and welcome to this ultimate guide that I've put together for you to help you better understand the language you'll need to master in order to reach different levels of English proficiency! In this guide, we'll focus mainly on grammar and vocabulary. Contained in this ebook is a full guide to the grammar structures and vocabulary you'll need to know at the B1, B2 and C1 levels of the CEFR. At each level, we have a comprehensive checklist, which means you will be able to use this book to work out your current level, discover what you need to improve and choose the right course level to suit your needs!",
};

// The three-box self-rating legend used by every checklist in the book.
export const CHECKLIST_LEGEND = ["It is easy for me.", "I have some difficulty with this.", "It is difficult for me."];

const derivedNote = "Item list derived by the app from the book's B1 topic map (the printed B1 checklist text was not in any public extract); format follows the book's 3-box self-rating.";
const verbatimNote = "Verbatim self-assessment questions from the book (public mirror).";

export const GUIDE_LEVELS: GuideLevelSection[] = [
  {
    level: "B1",
    titlePage: 8,
    overview: {
      page: 9,
      text: "Intermediate: simple connected text on familiar subjects, main points of clear standard input, and the tenses and patterns to handle everyday life, travel, work basics and opinions.",
    },
    grammar: [
      { id: "b1.present_tenses", title: "Present Tenses", page: 10, hint: "present simple vs continuous; stative verbs never take -ing (I am knowing dies here)", tags: ["statives", "copula"], node: "b2_copula" },
      { id: "b1.past_tenses", title: "Past Tenses", page: 10, hint: "past simple vs continuous; present perfect vs past simple (rafte-am does not map to 'I have seen him yesterday')", tags: ["perfect"], node: "b2_perfect" },
      { id: "b1.future_tenses", title: "Future Tenses", page: 11, hint: "will vs going to vs present continuous for plans; 'intend to' style phrases", tags: [] },
      { id: "b1.modal_verbs", title: "Modal Verbs", page: 11, hint: "can/could/must/should/have to for ability, obligation, advice; deduction basics", tags: [] },
      { id: "b1.conditionals", title: "Conditionals", page: 12, hint: "zero, first and second conditional forms and their time meanings", tags: [] },
      { id: "b1.phrasal_verbs", title: "Phrasal Verbs", page: 12, hint: "high-frequency verb+particle pairs for travel, work, daily routine", tags: ["word_choice"] },
      { id: "b1.adjective_order", title: "Order of Adjectives, Comparatives & Superlatives", page: 12, hint: "opinion-size-age-shape-colour-origin-material-purpose order; Persian noun+adjective order dies here", tags: ["adjectives"], node: "b2_sentence_shape" },
      { id: "b1.passive_voice", title: "Passive Voice", page: 13, hint: "be + past participle across tenses; when the agent matters less", tags: [] },
      { id: "b1.reported_speech", title: "Reported Speech", page: 13, hint: "backshift, reported questions and commands (tell vs say)", tags: [] },
      { id: "b1.question_tags", title: "Question Tags & Indirect Questions", page: 13, hint: "tags for agreement; embedded word order: Do you know where the station IS, not where is the station", tags: ["question_order"], node: "b2_questions" },
      { id: "b1.verb_patterns", title: "Verb Patterns", page: 14, hint: "verb + infinitive vs gerund (decide to do / enjoy doing); keep/stop/remember shifts", tags: [] },
      { id: "b1.prepositions", title: "Prepositions of Place & Time", page: 14, hint: "in/at/on split one Persian 'dar' into three decisions, by collocation not translation", tags: ["prepositions"], node: "b2_prepositions" },
    ],
    vocabulary: [
      { id: "b1.family", title: "Family & Relationships", page: 16, hint: "relations, in-laws, stages of a relationship, get on with / look up to", tags: [] },
      { id: "b1.personality", title: "Personality & Character", page: 17, hint: "beyond nice/good/bad: honest, stubborn, reliable, easy-going", tags: [] },
      { id: "b1.travel", title: "Travel", page: 18, hint: "book (v), accommodation, sightseeing, get around, delayed/cancelled", tags: [] },
      { id: "b1.likes_dislikes", title: "Likes & Dislikes", page: 19, hint: "be keen on, can't stand, be into, gradable intensity of preference", tags: [] },
      { id: "b1.health", title: "Health & Fitness", page: 20, hint: "illness/injury collocations, at the pharmacy, work out / stay in shape", tags: [] },
      { id: "b1.education", title: "Learning & Education", page: 21, hint: "revise, take an exam, pass/fail, postgraduate, drop out", tags: [] },
      { id: "b1.business", title: "Business Roles & Employment", page: 22, hint: "apply for, employee/employer, salary/wage, resign, get promoted", tags: [] },
      { id: "b1.money", title: "Money & Finance", page: 23, hint: "afford, borrow vs lend, save up, in debt, charge (v)", tags: [] },
      { id: "b1.environment", title: "The Environment", page: 24, hint: "pollution, climate change, renewable, throw away, cut down on", tags: [] },
      { id: "b1.technology", title: "Technology", page: 25, hint: "devices and verbs: charge, plug in, download, log in, break down", tags: [] },
    ],
    pronunciation: { pages: "26-27", note: "B1 pronunciation section (word stress, weak forms, key vowel contrasts). Item detail is in the book's printable checklists, not in the public extract." },
    checklist: {
      pages: "28-31",
      source: "derived",
      note: derivedNote,
      items: [
        "Can you use all present and past tenses, including present perfect, accurately?",
        "Can you talk about future plans with will, going to and present continuous?",
        "Can you use modal verbs for ability, obligation, advice and deduction?",
        "Can you build zero, first and second conditionals correctly?",
        "Can you use common phrasal verbs in travel, work and daily life?",
        "Can you order adjectives correctly and use comparatives and superlatives?",
        "Can you form the passive voice across the main tenses?",
        "Can you report what someone said, asked or told you to do?",
        "Can you use question tags and indirect questions with correct word order?",
        "Can you discuss family, travel, health, money, education, work, environment and technology with the key vocabulary for each?",
      ],
    },
    studyPlan: { pages: "32-36", months: 3, note: "Example B1 study plan: reach the level in 3 months on the book's daily/weekly routine (grammar + vocab + pronunciation blocks)." },
  },
  {
    level: "B2",
    titlePage: 37,
    overview: {
      page: 38,
      text: "Upper-intermediate: clear detailed text on a wide range of subjects, argument, hypothesis and register control, errors that never block meaning.",
    },
    grammar: [
      { id: "b2.present_tenses", title: "Present Tenses", page: 39, hint: "perfect and continuous aspects with stative boundaries; state vs action verbs at B2 precision", tags: ["perfect", "statives"] },
      { id: "b2.past_tenses", title: "Past Tenses", page: 39, hint: "narrate with a variety of past tenses; perfect aspect for earlier-in-past", tags: ["perfect"] },
      { id: "b2.future_tenses", title: "Future Tenses", page: 39, hint: "future continuous and perfect; plans vs predictions vs timetables", tags: [] },
      { id: "b2.reported_speech", title: "Reported Speech", page: 40, hint: "advanced backshift, reporting verbs with patterns (claim to do, insist that)", tags: [] },
      { id: "b2.verb_patterns", title: "Verb Patterns", page: 40, hint: "multi-word patterns: verb + object + infinitive, preposition + gerund", tags: [] },
      { id: "b2.modal_verbs", title: "Modal Verbs", page: 40, hint: "speculation and deduction: must/can't/might have + participle", tags: [] },
      { id: "b2.advanced_clauses", title: "Advanced Clauses", page: 40, hint: "relative and participle clauses; defining vs non-defining with correct punctuation", tags: [] },
      { id: "b2.causative", title: "The Causative", page: 41, hint: "have/get something done; make/let/have someone do", tags: [] },
      { id: "b2.mixed_conditionals", title: "Mixed Conditionals", page: 41, hint: "past condition, present result and the rest of the cross-time grid", tags: [] },
      { id: "b2.advanced_adjectives", title: "Advanced Adjectives", page: 41, hint: "extreme/gradable adjective pairs (furious vs very angry) with matching intensifiers", tags: ["word_choice"] },
      { id: "b2.impersonal_passive", title: "Impersonal Passive", page: 42, hint: "It is said that... / He is believed to... reporting structures", tags: [] },
      { id: "b2.cleft_sentences", title: "Cleft Sentences", page: 42, hint: "It was Lucy who... / What I need is... for emphasis and focus", tags: [] },
      { id: "b2.word_formation", title: "Word Formation/Families", page: 42, hint: "prefix/suffix families: -tion/-ment/-ous/-ify; collocation-grade derivatives", tags: ["word_choice"], node: "b2p_collocations" },
      { id: "b2.punctuation", title: "Punctuation", page: 42, hint: "commas with clauses, semicolons, apostrophes; written register hygiene", tags: [] },
    ],
    vocabulary: [
      { id: "b2.appearance", title: "Appearance", page: 44, hint: "beyond tall/short: well-built, scruffy, smart, striking, take after", tags: [] },
      { id: "b2.childhood", title: "Childhood & Growing Up", page: 45, hint: "bring up, grow up, childhood memories collocations, used to/would for past habits", tags: [] },
      { id: "b2.animals", title: "Pets & Animals", page: 46, hint: "breeds, animal verbs and idioms, animal welfare basics", tags: [] },
      { id: "b2.weddings", title: "Relationships, Weddings & Marriages", page: 47, hint: "get engaged, propose, bride/groom, tie the knot, split up", tags: [] },
      { id: "b2.british_food", title: "British Food", page: 48, hint: "dishes and meal vocabulary, eating-out phrases, food idioms", tags: [] },
      { id: "b2.sport", title: "Sport", page: 49, hint: "do/play/go collocations, win vs beat, score, league, draw (n)", tags: [] },
      { id: "b2.news", title: "The News", page: 50, hint: "headlines language, break the news, sources, allegedly, coverage", tags: [] },
      { id: "b2.internet", title: "The Internet", page: 51, hint: "doomscroll, clickbait, go viral, stream, bandwidth of social-media talk", tags: ["word_choice"] },
      { id: "b2.office_jargon", title: "Office Jargon", page: 52, hint: "touch base, meet a deadline, circle back, bandwith, low-hanging fruit", tags: ["word_choice"] },
      { id: "b2.health_system", title: "Health & The Health System", page: 53, hint: "symptoms, prescription, referral, A&E, book an appointment", tags: [] },
    ],
    pronunciation: { pages: "54", note: "B2 pronunciation section (the book's TOC prints this as 'B1', an obvious typo in the source). Not itemized in the public extract." },
    checklist: {
      pages: "55-57",
      source: "verbatim",
      note: verbatimNote,
      items: [
        "Can you discuss social media and the internet using terms like 'doomscroll' and 'clickbait'?",
        "Are you comfortable talking about work using phrases like 'touch base' or 'meet a deadline'?",
        "Do you understand how to use relative and participle clauses?",
        "Are you able to speculate and make deductions using modal verbs such as 'must' and 'can't'?",
        "Can you narrate a story using a variety of past tenses?",
        "Can you use question tags to seek agreement or confirm knowledge?",
        "Do you use linking words like 'nevertheless' or 'therefore' to connect your ideas?",
        "Are you able to express regrets or hypothetical situations using the third conditional?",
        "Do you know how to express future plans with various tenses and phrases like 'intend to'?",
        "Do you understand and use idiomatic expressions (e.g., to cut to the chase)?",
      ],
    },
    studyPlan: { pages: "58-62", months: 3, note: "Example B2 study plan: reach the level in 3 months on the book's daily/weekly routine." },
  },
  {
    level: "C1",
    titlePage: 63,
    overview: {
      page: 64,
      text: "Advanced: well-structured text on complex subjects, flexible and effective use of language, errors rare and subtle, idiomatic range and nuance.",
    },
    grammar: [
      { id: "c1.present_tenses", title: "Present Tenses", page: 65, hint: "aspect nuance at native precision; present tenses for narrative and future reference", tags: [] },
      { id: "c1.past_tenses", title: "Past Tenses", page: 65, hint: "layered past narration with subtle aspect shifts", tags: [] },
      { id: "c1.future_tenses", title: "Future Tenses", page: 65, hint: "future in the past, fine plan/prediction distinctions", tags: [] },
      { id: "c1.paraphrasing", title: "Paraphrasing", page: 66, hint: "say it another way without repeating words: synonyms, nominalization, voice flip", tags: ["word_choice"], node: "c1_precise_verbs" },
      { id: "c1.speculative_modals", title: "Modal Verbs, Speculation & Deduction", page: 66, hint: "graded deduction and substitutes (the odds are, bound to)", tags: [] },
      { id: "c1.conditionals", title: "Conditionals", page: 67, hint: "advanced and mixed conditionals, inverted conditionals (Were I to..., Had I known)", tags: [] },
      { id: "c1.passive_voice", title: "The Passive Voice", page: 67, hint: "all passive forms including get-passives (he got caught) and impersonal reporting", tags: [] },
      { id: "c1.negative_inversion", title: "Negative Inversion", page: 67, hint: "Rarely have I seen... / Not only did she... for emphasis and style", tags: [] },
      { id: "c1.hedging_boosting", title: "Hedging & Boosting", page: 68, hint: "soften or strengthen claims: it seems, to some extent, arguably / undoubtedly, by far", tags: ["register", "word_choice"], node: "b2p_hedging" },
      { id: "c1.multi_meaning_phrasals", title: "Phrasal Verbs With Multiple Meanings", page: 68, hint: "one particle verb, several senses: pick up the phone / a language / a cold", tags: ["word_choice"] },
      { id: "c1.advanced_comparatives", title: "Advanced Comparatives & Superlatives", page: 69, hint: "nowhere near as, increasingly difficult, by far the most, the more the merrier", tags: [] },
      { id: "c1.word_formation", title: "Word Formation", page: 69, hint: "productive affixation and conversion for exam word-formation tasks", tags: ["word_choice"] },
    ],
    vocabulary: [
      { id: "c1.food_nutrition", title: "Food & Nutrition", page: 71, hint: "diet, superfood, additives, plant-based, moderation collocations", tags: [] },
      { id: "c1.wellness", title: "Self-Improvement & Wellness", page: 72, hint: "mindset, burnout, self-care, hold yourself accountable, form a habit", tags: [] },
      { id: "c1.housing", title: "Housing", page: 73, hint: "rent/buy, mortgage, landlord/tenant, renovation, put down a deposit", tags: [] },
      { id: "c1.urban_rural", title: "Urban & Rural Life", page: 74, hint: "commute, urban sprawl, rural depopulation, cost of living, quality of life", tags: [] },
      { id: "c1.humour", title: "Humour", page: 75, hint: "satire, pun, irony, dry humour, deadpan: understanding nuanced humour", tags: [] },
      { id: "c1.personalities", title: "Personalities", page: 76, hint: "nuanced character words: charismatic, self-absorbed, down-to-earth, aloof", tags: [] },
      { id: "c1.tourism", title: "Tourism", page: 77, hint: "off the beaten track, hidden gem, sustainable tourism, crowd-free", tags: [] },
      { id: "c1.remote_work", title: "Remote Work & Commuting", page: 78, hint: "work from home, hybrid, commute, flexible hours, Zoom fatigue", tags: [] },
      { id: "c1.job_hunting", title: "Quitting & Job-Hunting", page: 79, hint: "hand in your notice, headhunt, tailor your CV, interview jargon", tags: [] },
      { id: "c1.freelancing", title: "Freelancing", page: 80, hint: "invoice, retainer, gig, client pipeline, scope creep", tags: [] },
    ],
    pronunciation: { pages: "81", note: "C1 pronunciation section (connected speech, intonation for stance). Not itemized in the public extract." },
    checklist: {
      pages: "82-84",
      source: "verbatim",
      note: verbatimNote,
      items: [
        "Are you able to understand satire and nuanced humour?",
        "Can you express subtle differences in meaning using advanced vocabulary?",
        "Are you comfortable with all forms of the passive voice, including 'get' passives?",
        "Can you use advanced modals and their substitutes (e.g., the odds are)?",
        "Do you employ inversion for emphasis or stylistic effect (e.g., 'Rarely have I seen...')?",
        "Can you paraphrase effectively, avoiding repetition of the same words or phrases?",
        "Are you able to apply hedging and boosting language to soften or strengthen statements?",
        "Are you comfortable with advanced and mixed conditionals?",
        "Can you use ellipsis and substitution to avoid redundancy?",
        "Can you understand and use colloquial expressions and slang appropriately?",
      ],
    },
    studyPlan: { pages: "85-90", months: 3, note: "Example C1 study plan: reach the level in 3 months on the book's daily/weekly routine." },
  },
];

// The book's opening section (pages 6-7): what CEFR levels mean.
export const GUIDE_CEFR = {
  pages: "6-7",
  note: "What are the CEFR Levels of English? The book frames A1-C2 as a ladder and focuses on B1 (intermediate), B2 (upper-intermediate) and C1 (advanced): use the per-level checklists to work out your current level, find gaps, and pick the right target.",
};

// ---------- API ----------

const BY_LEVEL = new Map(GUIDE_LEVELS.map((s) => [s.level, s]));

export function guideSection(level: GuideLevelId): GuideLevelSection {
  const s = BY_LEVEL.get(level);
  if (!s) throw new Error(`unknown guide level ${level}`);
  return s;
}

export function guideAllTopics(): GuideTopic[] {
  return GUIDE_LEVELS.flatMap((s) => [...s.grammar, ...s.vocabulary]);
}

// Curriculum cross-walk: which guide topics feed each curriculum node.
export function guideTopicsForNode(nodeId: string): GuideTopic[] {
  return guideAllTopics().filter((t) => t.node === nodeId);
}

// Compact AI-memory block: the whole map in a few lines, prompt-injectable.
export function guideMapForPrompt(): string {
  const line = (s: GuideLevelSection) => {
    const g = s.grammar.map((t) => t.title.toLowerCase().replace(/ & /g, " and ")).join(", ");
    const v = s.vocabulary.map((t) => t.title.toLowerCase().replace(/ & /g, " and ")).join(", ");
    return `${s.level} grammar: ${g}. ${s.level} vocabulary: ${v}.`;
  };
  return GUIDE_LEVELS.map(line).join("\n");
}

// Import-time integrity: duplicate topic ids must fail loud (this module is
// data authority for the tool, the prompt memory and the UI panel). The
// curriculum cross-references (t.node) are validated in the battery, which
// imports both graphs - kept out of here so the module stays client-safe.
const SEEN_IDS = new Set<string>();
for (const t of guideAllTopics()) {
  if (SEEN_IDS.has(t.id)) throw new Error(`duplicate guide topic id ${t.id}`);
  SEEN_IDS.add(t.id);
}
