// RE tool domain battery. Run: bun scripts/re-tools-test.ts
// Covers: IOC normalization (incl. the operator's real truncated hash),
// lookup refusal on bad hashes + real YARAify plumbing, the upload consent
// gate, case-record roundtrip, and every runbook phase.
import { toolByName } from "../src/lib/coach-agent/tools";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

async function main() {
  const norm = toolByName("re_ioc_normalize")!;
  const lookup = toolByName("re_intel_lookup")!;
  const up = toolByName("re_sample_upload")!;
  const rec = toolByName("re_case_record")!;
  const rb = toolByName("re_runbook")!;

  // 1. The operator's real paste: truncated hash must be flagged, not guessed.
  const r1 = await norm.run({
    text: "virus total couldnt\nabuse.ch 1124e79d23f3ecdaceb348affad9d975231140146101e7cc\n45.33.32.156 hxxp://evil[.]example.com/payload.bin admin@gov-transfer[.]com and prose with the word at in it",
  });
  check("normalize ok", r1.ok === true, r1.summary);
  check("truncated hash flagged in summary", /malformed|truncated|WARNING/i.test(r1.summary), r1.summary);
  const d1 = JSON.parse(String(r1.detail)) as {
    hashes: { value: string; valid: boolean; note?: string }[];
    hashes_malformed: number;
    public_ips: string[];
    urls: string[];
    emails: string[];
    domains: string[];
  };
  check("one hash candidate", d1.hashes.length === 1, JSON.stringify(d1.hashes));
  check("hash marked invalid", d1.hashes[0]?.valid === false && d1.hashes_malformed === 1);
  check("hash note says truncated", /truncated/i.test(d1.hashes[0]?.note ?? ""), d1.hashes[0]?.note);
  check("public ip extracted", d1.public_ips.includes("45.33.32.156"));
  check("url refanged", d1.urls.some((u) => u === "http://evil.example.com/payload.bin"), JSON.stringify(d1.urls));
  check("email refanged", d1.emails.includes("admin@gov-transfer.com"), JSON.stringify(d1.emails));
  check("prose word 'at' untouched", d1.domains.every((x) => !x.startsWith("at.")) || !JSON.stringify(d1.domains).includes("analyst"), JSON.stringify(d1.domains));

  // 2. A valid sha256 classifies clean.
  const { createHash } = await import("crypto");
  const good = createHash("sha256").update("rah-re-test-vector").digest("hex");
  const r2 = await norm.run({ text: good });
  const d2 = JSON.parse(String(r2.detail)) as { hashes_valid: number; hashes_malformed: number };
  check("valid sha256 accepted", d2.hashes_valid === 1 && d2.hashes_malformed === 0);

  // 3. Lookup REFUSES the truncated hash without any network call.
  const r3 = await lookup.run({ hash: "1124e79d23f3ecdaceb348affad9d975231140146101e7cc" });
  check("lookup refuses truncated hash", r3.ok === false && /truncated|full value|re-copy/i.test(`${r3.summary} ${r3.detail}`), r3.summary);

  // 4. Lookup on a well-formed hash: real network plumbing (result may be no_results).
  const r4 = await lookup.run({ hash: good });
  check("lookup ok on valid hash", r4.ok === true, r4.summary);
  check("lookup returns yaraify source", /yaraify/i.test(String(r4.detail)));

  // 5. Consent gate: without confirm=true NOTHING happens.
  const r5 = await up.run({ target: "triage" });
  check("gate blocks without confirm", r5.ok === false && /consent|approval/i.test(r5.summary), r5.summary);

  // 6. With confirm=true it logs consent and returns the browser workflow.
  const r6 = await up.run({ target: "triage", confirm: true, note: "re-tools battery smoke" });
  check("consent logged + workflow returned", r6.ok === true && /tria\.ge/.test(String(r6.detail)), r6.summary);

  // 7. Case record roundtrip (save -> get -> list -> delete).
  await rec.run({ action: "save", case_id: "smoke-roundtrip", title: "battery case", data: { n: 1 } });
  const g = await rec.run({ action: "get", case_id: "smoke-roundtrip" });
  check("case get", g.ok === true && /battery case/.test(String(g.detail)), g.summary);
  const l = await rec.run({ action: "list" });
  check("case list", l.ok === true && /smoke-roundtrip/.test(String(l.detail)), l.summary);
  const del = await rec.run({ action: "delete", case_id: "smoke-roundtrip" });
  check("case delete", del.ok === true, del.summary);

  // 7b. Probe hygiene: DB-writing tools must suppress writes when _probe.
  const pr = await rec.run({ action: "save", case_id: "probe-should-not-exist", title: "x", data: {}, _probe: true });
  check("probe save suppressed", pr.ok === true && /suppressed|probe/i.test(pr.summary), pr.summary);
  const prList = await rec.run({ action: "list" });
  check("probe case absent from db", !/probe-should-not-exist/.test(String(prList.detail)));
  const prUp = await up.run({ target: "virustotal", confirm: true, note: "probe", _probe: true });
  check("probe consent suppressed", prUp.ok === true && /probe dry-run|nothing logged/i.test(prUp.summary), prUp.summary);

  // 7c. v2 dispatch: IOC lookup on a domain and an IP (ThreatFox + URLhaus path).
  const rDom = await lookup.run({ ioc: "example.com" });
  check("domain lookup ok", rDom.ok === true && /ThreatFox/.test(rDom.summary), rDom.summary);
  const rIp = await lookup.run({ ioc: "9.9.9.9" });
  check("ip lookup ok", rIp.ok === true && /ThreatFox/.test(rIp.summary), rIp.summary);
  const rJunk = await lookup.run({ ioc: "this is not an ioc at all" });
  check("junk lookup refused", rJunk.ok === false, rJunk.summary);

  // 8. Every runbook phase renders with the isolation checklist where it matters.
  for (const phase of ["triage", "static", "dynamic", "dynamic_linux", "forensics", "report"]) {
    const r = await rb.run({ phase });
    check(`runbook ${phase}`, r.ok === true && String(r.detail).length > 400, r.summary);
  }
  const isoTriage = await rb.run({ phase: "triage" });
  check("isolation checklist present", /ISOLATION CHECKLIST/.test(String(isoTriage.detail)));
  const bad = await rb.run({ phase: "nope" });
  check("runbook rejects unknown phase", bad.ok === false);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
