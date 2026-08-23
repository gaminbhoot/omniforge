import { describe, it, expect } from "vitest";
import { evaluate } from "./hitl.js";

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
});
