# OmniForge

Autonomous multi-agent mission control platform with sandboxed execution and human-in-the-loop (HITL) governance.

OmniForge coordinates specialized AI agents through a single web cockpit. Every agent action is classified by a risk-based policy engine: low-risk reads run automatically, medium-risk code executes inside an isolated Docker sandbox, and high- or critical-risk operations pause the mission until a human approves them. Every decision is recorded in a durable audit log.

Developed for the Agent Harness Hackathon (TrueForge) by [WeMakeDevs](https://www.wemakedevs.org) and [TrueFoundry](https://www.truefoundry.com). Built on [TrueForge](https://github.com/truefoundry/trueforge), the [Model Context Protocol](https://modelcontextprotocol.io), and [Qodo](https://www.qodo.ai/).

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Human-in-the-Loop Governance](#human-in-the-loop-governance)
4. [Sandboxed Execution](#sandboxed-execution)
5. [MCP Tool Servers](#mcp-tool-servers)
6. [TrueForge Harness Integration](#trueforge-harness-integration)
7. [Web Cockpit](#web-cockpit)
8. [Getting Started](#getting-started)
9. [API Reference](#api-reference)
10. [Project Structure](#project-structure)
11. [Testing and Verification](#testing-and-verification)
12. [Code Review](#code-review)
13. [Security Practices](#security-practices)
14. [Implementation Index](#implementation-index)
15. [Contributing](#contributing)
16. [License](#license)

---

## Overview

OmniForge packages three specialized agents behind one governed execution model:

| Module | Domain | Example mission |
|--------|--------|-----------------|
| **OpsForge** | SRE and incident remediation | Diagnose a container outage, propose a restart, execute only after approval |
| **SecurForge** | Application security | Scan dependencies, simulate a CVE exploit in the sandbox, prepare a patch pull request |
| **DataForge** | Data operations | Load and transform CSVs, validate schemas, gate database writes behind approval |

A mission flows through the platform as follows:

1. The operator submits a mission from the web cockpit.
2. The orchestrator routes it to the matching subagent.
3. The agent works in steps, proposing tool calls each turn.
4. The HITL policy engine evaluates every proposed tool against a risk matrix.
5. Approved or low-risk calls execute locally, in the sandbox, or on the host; high-risk calls pause the session and surface an approval modal.
6. All steps, tool outputs, and approval decisions stream to the cockpit over SSE and are appended to the audit log.

## Architecture

```mermaid
flowchart TB
    Cockpit[OmniForge Mission Control Web UI] <--> Orchestrator[Express Orchestrator + HITL Policy Engine]
    Orchestrator --> Subagents[OpsForge | SecurForge | DataForge]
    Subagents <--> Tools[MCP Tool Servers + Docker Sandbox]
    Subagents <--> HITL[Approval Gates + Audit Log]
    Orchestrator <--> Harness[TrueForge Harness Bridge]
```

| Layer | Responsibility | Code |
|-------|----------------|------|
| Cockpit UI | Mission control, timeline, terminal stream, approval modal | `apps/web` |
| Orchestrator | Session loop, intent routing, HITL gate enforcement, SSE | `apps/server` |
| MCP tools | 14 typed tools across 3 servers | `packages/mcp-tools` |
| Sandbox | Isolated Docker execution with streamed output | `packages/sandbox` |
| Verifier | 10-check spec verifier used in CI and pre-merge | `packages/verifier` |

## Human-in-the-Loop Governance

Every tool call is evaluated by the policy engine (`apps/server/src/policies/hitl.ts`) against 15 registered tools plus a fail-safe default: any unregistered tool is treated as HIGH risk and requires approval.

| Risk | Execution mode | Approval | Examples |
|------|----------------|----------|----------|
| LOW | Local | Automatic | `read_logs`, `get_metrics`, `list_tables`, `query_readonly` |
| MEDIUM | Docker sandbox only | Automatic (sandboxed) | `run_diagnostic_script`, `test_exploit`, `run_etl_script`, `validate_schema` |
| HIGH | Host | Human review | `create_patch_pr` |
| CRITICAL | Host / target system | One-click confirm | `restart_service`, `execute_write` |

Gate behaviors:

- **Approve** — the tool executes and the mission resumes.
- **Reject with feedback** — the human's reason becomes the agent's next observation; the agent replans and the mission continues.
- **Timeout** — pending approvals auto-reject after `APPROVAL_TTL_MS` (default 5 minutes).
- **Re-approval** — any change to tool arguments invalidates a prior approval (arguments are hashed per request).
- **Audit log** — every decision (pending, approved, rejected, timeout, amended) is appended to `session_cache/audit.jsonl` with actor, timestamp, tool, and outcome.
- **Gate integrity** — while a gate is pending, no further tool proposals are accepted; the session is fully paused.

## Sandboxed Execution

All dynamic agent code runs inside a dedicated container (`packages/sandbox`):

- `python:3.11-slim` base with `pandas`, `polars`, `duckdb`; non-root `agent` user (uid 1000)
- Runtime isolation: `read_only: true`, `pids_limit: 128`, `cap_drop: ALL`, `no-new-privileges`, 512 MB memory, 1 CPU, tmpfs scratch at `/tmp` and `/home/agent`
- Execution contract: `runner.py` accepts `{language, code, timeout}`, returns `{exitCode, stdout, stderr, timedOut}`, and enforces per-run timeouts
- Streaming: stdout/stderr flow into the cockpit terminal in real time

The sandbox is the only path for dynamic execution; MCP tool servers delegate to `sandboxExec.ts`, which uses Docker and falls back to a local subprocess only when `SANDBOX_DOCKER=false` is explicitly set in development.

## MCP Tool Servers

Three stdio MCP servers expose the tool surface (`packages/mcp-tools`), also importable in-process:

| Server | Tools | Risk range |
|--------|-------|------------|
| **system** | `read_logs`, `get_metrics`, `inspect_container`, `run_diagnostic_script`, `restart_service` | LOW to CRITICAL |
| **security** | `scan_dependencies`, `inspect_diff`, `test_exploit`, `create_patch_pr` | LOW to HIGH |
| **data** | `list_tables`, `query_readonly`, `preview_csv`, `run_etl_script`, `validate_schema`, `execute_write` | LOW to CRITICAL |

## TrueForge Harness Integration

The server integrates with the TrueForge harness through a thin bridge (`apps/server/src/trueforge/harness.ts`):

- Probes harness availability and exposes status at `/api/harness/health`
- Creates harness sessions and turns for the three registered agents (`ops-forge`, `secur-forge`, `data-forge`)
- Reads sessions back into the cockpit so harness-side execution appears in the same timeline
- When the harness is not running, the local orchestrator handles missions so the platform remains fully functional in development

## Web Cockpit

| Component | Role |
|-----------|------|
| `CockpitLayout` | Page shell, mission-control header |
| `ModuleSwitcher` | Switch between OpsForge, SecurForge, and DataForge |
| `AgentTimeline` | Live step-by-step reasoning and tool trace |
| `ApprovalModal` | HITL gate: risk badge, command, approve or reject with feedback |
| `TerminalStream` | Live sandboxed stdout/stderr |

## Getting Started

Prerequisites: Node.js 20 or later, npm 10 or later, and Docker (for the sandbox).

```bash
# 1. Clone and configure
git clone https://github.com/gaminbhoot/omniforge.git
cd omniforge
cp .env.example .env

# 2. Install
npm install

# 3. Run (web at http://localhost:5173, server at http://localhost:3001)
npm run dev

# 4. Sandbox (optional — required for MEDIUM-risk tool execution)
docker compose up -d sandbox
docker exec omniforge-sandbox python /usr/local/bin/runner.py <<< '{"language":"python","code":"print(42)"}'

# 5. TrueForge harness (optional — enables the harness bridge)
npx @truefoundry/trueforge          # serves http://localhost:8790

# 6. Build
npm run build
```

Configuration is documented in `.env.example`. LLM provider keys are managed in the TrueForge harness, not in this server.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health check |
| POST | `/api/missions` | `{prompt}` — create a mission; auto-classifies to a subagent |
| GET | `/api/missions` | List sessions |
| GET | `/api/missions/:id` | Get session and steps |
| POST | `/api/missions/:id/tools` | `{tool, args}` — auto-executes at LOW/MEDIUM risk; HIGH/CRITICAL returns `pendingApproval` |
| POST | `/api/missions/:id/approval` | `{approved, feedback?}` — resolve a pending HITL gate |
| GET | `/api/stream/:id` | SSE stream of session steps |
| GET | `/api/harness/health` | TrueForge harness availability probe |
| GET | `/api/verify/latest` | Latest spec-verifier verdict |

## Project Structure

```
omniforge/
├── apps/
│   ├── web/                  # Mission-control cockpit (Vite + React + Tailwind)
│   │   └── src/components/   # CockpitLayout, ModuleSwitcher, AgentTimeline,
│   │                         # ApprovalModal, TerminalStream
│   └── server/               # Orchestrator (Express)
│       └── src/
│           ├── orchestrator.ts      # Session loop, gate enforcement, replan
│           ├── audit.ts             # Durable HITL audit log
│           ├── policies/hitl.ts     # Risk matrix and approval requests
│           ├── trueforge/harness.ts # Harness bridge
│           └── routes/              # missions, stream (SSE), harness, verify
├── packages/
│   ├── mcp-tools/            # system / security / data MCP servers
│   ├── sandbox/              # Dockerfile, runner.py, entrypoint.sh
│   └── verifier/             # 10-check spec verifier (HITL, secrets, isolation, ...)
├── scripts/                  # Verifier runner and install utility
├── .github/workflows/        # CI (lint, build, test, sandbox smoke), Qodo review, gitleaks
├── docker-compose.yml        # Sandbox (hardened) and optional demo databases
└── CONTRIBUTING.md
```

## Testing and Verification

```bash
npm test            # unit tests across workspaces (vitest)
npm run build       # type-check and build all workspaces
npm run lint        # eslint
npm run verify      # 10-check spec verifier; exits non-zero on failure
```

The verifier (`packages/verifier`) checks HITL policy integrity, sandbox isolation, secrets hygiene, CI presence, and more. CI runs lint, build, tests, Python sandbox tests, and a Docker sandbox smoke build on every push and pull request.

## Code Review

Qodo PR-Agent reviews every pull request with full repository context, configured in `.pr_agent.toml` and `.github/workflows/qodo_review.yml`. Findings are resolved before merge.

| Pull request | Qodo review | Finding | Resolution |
|--------------|-------------|---------|------------|
| [#1 — verify Qodo automated PR review integration](https://github.com/gaminbhoot/omniforge/pull/1) | [PR Summary](https://github.com/gaminbhoot/omniforge/pull/1) and [Code Review](https://github.com/gaminbhoot/omniforge/pull/1) by `qodo-code-review` | Medium (correctness): `checkSystemHealth()` hardcoded `healthy: true`, masking real outages | Fixed: health now derived from injected dependency checks, with regression tests |
| [#2 — security hardening and repository formalization](https://github.com/gaminbhoot/omniforge/pull/2) | [Code Review](https://github.com/gaminbhoot/omniforge/pull/2) by `qodo-code-review` | — | Helmet and rate limiting (SA-05), read-only sandbox with PID cap (SA-02), escaped HTML rendering (SA-09), healthcheck fix |

## Security Practices

- No secrets in the repository: `.env` is gitignored, `.env.example` documents required variables, and `gitleaks` runs in CI
- All dynamic execution is sandboxed; the verifier fails any raw `child_process.exec` outside `runner.py`
- Fail-safe HITL default: unregistered tools require human approval
- Durable audit trail for every HITL decision
- API hardening: helmet security headers, per-minute rate limiting, CORS allowlist, and CSP-safe rendering of agent output in the UI

## Implementation Index

Where each capability lives, for quick navigation:

| Capability | Location |
|------------|----------|
| Session loop and replanning | `apps/server/src/orchestrator.ts` (`proposeTool`, `resolveApproval`) |
| Risk matrix (15 tools, fail-safe default) | `apps/server/src/policies/hitl.ts` |
| Approval expiry and re-approval hashing | `apps/server/src/policies/hitl.ts` (`APPROVAL_TTL_MS`, `isExpired`, `hashArgs`) |
| Durable audit log | `apps/server/src/audit.ts` |
| Harness bridge | `apps/server/src/trueforge/harness.ts` |
| SSE streaming | `apps/server/src/routes/stream.ts` |
| MCP tool servers (14 tools) | `packages/mcp-tools/src/{system,security,data}/server.ts` |
| Sandbox execution contract | `packages/mcp-tools/src/shared/sandboxExec.ts`, `packages/sandbox/runner.py` |
| Container isolation | `docker-compose.yml`, `packages/sandbox/Dockerfile` |
| Approval modal and timeline | `apps/web/src/components/ApprovalModal.tsx`, `AgentTimeline.tsx` |
| Spec verifier | `packages/verifier/src/checks/index.ts` |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, conventions, and the pull-request checklist. All pull requests receive an automated Qodo review; critical findings must be resolved before merge.

## License

[MIT](./LICENSE)
