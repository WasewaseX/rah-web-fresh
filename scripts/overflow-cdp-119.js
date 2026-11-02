// Task 119: precise mobile overflow audit via raw CDP.
// agent-browser's page size can't be set (no viewport command), so this
// drives Chrome's DevTools protocol directly: Emulation.setDeviceMetricsOverride
// gives a REAL 390x844 @2x mobile viewport, then per view:
//   - run the overflow probe (true bleeders + text-out-of-box, transform-aware)
//   - save a screenshot for the eye check.
// Usage: node scripts/overflow-cdp-119.js <ws-port> <session-token>
const fs = require("fs");
const http = require("http");

const PORT = process.argv[2] || "9231";
const TOKEN = process.argv[3] || "";
const OUT = "/tmp/overflow-119";
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = ["today", "review", "writing", "speaking", "listening", "reading", "tutor", "grammar", "sound", "placement", "arcade", "progress"];

const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const movedOff = (el) => {
    let a = el;
    while (a && a !== document.body) {
      const cs = getComputedStyle(a);
      // Tailwind v4 translate utilities emit the standalone "translate"
      // property, not "transform" - check both (the closed FAB panel).
      if ((cs.transform && cs.transform !== "none") || (cs.translate && cs.translate !== "none")) return true;
      a = a.parentElement;
    }
    return false;
  };
  const clipped = (el) => {
    let a = el.parentElement;
    while (a && a !== document.body) {
      const cs = getComputedStyle(a);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return true;
      a = a.parentElement;
    }
    return false;
  };
  const bleed = [], textbox = [];
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 2 && !clipped(el) && !movedOff(el)) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") {
        bleed.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 55), over: Math.round(r.right - vw), txt: (el.textContent || "").trim().slice(0, 40) });
      }
    }
    const txt = (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.textContent : "").trim();
    if (txt && el.scrollWidth > el.clientWidth + 3) {
      const cs = getComputedStyle(el);
      if ((/(nowrap|pre)/.test(cs.whiteSpace) || !clipped(el)) && !movedOff(el)) {
        textbox.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 55), over: el.scrollWidth - el.clientWidth, txt: txt.slice(0, 44) });
      }
    }
  });
  bleed.sort((a, b) => b.over - a.over);
  textbox.sort((a, b) => b.over - a.over);
  return JSON.stringify({ vw, hscroll: document.documentElement.scrollWidth > vw + 1, bleed: bleed.length, bleedTop: bleed.slice(0, 3), boxes: textbox.length, boxTop: textbox.slice(0, 4) });
})()`;

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        const mid = ++id;
        pending.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params }));
      }),
      close: () => ws.close(),
    });
    ws.onerror = reject;
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = await new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: PORT, path: "/json/list" }, (r) => {
      let b = "";
      r.on("data", (c) => (b += c));
      r.on("end", () => resolve(JSON.parse(b)));
    }).on("error", reject);
  });
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("no page target");
  const cdp = await connect(page.webSocketDebuggerUrl);

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Network.enable", {});
  await cdp.send("Network.setCookie", { name: "rah_session", value: TOKEN, domain: "127.0.0.1", path: "/" });

  const summary = {};
  for (const v of VIEWS) {
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:3000/#${v}` });
    await sleep(2300);
    const r = await cdp.send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
    const data = r.result?.value ? JSON.parse(r.result.value) : { error: "no probe result" };
    summary[v] = data;
    const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 62 });
    fs.writeFileSync(`${OUT}/${v}.jpg`, Buffer.from(shot.data, "base64"));
    console.log(`== ${v}: vw=${data.vw} hscroll=${data.hscroll} bleed=${data.bleed} boxes=${data.boxes}`);
    if (data.bleed > 0) console.log("   bleedTop:", JSON.stringify(data.bleedTop).slice(0, 400));
    if (data.boxes > 0) console.log("   boxTop:", JSON.stringify(data.boxTop).slice(0, 500));
  }
  fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
  console.log("done ->", OUT);
  cdp.close();
  process.exit(0);
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
