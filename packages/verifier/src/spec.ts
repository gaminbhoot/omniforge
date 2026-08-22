/**
 * Canonical spec definition — what "up to spec" means for OmniForge.
 * Every Codex fix is judged against this. Edit here to tighten/loosen.
 * Refs point to docs so verdicts are auditable.
 */

export type Severity = "critical" | "high" | "medium" | "low";
export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export type CheckResult = {
  id: string;
  label: string;
  status: CheckStatus;
  severity: Severity;
  specRef: string;          // e.g. "ARCH:§ HITL Gate Matrix" or "CI: test_ci.yml"
  evidence: string;         // human-readable + command output excerpt
  durationMs: number;
  fixHint?: string;
};

export type Verdict = {
  id: string;
  timestamp: string;
  source: "codex" | "unknown" | "manual";
  base: string;             // git base sha / ref
  head: string;             // git head sha
  filesChanged: string[];
  diffStat: string;
  overall: "PASS" | "FAIL" | "WARN";
  score: { passed: number; failed: number; warned: number; skipped: number; total: number };
  checks: CheckResult[];
  summary: string;
};

export type Spec = {
  id: string;
  version: string;
  checks: Array<{
    id: string;
    label: string;
    severity: Severity;
    specRef: string;
    description: string;
  }>;
};

export const SPEC: Spec = {
  id: "omniforge-spec-v1",
  version: "1.0.0",
  checks: [
    { id: "build",            label: "TypeScript build (tsc -b) passes",           severity: "critical", specRef: "CI:test_ci.yml / package.json:build", description: "No type errors; respects strict:true" },
    { id: "lint",             label: "ESLint passes (no errors)",                  severity: "high",     specRef: "CI:test_ci.yml / .eslintrc.cjs",     description: "No lint errors; warnings allowed but flagged" },
    { id: "tests",            label: "Tests pass (vitest)",                        severity: "critical", specRef: "CI:test_ci.yml / Q Branch",          description: "No regressions — existing tests still green" },
    { id: "hitl-integrity",   label: "HITL gate integrity intact",                 severity: "critical", specRef: "ARCH:§ HITL Gate Matrix / policies/hitl.ts", description: "CRITICAL/HIGH still require approval; evaluate() not bypassed" },
    { id: "sandbox-isolation",label: "Sandbox isolation preserved",                severity: "critical", specRef: "ARCH:§ Layer 4 + policies/hitl.ts",   description: "MEDIUM executes only in sandbox; no host exec escape" },
    { id: "arch-layers",      label: "5-layer architecture respected",              severity: "high",     specRef: "ARCH:§ System Architecture",           description: "UI↔Server↔Subagents↔MCP↔QA — no layer violations" },
    { id: "mcp-contract",     label: "MCP tool contracts intact",                  severity: "high",     specRef: "ARCH:§ Execution / packages/mcp-tools", description: "Tool servers expose typed inputs/outputs; sandboxExec used" },
    { id: "security-secrets", label: "No secrets / env leakage",                   severity: "critical", specRef: "SEC: .env.example / .gitignore",      description: "No .env, keys, tokens, or hardcoded secrets in diff" },
    { id: "no-bypass",        label: "No approval-bypass patterns",                severity: "critical", specRef: "ARCH:§ HITL + orchestrator.ts",       description: "No direct proposeTool bypass, no hard-coded approved=true" },
    { id: "sandbox-contract", label: "Python sandbox runner contract intact",      severity: "medium",   specRef: "packages/sandbox/runner.py",          description: "runner.py stdin→stdout JSON contract unchanged/broken" },
  ],
};
