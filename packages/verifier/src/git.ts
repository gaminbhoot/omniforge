/**
 * Git helpers — detect what Codex changed.
 * Strategy: prefer `origin/main...HEAD` if origin/main exists,
 * else HEAD vs staged/unstaged. Also detects codex provenance.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function sh(cmd: string): string {
  try { return execSync(cmd, { encoding: "utf-8", stdio: ["pipe","pipe","pipe"] }).trim(); }
  catch (e: any) { return (e.stdout?.toString() ?? "").trim(); }
}

export type DiffInfo = {
  base: string;
  head: string;
  stat: string;
  nameOnly: string[];
  diff: string;
  source: "codex" | "unknown" | "manual";
  evidence: string;
};

export function detectSource(): "codex" | "unknown" | "manual" {
  const branch = sh("git rev-parse --abbrev-ref HEAD");
  const lastMsg = sh("git log -1 --pretty=%B 2>/dev/null");
  const lastAuthor = sh("git log -1 --pretty=%an 2>/dev/null");
  const envHint = process.env.CODEX_FIX || process.env.SOURCE || "";
  const hay = `${branch}\n${lastMsg}\n${lastAuthor}\n${envHint}`.toLowerCase();
  if (hay.includes("codex") || hay.includes("codex-fix") || hay.includes("gpt")) return "codex";
  if (process.env.VERIFIER_SOURCE === "manual") return "manual";
  return "unknown";
}

export function getDiffInfo(): DiffInfo {
  const head = sh("git rev-parse HEAD 2>/dev/null") || "HEAD";
  let base = "HEAD";
  let diff = "";
  let stat = "";
  let nameOnly: string[] = [];
  let evidence = "";

  const hasOriginMain = (() => {
    try { execSync("git rev-parse --verify origin/main 2>/dev/null", { stdio: "pipe" }); return true; }
    catch { return false; }
  })();
  const hasMain = (() => {
    try { execSync("git rev-parse --verify main 2>/dev/null", { stdio: "pipe" }); return true; }
    catch { return false; }
  })();

  if (hasOriginMain) {
    base = sh("git merge-base origin/main HEAD") || "origin/main";
    diff = sh(`git diff ${base}..HEAD --unified=0 2>/dev/null`);
    stat = sh(`git diff --stat ${base}..HEAD 2>/dev/null`);
    nameOnly = sh(`git diff --name-only ${base}..HEAD 2>/dev/null`).split("\n").filter(Boolean);
    evidence = `origin/main...HEAD (${base.slice(0,7)}..${head.slice(0,7)})`;
  } else if (hasMain) {
    base = sh("git merge-base main HEAD") || "main";
    diff = sh(`git diff ${base}..HEAD --unified=0 2>/dev/null`);
    stat = sh(`git diff --stat ${base}..HEAD 2>/dev/null`);
    nameOnly = sh(`git diff --name-only ${base}..HEAD 2>/dev/null`).split("\n").filter(Boolean);
    evidence = `main...HEAD`;
  }
  // fallback to working tree if diff empty (uncommitted changes)
  if (!diff || nameOnly.length === 0) {
    const wdDiff = sh("git diff --unified=0 2>/dev/null");
    const stagedDiff = sh("git diff --cached --unified=0 2>/dev/null");
    const combined = [stagedDiff, wdDiff].filter(Boolean).join("\n");
    if (combined) {
      diff = combined;
      stat = sh("git diff --stat 2>/dev/null") + "\n" + sh("git diff --cached --stat 2>/dev/null");
      nameOnly = [...new Set([...sh("git diff --name-only 2>/dev/null").split("\n"), ...sh("git diff --cached --name-only 2>/dev/null").split("\n")].filter(Boolean))];
      evidence = "working tree (unstaged + staged)";
      base = head;
    }
  }
  if (!stat) stat = "(no diff)";
  if (!diff) { diff = sh("git diff HEAD --unified=0 2>/dev/null"); stat = stat || sh("git diff --stat HEAD 2>/dev/null"); }

  const source = detectSource();
  return { base, head, stat, nameOnly, diff, source, evidence };
}

export function getFileContentAtHead(path: string): string | null {
  try { return execSync(`git show HEAD:${path} 2>/dev/null`, { encoding: "utf-8" }); }
  catch { return existsSync(path) ? sh(`cat ${JSON.stringify(path)} 2>/dev/null`) : null; }
}
