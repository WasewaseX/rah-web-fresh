// The 5-round decoding cycle from the research base:
// blind listen, diagnose, transcript, re-listen, reproduce — plus the library
// v2 comprehension check and sentence-level replay segments.
export type Phase = "pick" | "r1" | "r2" | "r3" | "r4" | "r5" | "quiz" | "end";
