// Shared lookup tables for the power skills: mistake-tag routing, the
// Farsi-phonology minimal-pair bank and the view-name regexes used by the
// navigation plugin.

export const TAG_TO_SKILL: Record<string, string> = {
  statives: "grammar", articles: "grammar", countability: "grammar", plurals: "grammar",
  copula: "grammar", prepositions: "grammar", perfect: "grammar", question_order: "grammar",
  adjectives: "grammar", that_omission: "grammar",
  word_choice: "vocabulary", register: "vocabulary", collocation: "vocabulary", spelling: "vocabulary",
};

// Farsi-phonology minimal pairs, curated (no AI needed, instant, reliable):
// the interference points Persian speakers actually hit.
export const MINIMAL_PAIRS: { tag: string; pairs: [string, string][]; tip: string; fa: string }[] = [
  {
    tag: "th_sounds",
    pairs: [["think", "sink"], ["three", "tree"], ["bath", "bass"], ["they", "day"], ["breathe", "breeze"]],
    tip: "Persian has no dental fricatives: /th/ collapses to s, t, z or d. Put the tongue tip BETWEEN the teeth and blow - no vibration for 'think', vibration for 'they'.",
    fa: "در فارسی صدای th وجود ندارد؛ زبان را بین دندان‌ها بگذار و هوا بده: think نه sink، they نه day.",
  },
  {
    tag: "w_v",
    pairs: [["west", "vest"], ["wine", "vine"], ["wow", "vow"], ["worse", "verse"], ["wheel", "veal"]],
    tip: "Persian has /v/ but no true /w/. Round the lips tightly and let the air pass with NO teeth contact for 'west' - teeth on lip is 'vest'.",
    fa: "برای w لب‌ها را گرد کن و با دندان لمس نده: west نه vest. v با دندان روی لب ساخته می‌شود.",
  },
  {
    tag: "clusters",
    pairs: [["student", "estudent"], ["street", "estreet"], ["sport", "esport"], ["school", "eschool"], ["special", "especial"]],
    tip: "Farsi inserts a vowel before st-, sp-, sc- clusters (epenthesis). Start straight into the cluster: 's-t' with no vowel before the s.",
    fa: "فارسی قبل از خوشه‌های st و sp یک مصوت اضافه می‌کند: student نه estudent. مستقیم با s شروع کن.",
  },
  {
    tag: "ng",
    pairs: [["sing", "sin"], ["long", "lawn"], ["thing", "thin"], ["singer", "sinner"]],
    tip: "Final -ng is one nasal sound /ŋ/, not /n/ plus a g. Hold the back of the tongue up; the g in 'singer' is silent in careful speech.",
    fa: "پایان کلمات -ng یک صدای بینی است، نه n و g جدا: sing نه sing+گ.",
  },
  {
    tag: "stress",
    pairs: [["PHOtograph", "phoTOgrapher"], ["PREsent (noun)", "preSENT (verb)"], ["REcord (noun)", "reCORD (verb)"], ["HOspital", "hospital"]],
    tip: "Farsi is syllable-timed, so English stress contrast flattens. Exaggerate the loud syllable: one peaks, the others shrink.",
    fa: "تمایز تکیه (stress) در انگلیسی قوی است؛ هجای پرتکیه را بلندتر و کشیده‌تر بگو، بقیه را کوتاه کن.",
  },
];

export const VIEW_WORDS: Record<string, RegExp> = {
  home: /\bhome\b|dashboard/i,
  review: /\breview\b|\bsrs\b|\bflashcards?\b/i,
  chat: /\bcoach\b|\bchat\b/i,
  write: /\bwrit(e|ing)\b/i,
  speak: /\bspeak(ing)?\b|\bspeaking\b/i,
  listen: /\blisten(ing)?\b/i,
  read: /\bread(ing)?\b/i,
  placement: /\bplacement\b|\bplace(ment)? test\b/i,
  progress: /\bprogress\b|\bstats?\b|\bstatistics\b/i,
};
