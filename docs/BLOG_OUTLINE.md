# OmniForge Blog Outline — Field Report Track (TF-007)

**Target:** 1,200 words · Dev.to / Hashnode / Medium · publish before Aug 30 portal submit  
**Audience:** Hackathon judges + TrueForge community — show MCP/HITL/sandbox depth, not just screen caps.

## 1. Hook — Why Agents Need a Mission Control (200w)
- LLMs + tools = powerful, but unchecked they `rm -rf prod`, leak secrets, or hallucinate a migration.
- Thesis: autonomy needs **governance** — sandbox + human gates + observable traces.

## 2. Architecture — 5 Layers, 3 Agents, 1 Gate (300w)
- Diagram: Mermaid 5-layer (UI ↔ Orchestrator → Subagents ↔ MCP/Sandbox ↔ Qodo) — export as PNG for blog header.
- Orchestrator: intent router (keyword → LLM classifier Aug 24) + session memory + HITL interceptor.
- Subagents: OpsForge (logs/metrics), SecurForge (CVE→exploit→patch), DataForge (DuckDB/Polars ETL).
- HITL matrix table (LOW/MED/HIGH/CRIT) — the “crown jewel” for Double-O.
- MCP: three Stdio servers via `@modelcontextprotocol/sdk`, sandbox delegation via `sandboxExec`.

## 3. Building the Safety Net — Sandbox & Tooling (300w)
- `packages/sandbox`: `python:3.11-slim`, `no-new-privileges`, `cap_drop: ALL`, 512m/1cpu, `runner.py` JSON contract.
- Why not just `child_process.exec`? Isolation proof + `docker diff` demo.
- MCP choice: transports (stdio vs SSE), zod schemas, error handling.
- Challenge: Docker Desktop not running on CI — fallback to local subprocess in `sandboxExec`.

## 4. The HITL Moment — The 1:45 Video Beat (250w)
- GIF: dispatch outage → `read_logs` auto → `restart_service` → modal pops (diff viewer + risk badge) → Approve → `TerminalStream` confirms.
- Code pointer: `apps/server/src/policies/hitl.ts#evaluate` + `orchestrator.ts#proposeTool`.
- Reject path: feedback string becomes next observation — replanning without hardcoding.

## 5. Quality & Delivery — Qodo, Tests, CI (150w)
- Qodo PR-Agent on every PR (`.pr_agent.toml`), `test_ci.yml` (build + sandbox smoke), coverage badge.
- 3 E2E golden paths (ops/sec/data) on CI, auto-approve in test mode.
- Submission checklist tie-in; freeze `main` at 10:00 PDT Aug 30.

## Assets Needed
- [ ] 5-layer diagram PNG (export from ARCHITECTURE_SPEC.md Mermaid)
- [ ] GIF 1: HITL approve (OpsForge)
- [ ] GIF 2: sandbox terminal streaming
- [ ] GIF 3: ModuleSwitcher (3 modules)
- [ ] Screenshot: Qodo comment on PR #1

## CTA
- Repo: https://github.com/gaminbhoot/omniforge
- Live demo: `npm run dev` instructions
- Tag: `@WeMakeDevs @TrueFoundry` + `#TrueForge #MCP #TF007`
