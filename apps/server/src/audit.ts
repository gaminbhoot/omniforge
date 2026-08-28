import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Durable HITL audit trail (SA-10) — append-only JSONL.
 * Every approval transition (pending → approved|rejected|timeout|amended)
 * is persisted so decisions are forensically attributable.
 * `session_cache/` is gitignored at any depth.
 */
const AUDIT_DIR = join(process.cwd(), "session_cache");

export type AuditDecision = "pending" | "approved" | "rejected" | "timeout" | "amended" | "reapproval_required";

export type AuditEntry = {
  at: string;
  sessionId: string;
  approvalId: string;
  tool: string;
  risk: string;
  decision: AuditDecision;
  actor: string;
  reason?: string;
};

export function audit(entry: AuditEntry): void {
  try {
    mkdirSync(AUDIT_DIR, { recursive: true });
    appendFileSync(join(AUDIT_DIR, "audit.jsonl"), JSON.stringify(entry) + "\n");
  } catch (e) {
    // audit must never break the mission loop — log and continue
    console.warn("[audit] write failed:", (e as Error)?.message);
  }
}
