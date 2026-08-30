import { describe, it, expect, afterEach, vi } from "vitest";
import { evaluate, createApprovalRequest, isExpired, hashArgs, APPROVAL_TTL_MS, POLICIES } from "./hitl.js";

describe("HITL Policy Evaluator", () => {
  it("should mark low-risk read operations as safe without approval", () => {
    const { rule, needsApproval } = evaluate("read_logs", { service: "api" });
    expect(needsApproval).toBe(false);
    expect(rule.risk).toBe("LOW");
  });

  it("should flag destructive restart command for human approval", () => {
    const { rule, needsApproval } = evaluate("restart_service", { service: "prod-db" });
    expect(needsApproval).toBe(true);
    expect(rule.risk).toBe("CRITICAL");
  });

  it("should default unknown tools to high risk requiring approval", () => {
    const { rule, needsApproval } = evaluate("unknown_destructive_action", {});
    expect(needsApproval).toBe(true);
    expect(rule.risk).toBe("HIGH");
  });

  it("should auto-execute MEDIUM tools but constrain them to the sandbox", () => {
    for (const tool of ["run_diagnostic_script", "test_exploit", "run_etl_script", "validate_schema"]) {
      const { rule, needsApproval } = evaluate(tool, {});
      expect(needsApproval).toBe(false);
      expect(rule.risk).toBe("MEDIUM");
      expect(rule.executionMode).toBe("sandbox");
    }
  });

  it("should require human review for HIGH pull-request creation", () => {
    const { rule, needsApproval } = evaluate("create_patch_pr", { branch: "fix/x" });
    expect(needsApproval).toBe(true);
    expect(rule.risk).toBe("HIGH");
    expect(rule.executionMode).toBe("host");
  });

  it("should keep the CRITICAL gate on execute_write even for dry runs", () => {
    for (const args of [{ sql: "SELECT 1", dryRun: true }, { sql: "DROP TABLE users" }]) {
      const { rule, needsApproval } = evaluate("execute_write", args);
      expect(needsApproval).toBe(true);
      expect(rule.risk).toBe("CRITICAL");
    }
  });

  it("should tier every registered policy consistently (LOW/MEDIUM auto, HIGH/CRITICAL gated)", () => {
    for (const [tool, rule] of Object.entries(POLICIES)) {
      if (rule.risk === "LOW" || rule.risk === "MEDIUM") expect(rule.requiresApproval, tool).toBe(false);
      if (rule.risk === "HIGH" || rule.risk === "CRITICAL") expect(rule.requiresApproval, tool).toBe(true);
      if (rule.risk === "MEDIUM") expect(rule.executionMode, tool).toBe("sandbox");
    }
  });
});

describe("approval expiry (SA-10 timeout control)", () => {
  it("expires approvals once the window has passed", () => {
    const req = createApprovalRequest("restart_service", {}, POLICIES.restart_service);
    expect(isExpired(req)).toBe(false);
    const expired = { ...req, expiresAt: new Date(Date.now() - 1).toISOString() };
    expect(isExpired(expired)).toBe(true);
  });

  it("falls back to a 5-minute TTL when APPROVAL_TTL_MS is not a finite positive number", async () => {
    const prev = process.env.APPROVAL_TTL_MS;
    process.env.APPROVAL_TTL_MS = "garbage";
    try {
      vi.resetModules();
      const fresh = await import("./hitl.js");
      expect(fresh.APPROVAL_TTL_MS).toBe(5 * 60 * 1000);
    } finally {
      if (prev === undefined) delete process.env.APPROVAL_TTL_MS;
      else process.env.APPROVAL_TTL_MS = prev;
      vi.resetModules();
    }
  });

  it("uses the configured TTL when it is a finite positive number", async () => {
    const prev = process.env.APPROVAL_TTL_MS;
    process.env.APPROVAL_TTL_MS = "60000";
    try {
      vi.resetModules();
      const fresh = await import("./hitl.js");
      expect(fresh.APPROVAL_TTL_MS).toBe(60000);
    } finally {
      if (prev === undefined) delete process.env.APPROVAL_TTL_MS;
      else process.env.APPROVAL_TTL_MS = prev;
      vi.resetModules();
    }
  });

  it("default window is 5 minutes", () => {
    expect(APPROVAL_TTL_MS).toBe(5 * 60 * 1000);
  });
});

describe("argument hashing (tamper evidence)", () => {
  it("is deterministic for identical arguments", () => {
    expect(hashArgs({ service: "api" })).toBe(hashArgs({ service: "api" }));
  });

  it("is independent of key order", () => {
    expect(hashArgs({ a: 1, b: 2 })).toBe(hashArgs({ b: 2, a: 1 }));
  });

  it("changes when any parameter changes", () => {
    expect(hashArgs({ sql: "SELECT 1" })).not.toBe(hashArgs({ sql: "SELECT 2" }));
  });
});

describe("approval requests", () => {
  it("carries tool, risk, mode, window, and a pending status", () => {
    const req = createApprovalRequest("restart_service", { service: "api" }, POLICIES.restart_service);
    expect(req.tool).toBe("restart_service");
    expect(req.risk).toBe("CRITICAL");
    expect(req.executionMode).toBe("host");
    expect(req.status).toBe("pending");
    expect(req.argsHash).toBe(hashArgs({ service: "api" }));
    expect(new Date(req.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

afterEach(() => {
  delete process.env.SANDBOX_ALLOW_LOCAL;
});
