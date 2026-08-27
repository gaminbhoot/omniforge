/**
 * Check implementations — each returns a CheckResult.
 * Keep them fast; worst-case each < 30s. Time-box via timeout where needed.
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import type { CheckResult } from "../spec.js";

function timed<T>(fn: () => T): { value: T; ms: number } {
  const t0 = Date.now();
  const value = fn();
  return { value, ms: Date.now() - t0 };
}

function sh(cmd: string, timeoutMs = 60000): { ok: boolean; out: string; code: number } {
  try {
    const out = execSync(cmd, { encoding: "utf-8", stdio: "pipe", timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
    return { ok: true, out: String(out).slice(0, 6000), code: 0 };
  } catch (e: any) {
    const out = String(e.stdout ?? e.stderr ?? e.message ?? "").slice(0, 6000);
    return { ok: false, out, code: e.status ?? 1 };
  }
}

function fileContains(path: string, re: RegExp): boolean {
  try { return re.test(readFileSync(path, "utf-8")); } catch { return false; }
}
function grepDiff(diff: string, re: RegExp): boolean { return re.test(diff); }
function grepRepo(pattern: RegExp, globs: string[]): string[] {
  const hits: string[] = [];
  for (const g of globs) {
    try {
      const out = execSync(`grep -r -n -E ${JSON.stringify(pattern.source)} ${g} 2>/dev/null | head -n 20`, { encoding: "utf-8" });
      if (out.trim()) hits.push(out.trim());
    } catch {}
  }
  return hits;
}

// ── build / lint / tests ──────────────────────────────────────────
export function checkBuild(): CheckResult {
  const { value: r, ms } = timed(() => sh("npm run build --if-present 2>&1", 120000));
  const pass = r.ok;
  return {
    id: "build", label: "TypeScript build (tsc -b) passes", status: pass ? "pass" : "fail", severity: "critical",
    specRef: "CI:test_ci.yml / package.json:build", evidence: r.out.slice(0, 2000) || "(no output)", durationMs: ms,
    fixHint: pass ? undefined : "Run `npm run build` locally; fix type errors; ensure strict:true passes",
  };
}
export function checkLint(): CheckResult {
  const { value: r, ms } = timed(() => sh("npm run lint 2>&1 || npx eslint . --ext .ts,.tsx 2>&1", 90000));
  // eslint exits 1 on lint errors, 0 on clean. Warnings still exit 0 unless --max-warnings 0
  const hasError = /error/i.test(r.out) && !r.ok;
  const warnOnly = /warning/i.test(r.out) && r.ok;
  return {
    id: "lint", label: "ESLint passes (no errors)", status: hasError ? "fail" : warnOnly ? "warn" : "pass", severity: "high",
    specRef: "CI:test_ci.yml / .eslintrc.cjs", evidence: r.out.slice(0, 2500) || "(no output)", durationMs: ms,
    fixHint: hasError ? "Run `npm run lint -- --fix` and `npm run format`" : undefined,
  };
}
export function checkTests(): CheckResult {
  const { value: r, ms } = timed(() => sh("npm run test --if-present 2>&1 || npm run test:all 2>&1", 120000));
  // Heuristic: if no tests yet, don't fail — warn
  const noTests = /No test files found|no tests/i.test(r.out);
  if (noTests) return { id: "tests", label: "Tests pass (vitest)", status: "warn", severity: "critical", specRef: "CI:test_ci.yml", evidence: "No tests found — not failing, but Q Branch needs coverage", durationMs: ms, fixHint: "Add vitest coverage for patched code (see Qodo)" };
  return {
    id: "tests", label: "Tests pass (vitest)", status: r.ok ? "pass" : "fail", severity: "critical",
    specRef: "CI:test_ci.yml / Q Branch", evidence: r.out.slice(0, 3000), durationMs: ms,
    fixHint: r.ok ? undefined : "Failing tests = regression. Fix patch or add missing mocks.",
  };
}

// ── HITL integrity ────────────────────────────────────────────────
export function checkHitlIntegrity(diff: string): CheckResult {
  const t0 = Date.now();
  const evidence: string[] = [];
  let status: CheckResult["status"] = "pass";
  let hint: string | undefined;

  // 1. evaluate() still gates CRITICAL/HIGH
  const hitlPath = "apps/server/src/policies/hitl.ts";
  if (existsSync(hitlPath)) {
    const src = readFileSync(hitlPath, "utf-8");
    const hasCriticalGate = src.includes("CRITICAL") && src.includes("requiresApproval");
    const hasEvaluate = src.includes("function evaluate");
    if (!hasCriticalGate || !hasEvaluate) { status = "fail"; evidence.push("hitl.ts missing CRITICAL gate or evaluate()"); }
    else evidence.push("hitl.ts: CRITICAL→approval gate present");
    // Check diff doesn't weaken it
    if (grepDiff(diff, /requiresApproval:\s*false/) && grepDiff(diff, /CRITICAL|HIGH/)) {
      status = "fail"; evidence.push("DIFF weakens approval: CRITICAL/HIGH set to requiresApproval:false"); hint = "Revert: CRITICAL/HIGH must stay requiresApproval:true (ARCH:§ HITL Matrix)";
    }
    if (grepDiff(diff, /evaluate\s*\(/ ) && grepDiff(diff, /return\s*\{\s*rule.*requiresApproval:\s*false/)) {
      status = "fail"; evidence.push("DIFF bypasses evaluate() to auto-approve");
    }
  } else { evidence.push("hitl.ts not found — cannot verify gate"); status = "warn"; }

  // 2. orchestrator still calls evaluate()
  const orchPath = "apps/server/src/orchestrator.ts";
  if (existsSync(orchPath)) {
    const src = readFileSync(orchPath, "utf-8");
    if (!src.includes("evaluate(")) { status = "fail"; evidence.push("orchestrator.ts no longer calls evaluate() — HITL bypass"); hint = "Restore proposeTool → evaluate() → needsApproval branch"; }
    else evidence.push("orchestrator.ts: proposeTool → evaluate() intact");
  }

  return { id: "hitl-integrity", label: "HITL gate integrity intact", status, severity: "critical", specRef: "ARCH:§ HITL Gate Matrix / policies/hitl.ts", evidence: evidence.join(" | ").slice(0, 3000), durationMs: Date.now() - t0, fixHint: hint };
}

export function checkNoBypass(diff: string): CheckResult {
  const t0 = Date.now();
  const patterns: Array<[RegExp, string]> = [
    [/approved\s*:\s*true.*CRITICAL/i, "hard-coded approved:true near CRITICAL"],
    [/needsApproval\s*=\s*false/i, "needsApproval forced false"],
    [/evaluate\s*\(\s*\)\s*{\s*return.*false/i, "evaluate() stubbed to bypass"],
    [/proposeTool.*approval.*false/i, "proposeTool approval bypass"],
    [/\bskipHitl\b|\bbypassHitl\b/i, "explicit bypass flag"],
  ];
  const hits: string[] = [];
  for (const [re, desc] of patterns) if (grepDiff(diff, re)) hits.push(desc);
  // also scan repo for new bypass helpers
  if (existsSync("apps/server/src")) {
    const repoHits = grepRepo(/skipHitl|bypass.*hitl|forceApprove/i, ["apps/server/src"]);
    if (repoHits.length) hits.push(...repoHits.map(s => `repo: ${s.slice(0,120)}`));
  }
  return {
    id: "no-bypass", label: "No approval-bypass patterns", status: hits.length ? "fail" : "pass", severity: "critical",
    specRef: "ARCH:§ HITL + orchestrator.ts", evidence: hits.length ? hits.join(" | ").slice(0, 3000) : "No bypass patterns in diff", durationMs: Date.now() - t0,
    fixHint: hits.length ? "Remove bypass; CRITICAL/HIGH must go through ApprovalRequest → human 1-click" : undefined,
  };
}

export function checkSandboxIsolation(diff: string): CheckResult {
  const t0 = Date.now();
  const evidence: string[] = [];
  let status: CheckResult["status"] = "pass";
  // MEDIUM should be sandbox only — check policy still says so
  const hitlSrc = existsSync("apps/server/src/policies/hitl.ts") ? readFileSync("apps/server/src/policies/hitl.ts","utf-8") : "";
  if (hitlSrc && !hitlSrc.includes('executionMode: "sandbox"')) { status = "warn"; evidence.push("hitl.ts missing sandbox executionMode for MEDIUM"); }

  // Dangerous: raw child_process / exec outside sandboxExec
  const dangerous = [/child_process/, /execSync\s*\(/, /spawn\s*\(/, /Docker.*host/i];
  const diffHasDangerous = dangerous.some(re => grepDiff(diff, re));
  const usesSandboxExec = diff.includes("sandboxExec") || (existsSync("packages/mcp-tools/src/shared/sandboxExec.ts") && readFileSync("packages/mcp-tools/src/shared/sandboxExec.ts","utf-8").length > 0);
  if (diffHasDangerous && !diff.includes("sandboxExec")) {
    // allow if it's in verifier/scripts itself
    const isVerifierOnly = diff.split("\n").every(l => l.includes("packages/verifier") || l.includes("scripts/codex-monitor"));
    if (!isVerifierOnly) { status = "fail"; evidence.push("DIFF uses raw exec/child_process without sandboxExec — must go through sandbox"); }
  } else evidence.push("No raw host exec outside sandboxExec in diff");
  // runner.py contract check hint
  if (existsSync("packages/sandbox/runner.py")) evidence.push("sandbox runner present");

  return { id: "sandbox-isolation", label: "Sandbox isolation preserved", status, severity: "critical", specRef: "ARCH:§ Layer 4 + policies/hitl.ts", evidence: evidence.join(" | ").slice(0, 2500) || "ok", durationMs: Date.now()-t0, fixHint: status==="fail" ? "Route execution through packages/mcp-tools/src/shared/sandboxExec.ts or Docker sandbox" : undefined };
}

export function checkArchLayers(diff: string): CheckResult {
  const t0 = Date.now();
  const violations: string[] = [];
  // Simple layer guard: web should not import server internals, mcp-tools should not import web
  if (grepDiff(diff, /from\s+["'].*apps\/server.*["']/ ) && grepDiff(diff, /apps\/web/)) violations.push("web imports server internals");
  if (grepDiff(diff, /from\s+["'].*apps\/web.*["']/ ) && diff.includes("packages/mcp-tools")) violations.push("mcp-tools imports web");
  // UI components should not call sandbox directly — must go via server API
  if (grepDiff(diff, /sandboxExec|runner\.py/) && grepDiff(diff, /apps\/web\/src\/components/)) violations.push("web component directly uses sandboxExec");
  return {
    id: "arch-layers", label: "5-layer architecture respected", status: violations.length ? "fail" : "pass", severity: "high",
    specRef: "ARCH:§ System Architecture", evidence: violations.length ? violations.join(" | ") : "No layer violations in diff", durationMs: Date.now()-t0,
    fixHint: violations.length ? "Keep layers: UI → /api → orchestrator → MCP → sandbox. No cross-layer imports." : undefined,
  };
}

export function checkMcpContract(diff: string): CheckResult {
  const t0 = Date.now();
  const hits: string[] = [];
  // If new MCP tool added, it should be under packages/mcp-tools/src/{system,security,data,shared}
  const addsTool = grepDiff(diff, /\+\s*.*tool\s*:/i) || grepDiff(diff, /MCP|mcp.*server/i);
  const touchesMcp = diff.includes("packages/mcp-tools");
  if (addsTool && !touchesMcp) hits.push("Tool wiring outside packages/mcp-tools — should live in MCP servers");
  // sandboxExec should be typed
  if (existsSync("packages/mcp-tools/src/shared/sandboxExec.ts")) {
    const src = readFileSync("packages/mcp-tools/src/shared/sandboxExec.ts","utf-8");
    if (!src.includes("types") && !src.includes("type ")) hits.push("sandboxExec.ts missing types");
  }
  return { id: "mcp-contract", label: "MCP tool contracts intact", status: hits.length ? "warn" : "pass", severity: "high", specRef: "ARCH:§ Execution / packages/mcp-tools", evidence: hits.length ? hits.join(" | ") : "MCP contracts ok", durationMs: Date.now()-t0 };
}

export function checkSecrets(diff: string, nameOnly: string[] = []): CheckResult {
  const t0 = Date.now();
  // Normalize nameOnly: list of changed filenames
  const changedFiles = nameOnly;
  const hits: string[] = [];

  // 1) Real .env file being added (not .env.example, not .gitignore mentioning .env)
  const envFiles = changedFiles.filter(f => {
    const base = f.split("/").pop() ?? f;
    return base === ".env" || base === ".env.local" || /^\.env\.[^.]+$/.test(base);
  }).filter(f => !f.includes(".env.example"));
  if (envFiles.length) hits.push(`.env file(s) in diff: ${envFiles.join(", ")}`);
  // also check staged list directly as fallback
  const staged = execSyncSafe("git diff --cached --name-only 2>/dev/null").split("\n").filter(Boolean);
  const stagedEnv = staged.filter(f => {
    const base = f.split("/").pop() ?? f;
    return base === ".env" || base === ".env.local";
  });
  if (stagedEnv.length && !hits.length) hits.push(`.env staged: ${stagedEnv.join(", ")}`);

  // 2) Secret patterns — but ignore verifier's own regex definitions and .gitignore/.env.example
  // Filter diff to only added lines (+...) that are not from verifier/checks or .gitignore
  const addedLines = diff.split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++"));
  const relevantLines = addedLines.filter(l => {
    // ignore lines from verifier's own check definition (contains the regex source itself)
    if (l.includes("packages/verifier/src/checks")) return false;
    if (l.includes("ANTHROPIC_API_KEY|OPENAI_API_KEY")) return false;
    if (l.includes("sk-ant-") && l.includes("ANTHROPIC")) return false;
    if (l.includes(".gitignore") || l.includes(".env.example")) return false;
    return true;
  }).join("\n");

  const secretPatterns: Array<[RegExp,string]> = [
    [/ANTHROPIC_API_KEY\s*[:=]\s*['"][^'"]{10,}['"]/i, "ANTHROPIC_API_KEY assignment"],
    [/OPENAI_API_KEY\s*[:=]\s*['"][^'"]{10,}['"]/i, "OPENAI_API_KEY assignment"],
    [/AWS_SECRET|GH_TOKEN\s*[:=]/i, "secret token assignment"],
    [/sk-ant-[a-z0-9_-]{20,}/i, "Anthropic key pattern sk-ant-..."],
    [/ghp_[A-Za-z0-9_]{30,}/, "GitHub PAT pattern"],
    [/AKIA[0-9A-Z]{16}/, "AWS AKIA pattern"],
    [/-----BEGIN (RSA )?PRIVATE KEY-----/, "private key in diff"],
  ];
  for (const [re, desc] of secretPatterns) {
    if (re.test(relevantLines)) hits.push(desc);
  }
  // Also flag if diff adds a file literally named .env with content (check diff header)
  if (/\+\+\+ b\/\.env\b/.test(diff) || /\+\+\+ b\/\.env\.local\b/.test(diff)) {
    if (!hits.some(h=>h.includes(".env"))) hits.push(".env file addition in diff header");
  }

  return {
    id: "security-secrets", label: "No secrets / env leakage", status: hits.length ? "fail" : "pass", severity: "critical",
    specRef: "SEC: .env.example / .gitignore", evidence: hits.length ? hits.join(" | ").slice(0,2000) : "No secrets in diff (filtered)", durationMs: Date.now()-t0,
    fixHint: hits.length ? "Remove secret, use process.env + .env.example, rotate leaked credential. Note: .gitignore listing .env is OK — don't commit the .env file itself." : undefined,
  };
}
function execSyncSafe(cmd: string): string { try { return execSync(cmd,{encoding:"utf-8"}).trim(); } catch { return ""; } }

export function checkSandboxContract(diff: string): CheckResult {
  const t0 = Date.now();
  const path = "packages/sandbox/runner.py";
  if (!existsSync(path)) return { id: "sandbox-contract", label: "Python sandbox runner contract intact", status: "skip", severity: "medium", specRef: "packages/sandbox/runner.py", evidence: "runner.py not found — skip", durationMs: Date.now()-t0 };
  const src = readFileSync(path,"utf-8");
  const hasContract = src.includes('"language"') && src.includes('"code"') && src.includes('"exitCode"');
  const diffTouchesRunner = diff.includes("runner.py");
  let status: CheckResult["status"] = "pass";
  let evidence = hasContract ? "runner.py stdin {language,code,timeout_ms} → {exitCode,stdout,stderr,timedOut} intact" : "runner.py contract missing keys";
  if (!hasContract) status = "fail";
  if (diffTouchesRunner && !hasContract) { status = "fail"; evidence += " | DIFF breaks runner contract"; }
  else if (diffTouchesRunner) evidence += " | runner.py modified but contract still holds";
  return { id: "sandbox-contract", label: "Python sandbox runner contract intact", status, severity: "medium", specRef: "packages/sandbox/runner.py", evidence, durationMs: Date.now()-t0 };
}
