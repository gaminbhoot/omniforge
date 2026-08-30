import { describe, it, expect } from "vitest";
import { createSession, proposeTool, resolveApproval, getSession } from "./orchestrator.js";

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

  it("generates unique step ids even for rapid successive calls", () => {
    const s = createSession("etl data");
    proposeTool(s.id, "list_tables", {});
    proposeTool(s.id, "list_tables", {});
    const ids = getSession(s.id)!.steps.map((st) => st.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
