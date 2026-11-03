// Mobile overflow audit v3 - TRUE 390px via CDP Emulation.setDeviceMetricsOverride.
// Run: bun scripts/overflow-audit-390.ts
// Why v3: headless=new (Chrome 143) clamps --window-size to a 500px minimum,
// so the 119/119b audits silently measured ~500px. This script pins the
// viewport at the DevTools-protocol level (390x844, mobile, dsf=2 like an
// Android mid-range), then runs the SAME two-signal probe as 119b per view:
//   (1) viewport bleeders (right edge past viewport, no clipping ancestor)
//   (2) text escaping its box (scrollWidth > clientWidth, unclipped)
// PASS = no horizontal scroll AND zero bleeders AND zero text-box escapes.
// Requires a running Chrome with --remote-debugging-port (any window size).

const CDP_PORT = process.env.CDP_PORT ?? "9252";
const BASE = "http://127.0.0.1:3000";
const WIDTH = 390, HEIGHT = 844;

const VIEWS = ["today", "review", "writing", "speaking", "listening", "reading", "tutor", "grammar", "sound", "placement", "arcade", "progress"];

// Same probe logic as scripts/overflow-audit-119b.sh (kept in sync on purpose).
const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const clipped = (el) => {
    let a = el.parentElement;
    while (a && a !== document.body) {
      const cs = getComputedStyle(a);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return true;
      a = a.parentElement;
    }
    return false;
  };
  // Parked fixed ancestor: slide-in drawers sit at translate(100%) when
  // closed - their children are one viewport width off-screen BY DESIGN.
  // They are not viewport bleeders unless the fixed ancestor itself
  // intersects the visible viewport (then a child poking out IS one).
  const parkedFixed = (el) => {
    let a = el.parentElement;
    const r = el.getBoundingClientRect();
    while (a && a !== document.body) {
      const cs = getComputedStyle(a);
      if (cs.position === "fixed") {
        const ar = a.getBoundingClientRect();
        if (ar.right <= 2 || ar.left >= vw - 2) return true;
      }
      a = a.parentElement;
    }
    return false;
  };
  const bleed = [], textbox = [];
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 2 && !clipped(el) && !parkedFixed(el)) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") {
        bleed.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), over: Math.round(r.right - vw), txt: (el.textContent || "").trim().slice(0, 34) });
      }
    }
    const txt = (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.textContent : "").trim();
    if (txt && el.scrollWidth > el.clientWidth + 3) {
      const cs = getComputedStyle(el);
      if (/(nowrap|pre)/.test(cs.whiteSpace) || !clipped(el)) {
        textbox.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), over: el.scrollWidth - el.clientWidth, txt: txt.slice(0, 40) });
      }
    }
  });
  bleed.sort((a, b) => b.over - a.over);
  textbox.sort((a, b) => b.over - a.over);
  return JSON.stringify({ vw, hscroll: document.documentElement.scrollWidth > vw + 1, bleed: bleed.length, bleedTop: bleed.slice(0, 2), boxes: textbox.length, boxTop: textbox.slice(0, 2) });
})()`;

type Msg = { id?: number; method?: string; params?: any; result?: any };

type ProbeResult = {
  vw: number; hscroll: boolean; bleed: number; boxes: number;
  bleedTop: { tag: string; cls: string; over: number; txt: string }[];
  boxTop: { tag: string; cls: string; over: number; txt: string }[];
};

async function main() {
  // Access code -> session cookie (server-side fetch; the browser never sees it).
  const { readFileSync } = await import("fs");
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const code = (env.match(/^RAH_ACCESS_CODE=(.*)$/m)?.[1] ?? "").replace(/"/g, "");
  const vres = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "geministudent@atomicmail.io", code }),
  });
  const cookie = (vres.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie.startsWith("rah_session=")) throw new Error("auth failed - no session cookie");

  const targets: { webSocketDebuggerUrl: string; type: string }[] = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("no page target on CDP");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let seq = 0;
  const pending = new Map<number, (v: any) => void>();
  const events: { method: string; params: any }[] = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data)) as Msg;
    if (m.id && pending.has(m.id)) { pending.get(m.id)!(m.result); pending.delete(m.id); }
    else if (m.method) events.push({ method: m.method, params: m.params });
  };
  const send = (method: string, params: any = {}): Promise<any> =>
    new Promise((res) => { seq += 1; pending.set(seq, res); ws.send(JSON.stringify({ id: seq, method, params })); });
  const waitEvent = async (method: string, timeoutMs = 15000): Promise<any> => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const i = events.findIndex((e) => e.method === method);
      if (i >= 0) return events.splice(i, 1)[0].params;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  // THE point of v3: pin the viewport at the protocol level.
  await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true });
  await send("Network.setCookie", { name: "rah_session", value: cookie.slice("rah_session=".length), url: BASE });

  let pass = 0, fail = 0;
  const failures: string[] = [];
  for (const v of VIEWS) {
    events.length = 0;
    await send("Page.navigate", { url: `${BASE}/#${v}` });
    await waitEvent("Page.loadEventFired");
    await new Promise((r) => setTimeout(r, 2500)); // let animations/mounts settle
    const r = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
    const j = JSON.parse(r?.result?.value ?? "{}") as ProbeResult;
    const bad = j.vw !== WIDTH || j.hscroll || j.bleed > 0 || j.boxes > 0;
    if (bad) fail++; else pass++;
    const line = `#${v.padEnd(10)} ${bad ? "FAIL" : "PASS"}  vw=${j.vw} hscroll=${j.hscroll} bleed=${j.bleed} boxes=${j.boxes}`;
    console.log(line);
    if (bad) {
      failures.push(line);
      for (const b of j.bleedTop ?? []) console.log(`    bleeder <${b.tag} class="${b.cls}"> +${b.over}px "${b.txt}"`);
      for (const b of j.boxTop ?? []) console.log(`    textbox <${b.tag} class="${b.cls}"> +${b.over}px "${b.txt}"`);
    }
  }

  // Drawer-OPEN case: the coach panel covers the viewport at <640px (w-full).
  // Open it on #today and re-probe - children poking out of the OPEN panel
  // would be real bleeders (the parked panel is excluded by parkedFixed).
  events.length = 0;
  await send("Page.navigate", { url: `${BASE}/#today` });
  await waitEvent("Page.loadEventFired");
  await new Promise((r) => setTimeout(r, 2000));
  await send("Runtime.evaluate", { expression: `(() => { const b = document.querySelector("button.fixed.right-4.bottom-20") || document.querySelector("button[class*='bottom-20']"); if (b) b.click(); return Boolean(b); })()`, returnByValue: true });
  await new Promise((r) => setTimeout(r, 800)); // slide-in transition
  const ro = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  const jo = JSON.parse(ro?.result?.value ?? "{}") as ProbeResult;
  const badOpen = jo.vw !== WIDTH || jo.hscroll || jo.bleed > 0 || jo.boxes > 0;
  if (badOpen) fail++; else pass++;
  console.log(`#${"today+drawer"} ${badOpen ? "FAIL" : "PASS"}  vw=${jo.vw} hscroll=${jo.hscroll} bleed=${jo.bleed} boxes=${jo.boxes}`);
  if (badOpen) {
    failures.push("today+drawer");
    for (const b of jo.bleedTop ?? []) console.log(`    bleeder <${b.tag} class="${b.cls}"> +${b.over}px "${b.txt}"`);
    for (const b of jo.boxTop ?? []) console.log(`    textbox <${b.tag} class="${b.cls}"> +${b.over}px "${b.txt}"`);
  }
  ws.close();
  console.log(`\noverflow-390: ${pass} pass, ${fail} fail (viewport pinned at ${WIDTH}x${HEIGHT} via CDP)`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("audit crashed:", e); process.exit(1); });
