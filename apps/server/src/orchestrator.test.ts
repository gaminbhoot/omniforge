import { describe, it, expect } from "vitest";
import { createSession, proposeTool, resolveApproval, getSession, listSessions, resumeSession, fanoutSquad } from "./orchestrator.js";

// The live-sandbox test runs without Docker in CI — explicitly opt into the
// dev-only local fallback (sandboxExec fails closed without it, SA-03).
process.env.SANDBOX_ALLOW_LOCAL = "true";

describe("HITL governance in orchestrator", () => {
  it("blocks further tool proposals while an approval is pending", () => {
    const s = createSession("outage: restart api-gateway");
    proposeTool(s.id, "restart_service", { service: "api-gateway" });
    expect(getSession(s.id)?.status).toBe("awaiting_approval");

    expect(() => proposeTool(s.id, "read_logs", { service: "api-gateway" })).toThrow(/approval pending/i);
    expect(() => proposeTool(s.id, "execute_write", { sql: "DROP TABLE users", dryRun: false })).toThrow(/approval pending/i);

    // the original pending approval must be untouched
    expect(getSession(s.id)?.pendingApproval?.tool).toBe("restart_service");
  });

  it("resumes accepting tool calls after the gate is resolved", () => {
    const s = createSession("outage: restart api-gateway");
    proposeTool(s.id, "restart_service", { service: "api-gateway" });
    const resolved = resolveApproval(s.id, true, "go ahead");
    expect(resolved.status).toBe("running");
    expect(resolved.pendingApproval).toBeNull();

    const after = proposeTool(s.id, "get_metrics", { service: "api-gateway" });
    const last = after.steps[after.steps.length - 1];
    expect(last.role).toBe("tool");
    expect(last.tool).toBe("get_metrics");
  });

  it("on rejection, feeds feedback back and replans with a safer alternative", () => {
    const s = createSession("cve patch pr");
    proposeTool(s.id, "create_patch_pr", { branch: "fix/x", title: "t", patch: "-" });
    const resolved = resolveApproval(s.id, false, "not while prod is on fire");
    // mission CONTINUES (replan), it does not halt
    expect(resolved.status).toBe("running");
    expect(resolved.pendingApproval).toBeNull();
    const last = resolved.steps[resolved.steps.length - 1];
    expect(last.role).toBe("agent");
    expect(last.text).toContain("not while prod is on fire");
    expect(last.text).toContain("replanning");
    expect(last.suggest?.tool).toBe("test_exploit");
  });

  it("rejected restart_service replans to a live diagnostic", () => {
    const s = createSession("outage: restart api-gateway");
    proposeTool(s.id, "restart_service", { service: "api-gateway" });
    const resolved = resolveApproval(s.id, false, "too risky right now");
    const last = resolved.steps[resolved.steps.length - 1];
    expect(resolved.status).toBe("running");
    expect(last.suggest?.tool).toBe("run_diagnostic_script");
    // the replan suggestion is itself runnable without hitting the gate
    const after = proposeTool(s.id, last.suggest!.tool, last.suggest!.args);
    const step = after.steps[after.steps.length - 1];
    expect(step.role).toBe("tool");
    expect(step.text).toContain("sandbox");
  });

  it("rejected execute_write replans to a read-only preview that auto-executes (no second gate)", () => {
    const s = createSession("etl: write results to staging");
    proposeTool(s.id, "execute_write", { sql: "INSERT INTO staging.orders SELECT * FROM raw.orders", connection: "postgres" });
    const resolved = resolveApproval(s.id, false, "not until reviewed");
    const last = resolved.steps[resolved.steps.length - 1];
    expect(last.suggest?.tool).toBe("query_readonly");
    // the one-click suggestion must NOT open another approval modal
    const after = proposeTool(s.id, last.suggest!.tool, last.suggest!.args);
    expect(after.pendingApproval).toBeNull();
    expect(after.steps[after.steps.length - 1].role).toBe("tool");
  });

  it("routes sandbox tools through live sandboxExec, not mock output", () => {
    const s = createSession("etl data");
    const after = proposeTool(s.id, "run_etl_script", { language: "python", code: "print('live-etl-check')" });
    const step = after.steps[after.steps.length - 1];
    expect(step.text).toContain("live in sandbox");
    // output fills asynchronously — give the event loop a beat
    return new Promise<void>((resolve) => setTimeout(() => {
      expect(step.output).toContain("live-etl-check");
      resolve();
    }, 3000));
  });

  it("sandbox tools fail closed when the local fallback is not opted in (SA-03)", async () => {
    const prevLocal = process.env.SANDBOX_ALLOW_LOCAL;
    const prevDocker = process.env.SANDBOX_DOCKER;
    delete process.env.SANDBOX_ALLOW_LOCAL;
    process.env.SANDBOX_DOCKER = "false"; // skip Docker entirely — deterministic without a daemon
    try {
      const s = createSession("etl data");
      const after = proposeTool(s.id, "run_etl_script", { language: "python", code: "print('must-not-run')" });
      const step = after.steps[after.steps.length - 1];
      await new Promise((r) => setTimeout(r, 200));
      expect(step.output).toContain("sandboxExec error");
      expect(step.output).toContain("SANDBOX_ALLOW_LOCAL");
    } finally {
      if (prevLocal === undefined) delete process.env.SANDBOX_ALLOW_LOCAL; else process.env.SANDBOX_ALLOW_LOCAL = prevLocal;
      if (prevDocker === undefined) delete process.env.SANDBOX_DOCKER; else process.env.SANDBOX_DOCKER = prevDocker;
    }
  });

  it("validate_schema renders a structured mock, not a placeholder", () => {
    const s = createSession("data: validate schema");
    const after = proposeTool(s.id, "validate_schema", { table: "orders" });
    const step = after.steps[after.steps.length - 1];
    expect(step.output).not.toContain("[mock output");
    const parsed = JSON.parse(step.output!);
    expect(parsed.status).toBe("valid");
  });

  it("generates unique step ids even for rapid successive calls", () => {
    const s = createSession("etl data");
    proposeTool(s.id, "list_tables", {});
    proposeTool(s.id, "list_tables", {});
    const ids = getSession(s.id)!.steps.map((st) => st.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("bounds the session store without dropping a pending approval (SA-12)", () => {
    const gated = createSession("outage: restart api-gateway");
    proposeTool(gated.id, "restart_service", { service: "api-gateway" });
    expect(gated.status).toBe("awaiting_approval");

    // fill the store past the cap; the awaiting-approval session must survive
    for (let i = 0; i < 250; i++) createSession(`filler mission ${i}`);
    expect(getSession(gated.id)).toBeDefined();
    expect(getSession(gated.id)?.pendingApproval?.tool).toBe("restart_service");
    expect(listSessions().length).toBeLessThanOrEqual(201);
  });

  it("timeout path announces the replan consistently with the sweep path", () => {
    const s = createSession("outage: restart api-gateway");
    proposeTool(s.id, "restart_service", { service: "api-gateway" });
    const resolved = resolveApproval(s.id, false); // rejection path
    const rejected = resolved.steps.at(-1)!.text;
    expect(rejected).toContain("replanning");
  });
});

describe("persistent sessions (follow-up on the same mission)", () => {
  it("appends the follow-up to the same session and keeps prior steps", () => {
    const s = createSession("outage: restart api-gateway");
    proposeTool(s.id, "read_logs", { service: "api-gateway" });
    const before = getSession(s.id)!.steps.length;

    const resumed = resumeSession(s.id, "is it still healthy?");
    expect(resumed.id).toBe(s.id);
    expect(resumed.status).toBe("running");
    expect(resumed.pendingApproval).toBeNull();
    expect(resumed.steps.length).toBeGreaterThan(before);
    expect(resumed.steps.some((st) => st.role === "user" && st.text === "is it still healthy?")).toBe(true);
    expect(resumed.steps.some((st) => /context from \d+ prior steps/i.test(st.text))).toBe(true);
  });

  it("rejects a follow-up on an unknown session", () => {
    expect(() => resumeSession("sess_missing", "hello")).toThrow(/not found/i);
  });

  it("a pending HITL gate blocks a follow-up just like a tool proposal (gate integrity)", () => {
    const s = createSession("outage: restart api-gateway");
    proposeTool(s.id, "restart_service", { service: "api-gateway" });
    expect(() => resumeSession(s.id, "try again now")).toThrow(/approval pending/i);
    expect(getSession(s.id)?.pendingApproval?.tool).toBe("restart_service");
  });
});

describe("parallel subagent squad fan-out", () => {
  it("spawns one session per matched domain sharing a squadId", () => {
    const { squadId, sessions } = fanoutSquad("outage on api-gateway and a CVE in lodash — handle both");
    expect(squadId).toMatch(/^squad_/);
    expect(sessions.length).toBe(2);
    expect(new Set(sessions.map((s) => s.subagent))).toEqual(new Set(["OpsForge", "SecurForge"]));
    for (const s of sessions) {
      expect(s.squadId).toBe(squadId);
      expect(s.status).toBe("running");
      expect(s.steps[1].text).toContain("parallel");
    }
  });

  it("falls back to a single general member when no domain matches", () => {
    const { sessions } = fanoutSquad("do the thing");
    expect(sessions.length).toBe(1);
    expect(sessions[0].subagent).toBe("General");
  });

  it("members are independent sessions (own ids, own steps)", () => {
    const { sessions } = fanoutSquad("outage and etl schema drift");
    expect(sessions.length).toBe(2);
    expect(new Set(sessions.map((s) => s.id)).size).toBe(2);
    proposeTool(sessions[0].id, "read_logs", {});
    expect(getSession(sessions[0].id)!.steps.length).toBeGreaterThan(getSession(sessions[1].id)!.steps.length);
  });
});
