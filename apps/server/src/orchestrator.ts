/**
 * TrueForge Orchestrator — stub that mirrors the real TrueForge API shape
 * so Phase 0 scaffolding is runnable before Aug 24. Swap the internals
 * when the harness drops; keep the public interface stable.
 */

import { classifyIntent, subagentFor } from "./policies/router.js";
import { evaluate, createApprovalRequest, isExpired, APPROVAL_TTL_MS, type ApprovalRequest } from "./policies/hitl.js";
import { audit } from "./audit.js";
import { sandboxExec } from "@omniforge/mcp-tools/shared/sandboxExec";

export type Step = {
  id: string;
  role: "user" | "agent" | "tool" | "hitl";
  text: string;
  tool?: string;
  args?: Record<string, unknown>;
  output?: string;
  risk?: string;
  /** One-click alternative proposed after a rejection (agent replan) */
  suggest?: { tool: string; args: Record<string, unknown> };
  timestamp: string;
};

export type Session = {
  id: string;
  mission: ReturnType<typeof classifyIntent>;
  subagent: string;
  steps: Step[];
  pendingApproval: ApprovalRequest | null;
  status: "running" | "awaiting_approval" | "done";
};

const sessions = new Map<string, Session>();

/** Bound the in-memory session store (SA-12) — evict oldest beyond the cap. */
const MAX_SESSIONS = 200;

/** Auto-reject expired HITL gates (US-11: 5 minutes). Called on every read/write. */
function sweepExpiredApproval(session: Session): void {
  const req = session.pendingApproval;
  if (!req) return;
  if (!isExpired(req)) return;
  // timeout → auto-reject (SA-10)
  req.status = "rejected";
  session.pendingApproval = null;
  session.status = "running";
  const msg = `Auto-rejected — approval window expired after ${APPROVAL_TTL_MS / 60000}m (timeout)`;
  session.steps.push({
    id: stepId(),
    role: "agent",
    text: `${msg} for **${req.tool}**. Agent ${GENERIC_REPLAN}.`,
    tool: req.tool,
    args: req.args,
    timestamp: new Date().toISOString(),
  });
  audit({ at: new Date().toISOString(), sessionId: session.id, approvalId: req.id, tool: req.tool, risk: req.risk, decision: "timeout", actor: "system:timeout", reason: "approval window expired" });
}

/** Collision-proof step id (Date.now() alone collides on rapid calls) */
function stepId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createSession(userInput: string): Session {
  const mission = classifyIntent(userInput);
  const subagent = subagentFor(mission);
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  while (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value as string | undefined;
    if (!oldest) break;
    sessions.delete(oldest);
  }
  const session: Session = {
    id,
    mission,
    subagent,
    steps: [
      { id: stepId(), role: "user", text: userInput, timestamp: new Date().toISOString() },
      {
        id: stepId(),
        role: "agent",
        text: `Mission classified as **${mission.type}** (${mission.reason}) → dispatching to **${subagent}**.`,
        timestamp: new Date().toISOString(),
      },
    ],
    pendingApproval: null,
    status: "running",
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  const session = sessions.get(id);
  if (session) sweepExpiredApproval(session);
  return session;
}

export function listSessions(): Session[] {
  return [...sessions.values()];
}

/**
 * Propose a tool call. If HITL is required, attach an ApprovalRequest and
 * pause the session. Otherwise auto-execute (mock) and append a tool step.
 */
export function proposeTool(sessionId: string, tool: string, args: Record<string, unknown>): Session {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);
  sweepExpiredApproval(session);
  if (session.status === "awaiting_approval") {
    // Mission is paused at a HITL gate — no side effects (even LOW/MEDIUM)
    // and no overwriting of the pending ApprovalRequest until it is resolved.
    throw new Error(`approval pending for "${session.pendingApproval?.tool}" — resolve the HITL gate before proposing more tools`);
  }

  const { rule, needsApproval } = evaluate(tool, args);

  if (needsApproval) {
    const approval = createApprovalRequest(tool, args, rule);
    session.pendingApproval = approval;
    session.status = "awaiting_approval";
    session.steps.push({
      id: stepId(),
      role: "hitl",
      text: `HITL gate — **${tool}** (${rule.risk}) requires approval.`,
      tool,
      args,
      risk: rule.risk,
      timestamp: new Date().toISOString(),
    });
    audit({ at: new Date().toISOString(), sessionId: session.id, approvalId: approval.id, tool, risk: rule.risk, decision: "pending", actor: "agent" });
  } else {
    const live = SANDBOX_TOOLS.has(tool);
    const step: Step = {
      id: stepId(),
      role: "tool",
      text: `▶ ${tool} (${rule.risk}) — ${live ? "executing live in sandbox" : `auto-executed in ${rule.executionMode}`}`,
      tool,
      args,
      output: live ? undefined : mockOutput(tool, args),
      risk: rule.risk,
      timestamp: new Date().toISOString(),
    };
    session.steps.push(step);
    if (live) execInSandbox(tool, args, step);
  }
  return session;
}

/**
 * Replan playbook — what the agent does instead when a gated action is
 * rejected. The human's feedback becomes the next observation; the agent
 * proposes a safer alternative (one-click in the Cockpit UI).
 */
const REPLANS: Record<string, { text: string; suggest?: { tool: string; args: Record<string, unknown> } }> = {
  restart_service: {
    text: "replanning: running a deeper live diagnostic first — will re-propose a narrower restart only if the evidence supports it",
    suggest: {
      tool: "run_diagnostic_script",
      args: { language: "python", code: "print('replan: deep health probe after rejected restart')\nprint('p99 latency, error rate, dependency status — collecting…')" },
    },
  },
  create_patch_pr: {
    text: "replanning: refining the patch with regression tests before requesting human review again",
    suggest: {
      tool: "test_exploit",
      args: { cve: "re-verify after patch refinement", language: "python", exploit_code: "print('replan: regression check on patched code path')" },
    },
  },
  execute_write: {
    text: "replanning: previewing the affected rows with a read-only query so nothing touches the target until reviewed",
    suggest: {
      tool: "query_readonly",
      args: { sql: "SELECT * FROM staging.orders LIMIT 10", connection: "postgres" },
    },
  },
};

const GENERIC_REPLAN = "replanning: incorporating your feedback and preparing a safer alternative for review";

export function resolveApproval(sessionId: string, approved: boolean, feedback?: string): Session {
  const session = sessions.get(sessionId);
  if (!session || !session.pendingApproval) throw new Error("no pending approval");
  const req = session.pendingApproval;
  // If the window expired, treat as timeout (SA-10) — even an "approve" becomes auto-reject
  if (isExpired(req)) {
    session.pendingApproval = null;
    session.status = "running";
    session.steps.push({
      id: stepId(),
      role: "agent",
      text: `Auto-rejected — approval window expired after ${APPROVAL_TTL_MS / 60000}m for **${req.tool}**. Agent ${GENERIC_REPLAN}.`,
      tool: req.tool,
      args: req.args,
      timestamp: new Date().toISOString(),
    });
    audit({ at: new Date().toISOString(), sessionId: session.id, approvalId: req.id, tool: req.tool, risk: req.risk, decision: "timeout", actor: "system:timeout", reason: "approval window expired on resolve" });
    return session;
  }
  req.status = approved ? "approved" : "rejected";
  session.pendingApproval = null;
  if (approved) {
    session.status = "running";
    session.steps.push({
      id: stepId(),
      role: "tool",
      text: `Approved — executing **${req.tool}** on ${req.executionMode}…`,
      tool: req.tool,
      args: req.args,
      output: mockOutput(req.tool, req.args),
      timestamp: new Date().toISOString(),
    });
    session.steps.push({
      id: stepId(),
      role: "agent",
      text: `Mission step completed. Awaiting next instruction or auto-advancing.`,
      timestamp: new Date().toISOString(),
    });
    audit({ at: new Date().toISOString(), sessionId: session.id, approvalId: req.id, tool: req.tool, risk: req.risk, decision: "approved", actor: "operator:api", reason: feedback });
  } else {
    // Rejected — the feedback becomes the agent's next observation and the
    // mission CONTINUES with a safer replan (not a halt).
    session.status = "running";
    const replan = REPLANS[req.tool] ?? { text: GENERIC_REPLAN };
    session.steps.push({
      id: stepId(),
      role: "agent",
      text: `Rejected — ${feedback ?? "operator rejected the action"}. Agent ${replan.text}.`,
      tool: req.tool,
      args: req.args,
      suggest: replan.suggest,
      timestamp: new Date().toISOString(),
    });
    audit({ at: new Date().toISOString(), sessionId: session.id, approvalId: req.id, tool: req.tool, risk: req.risk, decision: "rejected", actor: "operator:api", reason: feedback });
  }
  return session;
}

/** MEDIUM tools that genuinely execute code — run for real via sandboxExec (Docker, dev fallback local) */
const SANDBOX_TOOLS = new Set(["run_diagnostic_script", "test_exploit", "run_etl_script"]);

function execInSandbox(tool: string, args: Record<string, unknown>, step: Step): void {
  const code = args?.code ?? args?.exploit_code;
  const req = {
    language: (args?.language === "bash" ? "bash" : "python") as "bash" | "python",
    code: typeof code === "string" ? code : "",
    timeout_ms: typeof args?.timeout_ms === "number" ? args.timeout_ms : undefined,
  };
  if (!req.code) {
    step.output = `[sandboxExec] no code provided for ${tool}`;
    return;
  }
  sandboxExec(req)
    .then((r) => {
      step.output = JSON.stringify(r, null, 2);
    })
    .catch((e: unknown) => {
      step.output = `[sandboxExec error] ${String((e as Error)?.message ?? e)}`;
    });
}

function mockOutput(tool: string, _args: Record<string, unknown>): string {
  const mocks: Record<string, string> = {
    read_logs: "2026-08-23T00:01:00Z WARN  latency p99=420ms\n2026-08-23T00:02:00Z INFO  recovered",
    get_metrics: JSON.stringify({ cpu: "42%", memory: "512MiB", p99: "210ms" }, null, 2),
    run_diagnostic_script: '{"exitCode":0,"stdout":"diagnostics passed","stderr":""}',
    restart_service: "service restarted successfully — healthcheck OK",
    scan_dependencies: JSON.stringify([{ pkg: "lodash", cve: "CVE-2021-23337", severity: "high" }], null, 2),
    test_exploit: '{"exploitResult":{"exitCode":0,"stdout":"exploit reproduced in sandbox"}}',
    list_tables: '["users","orders","events"]',
    query_readonly: "| id | name  |\n| 1  | alice |\n| 2  | bob   |",
    run_etl_script: '{"exitCode":0,"stdout":"transformed 1200 rows"}',
    execute_write: "write executed (simulated — target system untouched)",
    validate_schema: JSON.stringify({ table: "orders", columnsExpected: 6, columnsFound: 6, drift: "none", status: "valid" }, null, 2),
  };
  return mocks[tool] ?? `[mock output for ${tool}]`;
}
