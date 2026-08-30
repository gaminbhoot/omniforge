---
name: container-outage-triage
description: OpsForge runbook — diagnose and recover a degraded or down container/service using governed MCP tools.
---

# Container Outage Triage (OpsForge)

Use this skill when the operator reports an outage, degraded latency, elevated
5xx/error rate, or a down container.

## Procedure

1. **Observe (LOW risk — run automatically)**
   - `read_logs` — tail the affected service's logs first; identify the failing
     component and the first error timestamp.
   - `get_metrics` — pull the 5m window for CPU, memory, p99 latency, error rate.
   - `inspect_container` — confirm restart count, OOM kills, health probe status.

2. **Diagnose (MEDIUM risk — executes in the Docker sandbox only)**
   - `run_diagnostic_script` — a Python probe that checks dependency reachability,
     latency buckets, and recent error patterns. Never touch the target system
     from the script; it runs isolated, read-only.

3. **Recover (CRITICAL risk — requires human approval)**
   - `restart_service` — propose a rolling restart ONLY if evidence supports it
     (e.g. crash loop, OOM, poisoned state). The mission pauses at the HITL gate
     with the exact command and a risk badge; do not retry around the gate.
   - If rejected with feedback, incorporate it as the next observation and
     propose a narrower alternative (e.g. targeted instance restart).

## Rules

- Never propose a restart before at least one observation and one diagnostic step.
- Quote evidence (log lines, metric values) in the proposal the human will approve.
- After approval and execution, verify recovery with `get_metrics` before
  declaring the mission complete.
