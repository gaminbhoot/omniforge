/**
 * TrueForge Orchestrator — stub that mirrors the real TrueForge API shape
 * so Phase 0 scaffolding is runnable before Aug 24. Swap the internals
 * when the harness drops; keep the public interface stable.
 */

import { classifyIntent, subagentFor } from "./policies/router.js";
import { evaluate, createApprovalRequest, type ApprovalRequest } from "./policies/hitl.js";

export type Step = {
  id: string;
  role: "user" | "agent" | "tool" | "hitl";
  text: string;
  tool?: string;
  args?: Record<string, unknown>;
  output?: string;
  risk?: string;
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

/** Collision-proof step id (Date.now() alone collides on rapid calls) */
function stepId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createSession(userInput: string): Session {
  const mission = classifyIntent(userInput);
  const subagent = subagentFor(mission);
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
  return sessions.get(id);
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
      text: `⛔ HITL gate — **${tool}** (${rule.risk}) requires approval.`,
      tool,
      args,
      risk: rule.risk,
      timestamp: new Date().toISOString(),
    });
  } else {
    session.steps.push({
      id: stepId(),
      role: "tool",
      text: `▶ ${tool} (${rule.risk}) — auto-executed in ${rule.executionMode}`,
      tool,
      args,
      output: mockOutput(tool, args),
      risk: rule.risk,
      timestamp: new Date().toISOString(),
    });
  }
  return session;
}

export function resolveApproval(sessionId: string, approved: boolean, feedback?: string): Session {
  const session = sessions.get(sessionId);
  if (!session || !session.pendingApproval) throw new Error("no pending approval");
  const req = session.pendingApproval;
  req.status = approved ? "approved" : "rejected";
  session.pendingApproval = null;
  session.status = approved ? "running" : "done";
  session.steps.push({
    id: stepId(),
    role: approved ? "tool" : "agent",
    text: approved
      ? `✅ Approved — executing **${req.tool}** on ${req.executionMode}…`
      : `❌ Rejected — ${feedback ?? "operator rejected the action"}. Halting mission.`,
    tool: req.tool,
    args: req.args,
    output: approved ? mockOutput(req.tool, req.args) : undefined,
    timestamp: new Date().toISOString(),
  });
  if (approved) {
    session.steps.push({
      id: stepId(),
      role: "agent",
      text: `Mission step completed. Awaiting next instruction or auto-advancing.`,
      timestamp: new Date().toISOString(),
    });
  }
  return session;
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
    execute_write: "write executed (mock)",
  };
  return mocks[tool] ?? `[mock output for ${tool}]`;
}
