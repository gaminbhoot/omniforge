/**
 * HITL Policy Engine — the judging hinge (Double-O + Savile Row)
 *
 * Every tool call passes through `evaluate(toolName, args)`.
 * - LOW/MEDIUM → auto-approved (MEDIUM constrained to sandbox)
 * - HIGH/CRITICAL → returns an ApprovalRequest; orchestrator pauses and
 *   broadcasts it over WebSocket. Client renders ApprovalModal.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PolicyRule = {
  risk: RiskLevel;
  requiresApproval: boolean;
  executionMode: "local" | "sandbox" | "host" | "target";
  description: string;
};

export type ApprovalRequest = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  risk: RiskLevel;
  executionMode: string;
  reason: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
};

const POLICIES: Record<string, PolicyRule> = {
  // System MCP
  read_logs: { risk: "LOW", requiresApproval: false, executionMode: "local", description: "Read logs — auto" },
  get_metrics: { risk: "LOW", requiresApproval: false, executionMode: "local", description: "Metrics — auto" },
  inspect_container: { risk: "LOW", requiresApproval: false, executionMode: "local", description: "Inspect — auto" },
  run_diagnostic_script: { risk: "MEDIUM", requiresApproval: false, executionMode: "sandbox", description: "Diagnostic in sandbox — auto" },
  restart_service: { risk: "CRITICAL", requiresApproval: true, executionMode: "host", description: "Restart service — 1-click confirm" },

  // Security MCP
  scan_dependencies: { risk: "LOW", requiresApproval: false, executionMode: "local", description: "Scan deps — auto" },
  inspect_diff: { risk: "LOW", requiresApproval: false, executionMode: "local", description: "Inspect diff — auto" },
  test_exploit: { risk: "MEDIUM", requiresApproval: false, executionMode: "sandbox", description: "Exploit sim in sandbox — auto" },
  create_patch_pr: { risk: "HIGH", requiresApproval: true, executionMode: "host", description: "Create PR — human review" },

  // Data MCP
  list_tables: { risk: "LOW", requiresApproval: false, executionMode: "local", description: "List tables — auto" },
  query_readonly: { risk: "LOW", requiresApproval: false, executionMode: "local", description: "SELECT — auto" },
  preview_csv: { risk: "LOW", requiresApproval: false, executionMode: "local", description: "Preview CSV — auto" },
  run_etl_script: { risk: "MEDIUM", requiresApproval: false, executionMode: "sandbox", description: "ETL in sandbox — auto" },
  validate_schema: { risk: "MEDIUM", requiresApproval: false, executionMode: "sandbox", description: "Schema validation — sandbox" },
  execute_write: { risk: "CRITICAL", requiresApproval: true, executionMode: "target", description: "DB write/migration — 1-click confirm" },
};

export function evaluate(tool: string, args: Record<string, unknown>): { rule: PolicyRule; needsApproval: boolean } {
  const rule = POLICIES[tool] ?? { risk: "HIGH" as RiskLevel, requiresApproval: true, executionMode: "host", description: "Unknown tool — default to HIGH (safe)" };

  // Heuristic upgrades — e.g. execute_write with dryRun:false is CRITICAL, dryRun:true is still HIGH
  if (tool === "execute_write" && (args as any)?.dryRun === false) {
    return { rule: { ...rule, risk: "CRITICAL" }, needsApproval: true };
  }

  return { rule, needsApproval: rule.requiresApproval };
}

export function createApprovalRequest(tool: string, args: Record<string, unknown>, rule: PolicyRule): ApprovalRequest {
  return {
    id: `appr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tool,
    args,
    risk: rule.risk,
    executionMode: rule.executionMode,
    reason: rule.description,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
}
