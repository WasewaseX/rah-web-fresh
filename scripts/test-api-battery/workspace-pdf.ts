// Workspace + PDF: the coach's file deliverables - listing, sandboxed
// download, make_pdf tool guards, a REAL %PDF byte check, and the
// buildLiveContext pins that keep the coach looking at the real question.
import { BASE, check, type Ctx } from "./harness";

// ================= 5. WORKSPACE + PDF: the coach's deliverables =================
export async function workspacePdf(c: Ctx) {
  console.log("\n--- workspace routes + make_pdf tool ---");
  const api = c.api;
  const noCookie = c.noCookie;
  const cookie = c.cookie;
  const { ensureWorkspace } = await import("@/lib/coach-agent/tools");
  const wsRoot = await ensureWorkspace();
  const { writeFile: wFile } = await import("fs/promises");
  const { join } = await import("path");
  const sampleMd = "# Battery Report\n\n**B2** learner. Collocation is the weak tag.\n\n| day | reviews |\n| --- | --- |\n| Mon | 22 |\n";
  await wFile(join(wsRoot, "battery-sample.md"), sampleMd, "utf8");

  const wsAnon = await noCookie("/api/workspace");
  check(wsAnon.status === 401, "workspace list is 401 to anonymous", `status=${wsAnon.status}`);
  const wsFileAnon = await noCookie("/api/workspace/file?path=battery-sample.md");
  check(wsFileAnon.status === 401, "workspace file is 401 to anonymous", `status=${wsFileAnon.status}`);

  const wsList = await api("/api/workspace");
  check(wsList.status === 200 && wsList.body?.root === "data/coach-workspace" && Array.isArray(wsList.body?.files), "workspace list shape", JSON.stringify(wsList.body).slice(0, 150));
  check((wsList.body?.files ?? []).some((f: any) => f.path === "battery-sample.md"), "the sample file appears in the list", JSON.stringify(wsList.body?.files?.map((f: any) => f.path)));

  const wsGet = await api("/api/workspace/file?path=battery-sample.md");
  check(wsGet.status === 200 && wsGet.text === sampleMd, "workspace file downloads byte-exact", `status=${wsGet.status} len=${wsGet.text.length}`);
  const wsRaw = await fetch(`${BASE}/api/workspace/file?path=battery-sample.md`, { headers: { cookie } });
  check(wsRaw.headers.get("content-type")?.startsWith("text/markdown") === true, "markdown content-type", String(wsRaw.headers.get("content-type")));
  check(wsRaw.headers.get("content-disposition")?.startsWith("inline") === true, "inline preview by default", String(wsRaw.headers.get("content-disposition")));
  const wsDl = await fetch(`${BASE}/api/workspace/file?path=battery-sample.md&dl=1`, { headers: { cookie } });
  check(wsDl.headers.get("content-disposition")?.startsWith("attachment") === true, "dl=1 forces attachment", String(wsDl.headers.get("content-disposition")));

  const wsTraversal = await api("/api/workspace/file?path=../db/custom.db");
  check(wsTraversal.status === 400, "workspace download rejects traversal", `status=${wsTraversal.status}`);
  const wsAbs = await api("/api/workspace/file?path=" + encodeURIComponent(join(wsRoot, "battery-sample.md")));
  check(wsAbs.status === 400, "workspace download rejects absolute paths", `status=${wsAbs.status}`);
  const wsMissing = await api("/api/workspace/file?path=nope-does-not-exist.md");
  check(wsMissing.status === 404, "workspace download 404 on missing file", `status=${wsMissing.status}`);

  // make_pdf tool: real bytes, real guards
  const { toolByName } = await import("@/lib/coach-agent/tools");
  const makePdfTool = toolByName("make_pdf");
  check(Boolean(makePdfTool), "make_pdf is registered", "missing");
  const pdfRun = await makePdfTool!.run({ source_md: "battery-sample.md", out: "battery-sample.pdf" });
  check(pdfRun.ok === true, "make_pdf renders from source_md", pdfRun.summary);
  const pdfBytes = await (await import("fs/promises")).readFile(join(wsRoot, "battery-sample.pdf"));
  check(Buffer.from(pdfBytes.slice(0, 5)).toString("latin1") === "%PDF-", "make_pdf output is a real PDF (byte header)", Buffer.from(pdfBytes.slice(0, 5)).toString("latin1"));
  check(pdfBytes.length > 2000, "make_pdf output non-trivial", String(pdfBytes.length));
  const wsPdf = await fetch(`${BASE}/api/workspace/file?path=battery-sample.pdf`, { headers: { cookie } });
  check(wsPdf.headers.get("content-type") === "application/pdf", "pdf served as application/pdf", String(wsPdf.headers.get("content-type")));
  const pdfHead = Buffer.from(await wsPdf.arrayBuffer()).slice(0, 5).toString("latin1");
  check(pdfHead === "%PDF-", "downloaded pdf keeps the header over HTTP", pdfHead);

  const badOut = await makePdfTool!.run({ markdown: "# x", out: "../evil.pdf" });
  check(badOut.ok === false, "make_pdf rejects escaping out paths", badOut.summary);
  const badExt = await makePdfTool!.run({ markdown: "# x", out: "report.txt" });
  check(badExt.ok === false, "make_pdf insists on .pdf", badExt.summary);
  const badSrc = await makePdfTool!.run({ source_md: "ghost.md", out: "g.pdf" });
  check(badSrc.ok === false, "make_pdf rejects a missing source_md", badSrc.summary);

  // buildLiveContext: the coach must see the CURRENT question
  const { buildLiveContext } = await import("@/lib/coach-agent/loop");
  const baseP = { level: "B2", streak: 3, due: 10, focus: "collocation", recentTraps: ["much vs many"] };
  const ctx1 = buildLiveContext(baseP, "review", null);
  check(ctx1.includes("current_view=review") && !ctx1.includes("[current screen]"), "live context carries the view, no screen block", ctx1);
  const ctx2 = buildLiveContext(baseP, "review", { surface: "review", dir: "cloze", prompt: "She ___ the deadline.", answer: "met", choices: undefined, revealed: false });
  check(ctx2.includes("[current screen]") && ctx2.includes("She ___ the deadline.") && ctx2.includes('"answer":"met"'), "live context carries the exact question + answer", ctx2);
  const ctx3 = buildLiveContext(baseP, undefined, { typed: "x".repeat(500), tiles: ["a", "b"] });
  check(ctx3.includes('"typed":"xxxx') && !ctx3.includes("x".repeat(400)), "long fields are capped", ctx3.slice(-200));
  check(!ctx3.includes("undefined"), "empty fields are dropped (never the string undefined)", ctx3);
}
