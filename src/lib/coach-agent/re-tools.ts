// RE tool domain: browser-first malware analysis / reverse-engineering support.
// Policy baked into code (operator's red lines, 2026-11-03):
//   1. Browser-first: hash lookups + remote detonation platforms before any
//      local download. This module only ever transmits HASHES to intel APIs.
//   2. The sample is NEVER executed by this app, and no tool here accepts or
//      handles sample binaries. Local execution is the operator's job inside
//      an isolated VM (runbooks in re_runbook always repeat the checklist).
//   3. Uploading a sample to a third-party service requires the learner's
//      explicit approval - re_sample_upload refuses without it and logs the
//      consent when it is given. Nothing here performs an upload itself.
//   4. Findings come only from real API responses; empty results are reported
//      as empty, never dressed up as conclusions.
// Type-only import keeps the tools.ts <-> re-tools.ts edge acyclic at runtime.
//
// The implementations live in sibling modules under re-tools/ (topic files);
// this entry is the public surface - it re-exports every name this module
// exported before, so tools/registry.ts keeps its exact import path.

export { classifyHex, normalizeIocs } from "./re-tools/ioc";
export { RE_TOOL_TIERS, RE_TOOLS } from "./re-tools/registry";
