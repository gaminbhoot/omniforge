export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type McpToolDef = {
  name: string;
  description: string;
  risk: RiskLevel;
  requiresApproval: boolean;
};

export type SandboxExecRequest = {
  language: "python" | "bash";
  code: string;
  timeout_ms?: number;
};

export type SandboxExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};
