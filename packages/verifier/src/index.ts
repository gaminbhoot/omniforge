/**
 * Verifier engine — runs all spec checks against a Codex diff.
 * Usage:
 *   import { verify } from "./index.js";
 *   const verdict = await verify(); // auto-detects diff
 *   // or
 *   const verdict = await verify({ diff, stat, nameOnly, source });
 */
import { SPEC, type CheckResult, type Verdict } from "./spec.js";
import { getDiffInfo, type DiffInfo } from "./git.js";
import {
  checkBuild, checkLint, checkTests,
  checkHitlIntegrity, checkNoBypass, checkSandboxIsolation,
  checkArchLayers, checkMcpContract, checkSecrets, checkSandboxContract
} from "./checks/index.js";

export type VerifyOpts = Partial<DiffInfo> & { skipHeavy?: boolean };

export async function verify(opts: VerifyOpts = {}): Promise<Verdict> {
  const auto = getDiffInfo();
  const diff = opts.diff ?? auto.diff;
  const stat = opts.stat ?? auto.stat;
  const nameOnly = opts.nameOnly ?? auto.nameOnly;
  const source = (opts.source ?? auto.source) as Verdict["source"];
  const base = opts.base ?? auto.base;
  const head = opts.head ?? auto.head;
  const evidence = opts.evidence ?? auto.evidence;
  const id = `verdict_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const timestamp = new Date().toISOString();

  // Fast static checks (always)
  const staticChecks: CheckResult[] = [
    checkHitlIntegrity(diff),
    checkNoBypass(diff),
    checkSandboxIsolation(diff),
    checkArchLayers(diff),
    checkMcpContract(diff),
    checkSecrets(diff, nameOnly),
    checkSandboxContract(diff),
  ];

  // Heavy checks (build/lint/tests) — skip if no code files changed or skipHeavy flag
  const codeFiles = nameOnly.filter(f => /\.(ts|tsx|js|jsx|py)$/.test(f));
  const shouldRunHeavy = !opts.skipHeavy && codeFiles.length > 0;
  let heavy: CheckResult[] = [];
  if (shouldRunHeavy) {
    // run sequentially to avoid interleaved npm output corruption
    heavy = [
      checkBuild(),
      checkLint(),
      checkTests(),
    ];
  } else {
    const skip = (id: string, label: string, ref: string): CheckResult => ({
      id, label, status: "skip", severity: "medium", specRef: ref, evidence: "skipped — no code files in diff or --skip-heavy", durationMs: 0
    });
    heavy = [
      skip("build","TypeScript build (tsc -b) passes","CI:test_ci.yml"),
      skip("lint","ESLint passes","CI:test_ci.yml"),
      skip("tests","Tests pass","CI:test_ci.yml"),
    ];
  }

  const checks: CheckResult[] = [...staticChecks, ...heavy];
  // reorder to SPEC order
  const order = new Map(SPEC.checks.map((c,i)=>[c.id,i]));
  checks.sort((a,b)=> (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

  const passed = checks.filter(c=>c.status==="pass").length;
  const failed = checks.filter(c=>c.status==="fail").length;
  const warned = checks.filter(c=>c.status==="warn").length;
  const skipped = checks.filter(c=>c.status==="skip").length;
  const hasCriticalFail = checks.some(c=>c.status==="fail" && c.severity==="critical");
  const hasAnyFail = failed > 0;
  const overall: Verdict["overall"] = hasCriticalFail || hasAnyFail ? "FAIL" : warned>0 ? "WARN" : "PASS";

  const summary = overall==="PASS"
    ? `PASS — all checks passed — code is up to spec (${passed}/${checks.length})`
    : overall==="WARN"
    ? `WARN — passed with warnings; review ${warned} warn(s), 0 fails`
    : `FAIL — ${failed} check(s) failed${hasCriticalFail ? " (incl. critical)" : ""} — fix not up to spec`;

  const verdict: Verdict = {
    id, timestamp, source, base, head,
    filesChanged: nameOnly,
    diffStat: stat,
    overall, score: { passed, failed, warned, skipped, total: checks.length },
    checks, summary,
  };
  // attach provenance evidence as first check's evidence prefix (for UI)
  (verdict as any).provenance = evidence;
  (verdict as any).diffPreview = diff.slice(0, 8000);
  return verdict;
}

export function verdictToMarkdown(v: Verdict): string {
  const badge = v.overall==="PASS" ? "PASS" : v.overall==="WARN" ? "WARN" : "FAIL";
  const lines: string[] = [];
  lines.push(`# ${badge} — Codex fix verdict \`${v.id}\``);
  lines.push(`**Source:** ${v.source} | **When:** ${v.timestamp} | **Base:** \`${v.base.slice(0,7)}\` → **Head:** \`${v.head.slice(0,7)}\``);
  lines.push(`**Provenance:** ${(v as any).provenance} | **Files:** ${v.filesChanged.length} | **Score:** ${v.score.passed} pass / ${v.score.failed} fail / ${v.score.warned} warn / ${v.score.skipped} skip`);
  lines.push(`> ${v.summary}`);
  lines.push("");
  lines.push("```");
  lines.push(v.diffStat.slice(0, 2000));
  lines.push("```");
  lines.push("");
  lines.push("| Check | Severity | Status | Evidence |");
  lines.push("|---|---|---|---|");
  for (const c of v.checks) {
    const icon = c.status==="pass" ? "[ok]" : c.status==="fail" ? "[FAIL]" : c.status==="warn" ? "[warn]" : "[skip]";
    const ev = c.evidence.replace(/\|/g,"/").replace(/\n/g," ").slice(0,180);
    lines.push(`| ${c.label} | ${c.severity} | ${icon} ${c.status} | ${ev} |`);
  }
  lines.push("");
  lines.push("## Spec refs");
  for (const c of v.checks) lines.push(`- **${c.id}**: ${c.specRef}${c.fixHint ? ` — _Fix: ${c.fixHint}_` : ""}`);
  return lines.join("\n");
}

export function verdictToJson(v: Verdict): string { return JSON.stringify(v, null, 2); }
