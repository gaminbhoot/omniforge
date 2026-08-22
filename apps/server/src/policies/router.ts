/**
 * Mission Dispatcher — intent classifier → subagent selection
 * Phase 1: keyword router (deterministic, demo-reliable)
 * Phase 2+: swap to LLM classifier behind same interface
 */

export type MissionType = "ops" | "security" | "data" | "unknown";
export type Mission = { type: MissionType; confidence: number; reason: string };

const PATTERNS: Array<[MissionType, RegExp, string]> = [
  ["ops", /(outage|incident|logs?|metrics|restart|k8s|kubernetes|docker|container|latency|p99|5xx|downtime)/i, "SRE keywords"],
  ["security", /(cve|vulnerab|exploit|patch|dependenc|audit|pr\b|pull request)/i, "AppSec keywords"],
  ["data", /(etl|transform|schema|migration|duckdb|postgres|clickhouse|csv|dataframe|parquet)/i, "DataOps keywords"],
];

export function classifyIntent(input: string): Mission {
  for (const [type, re, reason] of PATTERNS) {
    if (re.test(input)) return { type, confidence: 0.85, reason };
  }
  return { type: "unknown", confidence: 0.3, reason: "no pattern matched — default to general" };
}

export function subagentFor(mission: Mission): string {
  switch (mission.type) {
    case "ops": return "OpsForge";
    case "security": return "SecurForge";
    case "data": return "DataForge";
    default: return "General";
  }
}
