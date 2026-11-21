// The coach call behind the speaking studio (extracted from the component
// so the view stays small; same /api/asr + /api/ai wiring as before).
import { EMPTY_EV } from "./shared";

type EvShape = typeof EMPTY_EV;

type CoachIo = {
  setAiBusy: (v: boolean) => void;
  setAiErr: (v: string) => void;
  setTypedMode: (v: boolean) => void;
  setTranscript: (v: string) => void;
  setHeard: (v: string) => void;
  setEv: (v: EvShape) => void;
  promptPrompt: string;
  seconds: number;
};

export async function runCoachKind(b64: string | null, typed: string, io: CoachIo): Promise<void> {
  const { setAiBusy, setAiErr, setTypedMode, setTranscript, setHeard, setEv, promptPrompt, seconds } = io;
  setAiBusy(true);
  setAiErr("");
  try {
    let said = typed;
    if (!said && b64) {
      const r = await fetch("/api/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64 }),
      });
      const j = await r.json();
      if (!j.ok) {
        setAiErr("Transcription failed here, so type what you remember saying and the coach will work from that.");
        setTypedMode(true);
        return;
      }
      said = String(j.text ?? "");
      setTranscript(said);
    }
    if (!said.trim()) {
      setAiErr("Nothing to evaluate yet: speak first, or type what you said.");
      return;
    }
    const r2 = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "speak_eval", transcript: said, prompt: promptPrompt, seconds }),
    });
    const j2 = await r2.json();
    if (!j2.ok || !j2.eval) {
      setAiErr(j2.error ?? "The coach could not evaluate this run. Fill the plan yourself.");
      return;
    }
    setHeard(String(j2.eval.heard ?? ""));
    setEv({
      grammar: String(j2.eval.grammar ?? ""),
      vocab: String(j2.eval.vocab ?? ""),
      pron: String(j2.eval.pron ?? ""),
      awkward: String(j2.eval.awkward ?? ""),
    });
  } catch {
    setAiErr("Network hiccup on the way to the coach. Fill the plan yourself or retry.");
  } finally {
    setAiBusy(false);
  }
}
