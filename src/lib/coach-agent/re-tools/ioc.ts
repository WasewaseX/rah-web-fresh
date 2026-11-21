// ---------- IOC normalization (pure, no network) ----------

import type { ToolArgs, ToolResult } from "../tools";

export interface HashInfo {
  value: string;
  kind: string;
  valid: boolean;
  note?: string;
}

export function classifyHex(h: string): HashInfo {
  const len = h.length;
  if (len === 32) return { value: h, kind: "md5", valid: true };
  if (len === 40) return { kind: "sha1", value: h, valid: true };
  if (len === 64) return { value: h, kind: "sha256", valid: true };
  return {
    value: h,
    kind: `nonstandard`,
    valid: false,
    note: `${len} hex chars - NOT md5(32)/sha1(40)/sha256(64). Almost certainly truncated or corrupted on copy; a real lookup is impossible with it. Ask for the full value.`,
  };
}

function refang(s: string): string {
  return s
    .replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]|\(dot\)/gi, ".")
    .replace(/\[\s*at\s*\]|\(\s*at\s*\)/gi, "@")
    .replace(/\[:\]|\(:\)/g, ":")
    .replace(/h(?:x{2})p(s?):\/\//gi, (_m, s2) => (s2 ? "https://" : "http://"))
    .replace(/\[\/\]|\(\/\)/g, "/");
}

function isPublicIpv4(ip: string): { ip: string; public: boolean; why: string } {
  const p = ip.split(".").map(Number);
  const why =
    p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168)
      ? "RFC1918 private"
      : p[0] === 127
        ? "loopback"
        : p[0] === 169 && p[1] === 254
          ? "link-local"
          : p[0] === 0 || p[0] >= 224
            ? "reserved/multicast"
            : "public";
  return { ip, public: why === "public", why };
}

export function normalizeIocs(rawText: string): Record<string, unknown> {
  const text = rawText ?? "";
  const ref = refang(text);

  const hashes: HashInfo[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/\b[0-9a-f]{16,128}\b/gi)) {
    const v = m[0].toLowerCase();
    if (seen.has(v)) continue;
    seen.add(v);
    hashes.push(classifyHex(v));
  }

  const ips: { ip: string; public: boolean; why: string }[] = [];
  const ipSeen = new Set<string>();
  for (const m of ref.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) {
    const ip = m[0];
    if (ipSeen.has(ip) || ip.split(".").some((o) => Number(o) > 255)) continue;
    ipSeen.add(ip);
    ips.push(isPublicIpv4(ip));
  }

  const urls = [...new Set(ref.matchAll(/\bhttps?:\/\/[^\s"'<>)]+/gi).map((m) => m[0].replace(/[.,;]+$/, "")))].slice(0, 40);

  const emails = [...new Set(ref.matchAll(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g).map((m) => m[0]))].slice(0, 20);

  // Domains outside URL/IP/email matches, so the same artifact is not listed 3x.
  const inUrls = urls.join(" ");
  const inEmails = emails.join(" ");
  const domains: string[] = [];
  for (const m of ref.matchAll(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,12}\b/gi)) {
    const d = m[0].toLowerCase();
    if (domains.includes(d) || inUrls.includes(d) || inEmails.includes(d)) continue;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(d)) continue; // ipv4 already captured
    if (/\.(png|jpe?g|gif|md|txt|zip|pdf|exe|dll|bin|dat|so|sys)$/i.test(d)) continue; // file names, not network artifacts
    domains.push(d);
  }

  const regKeys = [...new Set(text.matchAll(/\b(?:HKEY_[A-Z_]+|HKLM|HKCU|HKCR|HKU)\\[^\s"',;)]+/g).map((m) => m[0]))].slice(0, 20);

  return {
    hashes,
    hashes_valid: hashes.filter((h) => h.valid).length,
    hashes_malformed: hashes.filter((h) => !h.valid).length,
    ips,
    public_ips: ips.filter((i) => i.public).map((i) => i.ip),
    domains: domains.slice(0, 40),
    urls,
    emails,
    registry_keys: regKeys,
    counts: {
      hashes: hashes.length,
      ips: ips.length,
      domains: domains.length,
      urls: urls.length,
      emails: emails.length,
      registry_keys: regKeys.length,
    },
  };
}

async function reIocNormalize(args: ToolArgs): Promise<ToolResult> {
  const text = typeof args.text === "string" ? args.text : JSON.stringify(args.iocs ?? {});
  if (!text.trim()) return { ok: false, summary: "re_ioc_normalize needs text to scan (paste hashes, IPs, URLs, notes)" };
  const out = normalizeIocs(text);
  const c = out.counts as Record<string, number>;
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const warn = out.hashes_malformed ? ` WARNING: ${out.hashes_malformed} malformed hash(es) - truncated values cannot be looked up` : "";
  return {
    ok: true,
    summary: `Normalized ${total} IOC(s): ${c.hashes} hash, ${c.ips} IP, ${c.domains} domain, ${c.urls} URL.${warn}`,
    detail: JSON.stringify(out, null, 1).slice(0, 4000),
  };
}

export { reIocNormalize };
