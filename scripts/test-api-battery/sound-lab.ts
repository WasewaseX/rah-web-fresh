// SOUND LAB (review feature #2: phoneme-proxy feedback) plus the arena voice
// rep that must carry the sound report.
import { check, type Ctx } from "./harness";

// ================= 6f. SOUND LAB (review feature #2: phoneme-proxy feedback) =================
export async function soundLab(c: Ctx) {
  console.log("\n--- sound lab: deterministic sound-contrast engine ---");
  const api = c.api;
  const { diagnoseSounds } = await import("@/lib/phonemes");
  const wantThink = diagnoseSounds("I want to think about it", "I vant to tink about it");
  const wantThinkKeys = wantThink.contrasts.map((c2) => c2.key).sort();
  check(
    JSON.stringify(wantThinkKeys) === JSON.stringify(["th", "w-v"]),
    "want->vant and think->tink produce w-v and th contrasts",
    wantThinkKeys.join(","),
  );
  const vant = wantThink.contrasts.find((c2) => c2.key === "w-v");
  check(vant?.evidence[0]?.heard === "vant" && vant?.evidence[0]?.target === "want", "w-v evidence carries the real pair", JSON.stringify(vant?.evidence));
  check((vant?.drill.length ?? 0) >= 3 && Boolean(vant?.tip), "w-v contrast ships drills and a tip", `${vant?.drill.length} drills`);
  const ng = diagnoseSounds("She is singing a song", "She is sinin a song");
  check(ng.contrasts.length === 1 && ng.contrasts[0].key === "ng", "singing->sinin is one ng contrast", ng.contrasts.map((c2) => c2.key).join(","));
  const stacked = diagnoseSounds("where the station is", "vere the station is");
  check(stacked.contrasts.length === 1 && stacked.contrasts[0].key === "w-v", "where->vere claims w-v despite the stacked h-drop", stacked.contrasts.map((c2) => c2.key).join(","));
  const broder = diagnoseSounds("her brother worked", "her broder worked");
  check(broder.contrasts.length === 1 && broder.contrasts[0].key === "th", "brother->broder claims th", broder.contrasts.map((c2) => c2.key).join(","));
  const cluster = diagnoseSounds("I asked for the best seat", "I ast for the best set");
  const clusterKeys = cluster.contrasts.map((c2) => c2.key).sort();
  check(JSON.stringify(clusterKeys) === JSON.stringify(["clusters", "vowel:e-ea"]), "asked->ast + seat->set are clusters + ea vowel", clusterKeys.join(","));
  const clean = diagnoseSounds("I want to think", "I want to think");
  check(clean.contrasts.length === 0 && clean.other.length === 0, "a clean rep reports nothing (no invented feedback)", JSON.stringify(clean));
  const unknown = diagnoseSounds("he drinks much water", "he drinks plenty water");
  check(unknown.contrasts.length === 0 && unknown.other.length === 1, "an unmatchable pair stays honest in other, never a fake phoneme", JSON.stringify(unknown.other));
  const again = diagnoseSounds("I want to think about it", "I vant to tink about it");
  check(JSON.stringify(again) === JSON.stringify(wantThink), "the engine is deterministic (same input, same report)", "reports differ");
  const { tagLabel } = await import("@/lib/mistakes");
  check(tagLabel("sound_w_v") === "Sound: w vs v", "sound tag renders as a readable Sound label", tagLabel("sound_w_v"));
  check(/Sound: vowels/.test(tagLabel("sound_vowel_i_ee")), "sound vowel tag renders as a vowel label", tagLabel("sound_vowel_i_ee"));

  console.log("\n--- arena voice: the response carries the sound report ---");
  const arenaPost = await api("/api/arena/voice", { method: "POST", body: JSON.stringify({ target: "I want to think", transcript: "I vant to tink" }) });
  check(arenaPost.status === 200, "arena POST accepts a rep", arenaPost.text.slice(0, 80));
  check(Array.isArray(arenaPost.body?.sound?.contrasts) && arenaPost.body.sound.note.length > 10, "response carries the sound report with the honesty note", JSON.stringify(arenaPost.body?.sound)?.slice(0, 120));
  check(
    JSON.stringify((arenaPost.body?.sound?.contrasts ?? []).map((c2: { key: string }) => c2.key).sort()) === JSON.stringify(["th", "w-v"]),
    "arena rep surfaces both contrasts",
    JSON.stringify(arenaPost.body?.sound?.contrasts),
  );
  const arenaNoTranscript = await api("/api/arena/voice", { method: "POST", body: JSON.stringify({ target: "x" }) });
  check(arenaNoTranscript.status === 400, "arena POST still rejects an empty transcript", String(arenaNoTranscript.status));
}
