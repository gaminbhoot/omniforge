# 📚 OmniForge Documentation Index

Welcome to the **OmniForge** documentation suite for **The Agent Harness Hackathon (TrueForge)** organized by [WeMakeDevs](https://www.wemakedevs.org) & [TrueFoundry](https://www.truefoundry.com) (with [Qodo](https://www.qodo.ai)).

---

## 🏗️ Scaffold Status — 23 Aug 2026

Phase 0 scaffold is **live** — `npm run build` ✅, orchestrator unit-verified. Aug 24 harness swap is isolated to `apps/server/src/orchestrator.ts`.

```
omniforge/
├── apps/web        → Vite + React + Tailwind cockpit (CockpitLayout, AgentTimeline, ApprovalModal, TerminalStream, ModuleSwitcher)
├── apps/server     → Express + HITL engine + /api/missions + SSE stream
├── packages/mcp-tools → system/security/data MCP servers (FastMCP / @modelcontextprotocol/sdk)
├── packages/sandbox   → Dockerfile (python:3.11-slim, pandas/polars/duckdb) + runner.py
├── .github/workflows  → qodo_review.yml + test_ci.yml
├── docker-compose.yml → sandbox + optional postgres/clickhouse
└── docs/           → 5 specs (below)
```

Quick verify: `node -e "import('./apps/server/dist/orchestrator.js').then(m=>console.log(m.createSession('outage test')))"` exercises the full HITL path.

## 📑 Documentation Suite

0. **[📊 Exhaustive Project Report & 8-Day Execution Plan (`EXHAUSTIVE_REPORT.md`)](./EXHAUSTIVE_REPORT.md)** — **[Interactive HTML](./EXHAUSTIVE_REPORT.html)**
   - 22 Aug 2026 audit of all docs + repo state (2 commits) + 5-layer arch + 5 track strategies + 32-story backlog + risks. Tabs: Overview, Docs Audit, Architecture, Tracks, Plan, Backlog, Risks.
1. **[🏆 Hackathon Guide & Tracks (`HACKATHON_GUIDE.md`)](./HACKATHON_GUIDE.md)**
   - Official event details, links, dates, and judging track strategies ($5K Supercomputer, $1K Mac Mini, iPads, etc.).
2. **[🏗️ Technical Architecture Specification (`ARCHITECTURE_SPEC.md`)](./ARCHITECTURE_SPEC.md)**
   - Deep-dive into the TrueForge orchestrator, 3 specialized subagents, FastMCP tool servers, Docker sandboxing, and Human-in-the-Loop policy matrix.
3. **[🚀 Step-by-Step Implementation Playbook (`STEP_BY_STEP_PLAYBOOK.md`)](./STEP_BY_STEP_PLAYBOOK.md)**
   - Phase-by-phase action plan covering pre-hackathon setup, Day 1 kickoff, development milestones, and hardening.
4. **[📦 Final Submission & Deliverables Checklist (`SUBMISSION_CHECKLIST.md`)](./SUBMISSION_CHECKLIST.md)**
   - Complete deliverables checklist, 3-minute video demo script, and hackathon submission portal guide.

---

## 🌐 Quick Reference URLs

* **Official Portal:** [https://www.wemakedevs.org/hackathons/trueforge](https://www.wemakedevs.org/hackathons/trueforge)
* **TrueForge Upstream:** [https://github.com/truefoundry/trueforge](https://github.com/truefoundry/trueforge)
* **OmniForge Project Repository:** [https://github.com/gaminbhoot/omniforge](https://github.com/gaminbhoot/omniforge)
* **Model Context Protocol:** [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
* **Qodo PR Agent App:** [https://github.com/apps/qodo-merge](https://github.com/apps/qodo-merge)
