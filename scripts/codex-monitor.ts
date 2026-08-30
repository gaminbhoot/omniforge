#!/usr/bin/env tsx
/**
 * Spec Monitor — runs the spec verifier against the current change set,
 *
 * Modes:
 *   --once        Run one verify pass and exit (CI-friendly: exit 1 on FAIL)
 *   --watch       Poll git for new diffs, re-verify on change (default for daemon)
 *   --skip-heavy  Skip build/lint/tests (static checks only — fast)
 *   --interval N  Poll interval in seconds (default 12)
 *   --max-rounds N  Stop after N rounds (default infinite)
 *   --json        Print JSON verdict to stdout
 *   --md          Also write markdown report
 *
 * Behavior:
 *   - Detects change provenance via branch/commit/author/env
 *   - Runs verifier (spec.ts checklist) against current diff (origin/main...HEAD or working tree)
 *   - Writes reports to tmp/codex-monitor/latest.json + verify-*.json + latest.md
 *   - Broadcasts to server's /api/verify if server is up (best-effort)
 *   - Watch mode halts on stable PASS with no new diffs for 2 consecutive rounds
 *
 * The subagent mantra: do not stop till it finishes — keep polling, keep
 * verifying, surface every FAIL with evidence + fixHint so the fix loop can self-correct.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { verify, verdictToMarkdown, verdictToJson } from "../packages/verifier/src/index.js";

const args = process.argv.slice(2);
const once = args.includes("--once");
const jsonOut = args.includes("--json");
const mdOut = args.includes("--md") || !jsonOut;
const skipHeavy = args.includes("--skip-heavy");
const watch = args.includes("--watch") || (!once && !args.includes("--once"));
const intervalSec = Number(args.find(a=>a.startsWith("--interval"))?.split("=")[1] ?? args[args.indexOf("--interval")+1] ?? 12) || 12;
const maxRoundsRaw = args.find(a=>a.startsWith("--max-rounds"))?.split("=")[1] ?? (args.includes("--max-rounds") ? args[args.indexOf("--max-rounds")+1] : undefined);
const maxRounds = maxRoundsRaw ? Number(maxRoundsRaw) : Infinity;

const OUT_DIR = join(process.cwd(), "tmp", "codex-monitor");
mkdirSync(OUT_DIR, { recursive: true });

function nowTag() { return new Date().toISOString().replace(/[:.]/g,"-"); }
function sh(cmd: string): string { try { return execSync(cmd,{encoding:"utf-8", stdio:["pipe","pipe","pipe"]}).trim(); } catch(e:any){ return (e.stdout?.toString()??"").trim(); } }

async function broadcastVerdict(verdict: any) {
  const port = process.env.PORT ?? "3001";
  const url = `http://localhost:${port}/api/verify/report`;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(verdict) });
  } catch { /* server not up — ok */ }
}

async function runOnce(round: number) {
  const headBefore = sh("git rev-parse HEAD 2>/dev/null") || "unknown";
  const diffHash = sh("git diff HEAD --stat 2>/dev/null | md5 2>/dev/null || git diff HEAD --stat 2>/dev/null | md5sum 2>/dev/null || echo none").slice(0,12);
  console.log(`\n━━━ Round ${round} — ${new Date().toISOString()} — HEAD ${headBefore.slice(0,7)} — diff:${diffHash} — ${watch?"watch":"once"} ${skipHeavy?"(static-only)":""} ━━━`);
  const verdict: any = await verify({ skipHeavy });
  verdict.round = round;
  const ts = nowTag();
  const jsonPath = join(OUT_DIR, `verify-${ts}.json`);
  const latestJson = join(OUT_DIR, "latest.json");
  const mdPath = join(OUT_DIR, `verify-${ts}.md`);
  const latestMd = join(OUT_DIR, "latest.md");

  writeFileSync(jsonPath, verdictToJson(verdict));
  writeFileSync(latestJson, verdictToJson(verdict));
  if (mdOut) {
    const md = verdictToMarkdown(verdict);
    writeFileSync(mdPath, md);
    writeFileSync(latestMd, md);
  }
  await broadcastVerdict(verdict);

  const icon = verdict.overall==="PASS" ? "[ok]" : verdict.overall==="WARN" ? "[warn]" : "[FAIL]";
  console.log(`${icon} ${verdict.overall} — ${verdict.summary}`);
  console.log(`   Source: ${verdict.source} | Files: ${verdict.filesChanged.length} | ${verdict.score.passed} pass / ${verdict.score.failed} fail / ${verdict.score.warned} warn`);
  if (verdict.filesChanged.length) console.log(`   Changed: ${verdict.filesChanged.slice(0,12).join(", ")}${verdict.filesChanged.length>12?" …":""}`);
  console.log(`   Provenance: ${verdict.provenance}`);
  console.log(`   Reports: ${latestJson}  |  ${latestMd}`);
  // verbose fails
  const fails = verdict.checks.filter((c:any)=>c.status==="fail");
  if (fails.length) {
    console.log(`\n   Fails (${fails.length}):`);
    for (const f of fails) {
      console.log(`     - [${f.severity}] ${f.label}: ${f.evidence.slice(0,220)}`);
      if (f.fixHint) console.log(`       ↳ Fix: ${f.fixHint}`);
    }
  }
  const warns = verdict.checks.filter((c:any)=>c.status==="warn");
  if (warns.length) {
    console.log(`\n   Warns (${warns.length}):`);
    for (const w of warns) console.log(`     - ${w.label}: ${w.evidence.slice(0,180)}`);
  }
  console.log(`\n   Diff stat:\n${verdict.diffStat.slice(0,800)}`);

  if (jsonOut) console.log("\n" + verdictToJson(verdict));
  return verdict;
}

async function main() {
  console.log(`Spec verifier — ${once ? "ONCE" : `WATCH every ${intervalSec}s`} — outDir: ${OUT_DIR}`);
  console.log(`   Spec: omniforge-spec-v1 | SkipHeavy: ${skipHeavy} | MaxRounds: ${Number.isFinite(maxRounds)?maxRounds:"∞"}`);
  console.log(`   Tip: provenance is detected from branch/codex-* prefixes, "codex:" commit messages, or CODEX_FIX=1`);

  let round = 1;
  let consecutivePass = 0;
  let lastHead = "";
  let lastDiffSig = "";

  while (round <= maxRounds) {
    const verdict = await runOnce(round);
    const head = verdict.head as string;
    const diffSig = `${verdict.diffStat.slice(0,300)}|${verdict.filesChanged.join(",")}`;

    // termination: do not stop till it finishes — we stop only when
    // 1) --once (single round)
    // 2) PASS and no new diff for 2 consecutive rounds (change set quiesced)
    // 3) maxRounds reached
    if (once) {
      const exitCode = verdict.overall==="FAIL" ? 1 : 0;
      console.log(`\n--once done → exit ${exitCode}`);
      process.exit(exitCode);
    }

    const isSameDiff = head===lastHead && diffSig===lastDiffSig;
    if (verdict.overall==="PASS" && isSameDiff) consecutivePass += 1;
    else if (verdict.overall==="PASS") consecutivePass = 1;
    else consecutivePass = 0;

    if (consecutivePass >= 2) {
      console.log(`\nStable PASS for ${consecutivePass} consecutive rounds with no new diff — up to spec. Monitor halting.`);
      console.log(`   Final verdict: ${verdict.id} — ${verdict.overall}`);
      process.exit(0);
    }

    lastHead = head; lastDiffSig = diffSig;

    // Also stop if no diff at all for 3 rounds on a non-agent source — nothing to monitor
    // (keeps the "do not stop till it finishes" promise when there's actual work, but avoids infinite idle)
    // We don't auto-stop on that — we keep watching; only PASS-quiescence stops.

    console.log(`\n⏳ Next check in ${intervalSec}s — round ${round+1}/${Number.isFinite(maxRounds)?maxRounds:"∞"} (consecutivePass=${consecutivePass}/2) — Ctrl+C to stop`);
    await new Promise(r=>setTimeout(r, intervalSec*1000));
    round += 1;
  }
  console.log(`\nMax rounds (${maxRounds}) reached — halting.`);
  process.exit(0);
}

main().catch(e=>{ console.error("monitor crashed:", e); process.exit(2); });
