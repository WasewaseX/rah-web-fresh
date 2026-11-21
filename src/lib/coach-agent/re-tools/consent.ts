// ---------- upload consent gate (approval REQUIRED, logged) ----------

import type { ToolArgs, ToolResult } from "../tools";

const UPLOAD_TARGETS: Record<string, { url: string; needs: string; visibility: string }> = {
  triage: {
    url: "https://tria.ge/",
    needs: "free account; some submissions wait in an approval queue (the learner's current case is doing exactly that)",
    visibility: "public submissions are visible to other researchers; private needs a paid plan",
  },
  anyrun: {
    url: "https://app.any.run/",
    needs: "free account for public submissions; Windows VM detonation in the browser",
    visibility: "public analyses are shared; keep IOCs redacted if the case is sensitive",
  },
  virustotal: {
    url: "https://www.virustotal.com/gui/home/upload",
    needs: "free account for uploads (API key is free too); GUI search by hash needs NO upload",
    visibility: "samples become available to VT researchers; use 'send to VT but hide from public' if offered",
  },
  malwarebazaar: {
    url: "https://bazaar.abuse.ch/upload/",
    needs: "free account; can submit as 'unclassified'; gives back hashes + YARA coverage",
    visibility: "shared with the abuse.ch researcher community",
  },
  yaraify: {
    url: "https://yaraify.abuse.ch/upload",
    needs: "free account; submit files or YARA rules for scanning",
    visibility: "shared with abuse.ch YARAify users",
  },
};

async function reSampleUpload(args: ToolArgs): Promise<ToolResult> {
  const target = String(args.target ?? "").trim().toLowerCase();
  const t = UPLOAD_TARGETS[target];
  if (!t) {
    return {
      ok: false,
      summary: `Unknown upload target "${target}"`,
      detail: `Supported: ${Object.keys(UPLOAD_TARGETS).join(", ")}.`,
    };
  }
  const note = String(args.note ?? "").slice(0, 300);
  if (args._probe === true) {
    // Evidence hygiene (Task 111 pattern): probes must not write. Report what
    // WOULD happen instead.
    return {
      ok: true,
      summary: `Probe dry-run: approval flow for ${target} verified, nothing logged, nothing uploaded.`,
      detail: "This run is a probe (x-rah-probe) - the consent record and browser workflow are suppressed. Re-run outside probe mode.",
    };
  }
  if (args.confirm !== true) {
    return {
      ok: false,
      summary: `CONSENT GATE - nothing uploaded, nothing authorized (${target})`,
      detail: `Uploading a sample to ${target} requires the learner's explicit approval. Ask plainly: "Do you approve uploading this sample to ${target} (${t.visibility})?" Only call this tool again with confirm=true after the learner says yes. Reminder: a HASH lookup on the same platform is passive and needs no approval - only the sample FILE is consent-gated.`,
    };
  }
  const { db } = await import("@/lib/db");
  await db.setting.upsert({
    where: { key: `re:consent:${Date.now()}` },
    update: {},
    create: { key: `re:consent:${Date.now()}`, value: JSON.stringify({ target, note, approved: true, at: new Date().toISOString() }) },
  });
  return {
    ok: true,
    summary: `Approval for ${target} recorded. The tool itself never uploads - the learner uploads the file in their own browser.`,
    detail: `Consent logged in the database (${new Date().toISOString()}). Browser workflow for ${target}:\nURL: ${t.url}\nNeeds: ${t.needs}\nVisibility: ${t.visibility}\nSteps: 1) upload the sample file, 2) wait for the report, 3) paste the report URL / key findings back here so I can fold them into the case record.\nThe sample never leaves the learner's machine until they upload it themselves.`,
  };
}

export { reSampleUpload };
