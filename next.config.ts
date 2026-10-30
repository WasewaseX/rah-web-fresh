import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Task 102 (release-asset leak): outputFileTracing copied EVERYTHING the
  // server code ever referenced at runtime - db/ (learner SQLite snapshots +
  // db/vault-work with github-tokens.md), scripts/, upload/ (incl. the env
  // backup) - INTO .next/standalone with their build-time contents, and the
  // preserved artifact tarred all of it onto a PUBLIC release asset. These
  // excludes cut the leak at the source; build-prod.sh additionally packs
  // via an allowlist and scripts/artifact-secret-gate.sh hard-fails any
  // artifact that still contains non-runtime paths or secret patterns.
  outputFileTracingExcludes: {
    "*": [
      "./db/**",
      "./scripts/**",
      "./skills/**",
      "./upload/**",
      "./download/**",
      "./tool-results/**",
      "./examples/**",
      "./tests/**",
      "./backups/**",
      "./docs/**",
      "./.env",
      "./.env.*",
      "./*.log",
      "./*.md",
    ],
  },
  // Task 89 (HTTP layer): gzip text responses from the Next server itself -
  // the preview gateway's Caddy only reverse-proxies, it does not encode.
  compress: true,
  // Do not advertise the framework version on every response.
  poweredByHeader: false,
  // Task 90 (cache policy): the static renderer pins the HTML shell with
  // `s-maxage=31536000` by default. Our shell references hash-named chunks
  // that every rebuild DELETES - a proxy honoring that header would serve a
  // stale shell whose JS 404s (blank page) after any deploy. The shell must
  // revalidate per navigation (ETag keeps a matching build at 304-cost),
  // and every API is user-scoped dynamic data - explicit no-store.
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  // Test isolation (audit P1-10): a second dev server for the test toolchain
  // can boot alongside the real one when it gets its own dist dir - otherwise
  // Turbopack locks .next/dev/lock and refuses. NEXT_DIST_DIR is set ONLY by
  // the isolated battery runner; normal dev/build never see it.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
