import { describe, it, expect } from "vitest";
import { createSession, proposeTool, resolveApproval, getSession } from "./orchestrator.js";

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

  it("records rejection with feedback and halts the mission", () => {
    const s = createSession("cve patch pr");
    proposeTool(s.id, "create_patch_pr", { branch: "fix/x", title: "t", patch: "-" });
    const resolved = resolveApproval(s.id, false, "not while prod is on fire");
    expect(resolved.status).toBe("done");
    expect(resolved.pendingApproval).toBeNull();
    const last = resolved.steps[resolved.steps.length - 1];
    expect(last.text).toContain("not while prod is on fire");
  });

  it("generates unique step ids even for rapid successive calls", () => {
    const s = createSession("etl data");
    proposeTool(s.id, "list_tables", {});
    proposeTool(s.id, "list_tables", {});
    const ids = getSession(s.id)!.steps.map((st) => st.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
