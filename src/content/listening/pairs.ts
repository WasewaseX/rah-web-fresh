// Listening drill banks beyond the passages: minimal pairs, word stress
// shifts, and linking/reduction awareness items.

// ---------------------------------------------------------------- minimal pairs

export interface Pair {
  id: string;
  a: string;
  b: string;
  focus: string;
  hint: string;
}

export const PAIR_FOCUS = [
  { id: "i_i", label: "Short i vs long ee", note: "ship / sheep: tongue height, not length alone" },
  { id: "ae_e", label: "ae vs e", note: "bad / bed: jaw drops more for ae" },
  { id: "th", label: "th vs s, t, d, z", note: "think / sink: tongue between teeth" },
  { id: "wv", label: "w vs v", note: "west / vest: lips round for w, teeth touch lip for v" },
  { id: "o_oo", label: "Short o vs long oo", note: "full / fool: lip rounding and length" },
] as const;

export const MINIMAL_PAIRS: Pair[] = [
  { id: "p1", a: "ship", b: "sheep", focus: "i_i", hint: "The first vowel is shorter and more relaxed" },
  { id: "p2", a: "live", b: "leave", focus: "i_i", hint: "Same vowel pair, final consonant changes too" },
  { id: "p3", a: "sit", b: "seat", focus: "i_i", hint: "One is an action, the other furniture" },
  { id: "p4", a: "fill", b: "feel", focus: "i_i", hint: "Both verbs, different vowels" },
  { id: "p5", a: "it", b: "eat", focus: "i_i", hint: "Tiny word vs everyday verb" },
  { id: "p6", a: "still", b: "steal", focus: "i_i", hint: "Adverb or adjective vs a verb" },
  { id: "p7", a: "bad", b: "bed", focus: "ae_e", hint: "Jaw position is the whole difference" },
  { id: "p8", a: "man", b: "men", focus: "ae_e", hint: "Singular vs plural, one vowel apart" },
  { id: "p9", a: "sand", b: "send", focus: "ae_e", hint: "Beach material vs a communication verb" },
  { id: "p10", a: "sad", b: "said", focus: "ae_e", hint: "Feeling vs past of say" },
  { id: "p11", a: "think", b: "sink", focus: "th", hint: "Tongue between teeth vs behind them" },
  { id: "p12", a: "three", b: "free", focus: "th", hint: "Numbers vs a price of zero" },
  { id: "p13", a: "then", b: "den", focus: "th", hint: "Time word vs an animal home" },
  { id: "p14", a: "breathe", b: "breeze", focus: "th", hint: "The verb has a softer ending" },
  { id: "p15", a: "west", b: "vest", focus: "wv", hint: "Lips vs teeth at the start" },
  { id: "p16", a: "wine", b: "vine", focus: "wv", hint: "Both exist on a dinner table" },
  { id: "p17", a: "wet", b: "vet", focus: "wv", hint: "Weather vs a profession" },
  { id: "p18", a: "worse", b: "verse", focus: "wv", hint: "Comparative vs a poetry unit" },
  { id: "p19", a: "full", b: "fool", focus: "o_oo", hint: "Length plus rounding" },
  { id: "p20", a: "pull", b: "pool", focus: "o_oo", hint: "One you do to a door, one you swim in" },
  { id: "p21", a: "cook", b: "kook", focus: "o_oo", hint: "Kitchen verb vs slang for a strange person" },
  { id: "p22", a: "soot", b: "suit", focus: "o_oo", hint: "Chimney dust vs formal clothes" },
];

// ---------------------------------------------------------------- stress items

export interface StressItem {
  id: string;
  word: string;
  syllables: string[];
  stress: number; // index of stressed syllable
  shiftNote: string;
}

export const STRESS_ITEMS: StressItem[] = [
  { id: "s1", word: "photograph", syllables: ["pho", "to", "graph"], stress: 0, shiftNote: "photographer moves the stress to 2" },
  { id: "s2", word: "photographer", syllables: ["pho", "tog", "ra", "pher"], stress: 1, shiftNote: "photograph stresses 1" },
  { id: "s3", word: "record (n)", syllables: ["re", "cord"], stress: 0, shiftNote: "record (v) stresses 1" },
  { id: "s4", word: "record (v)", syllables: ["re", "cord"], stress: 1, shiftNote: "record (n) stresses 0" },
  { id: "s5", word: "present (n)", syllables: ["pre", "sent"], stress: 0, shiftNote: "present (v) stresses 1" },
  { id: "s6", word: "present (v)", syllables: ["pre", "sent"], stress: 1, shiftNote: "present (n) stresses 0" },
  { id: "s7", word: "necessary", syllables: ["ne", "ces", "sa", "ry"], stress: 0, shiftNote: "many learners stress 1, which is wrong" },
  { id: "s8", word: "comfortable", syllables: ["com", "for", "ta", "ble"], stress: 0, shiftNote: "often said with 3 syllables: comf-ter-ble" },
  { id: "s9", word: "development", syllables: ["de", "ve", "lop", "ment"], stress: 1, shiftNote: "develop alone also stresses 1" },
  { id: "s10", word: "opportunity", syllables: ["o", "ppor", "tu", "ni", "ty"], stress: 1, shiftNote: "keep the second syllable long" },
  { id: "s11", word: "influence", syllables: ["in", "flu", "ence"], stress: 0, shiftNote: "influential keeps the same position" },
  { id: "s12", word: "responsible", syllables: ["re", "spon", "si", "ble"], stress: 1, shiftNote: "responsibility stresses 3" },
];

// Linking and reduction awareness: what fast speech actually sounds like.
export interface LinkItem {
  id: string;
  written: string;
  heard: string;
  note: string;
}

export const LINK_ITEMS: LinkItem[] = [
  { id: "k1", written: "What are you going to do?", heard: "Whaddaya gonna do?", note: "are you reduces to addaya, going to to gonna" },
  { id: "k2", written: "I want to know.", heard: "I wanna know.", note: "want to becomes wanna in casual speech" },
  { id: "k3", written: "Did you eat yet?", heard: "Djeet yet?", note: "extreme reduction, still perfectly common" },
  { id: "k4", written: "Let me get that.", heard: "Lemme get that.", note: "let me becomes lemme" },
  { id: "k5", written: "I have to leave.", heard: "I hafta leave.", note: "have to becomes hafta, f sound" },
  { id: "k6", written: "She used to live here.", heard: "She yoostuh live here.", note: "used to reduces, final d is silent" },
  { id: "k7", written: "Give me a call.", heard: "Gimme a call.", note: "give me becomes gimme" },
  { id: "k8", written: "Do you want to come?", heard: "Dya wanna come?", note: "do you compresses into one sound" },
];
