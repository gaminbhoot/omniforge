# ⚡ OmniForge

> **Autonomous Multi-Agent Mission Control Platform with Sandboxed Execution & Human-in-the-Loop Governance**  
> Powered by [TrueForge](https://github.com/truefoundry/trueforge), [Model Context Protocol (MCP)](https://modelcontextprotocol.io), and [Qodo](https://www.qodo.ai/).

Built for **The Agent Harness Hackathon (TrueForge)** by [WeMakeDevs](https://www.wemakedevs.org) & [TrueFoundry](https://www.truefoundry.com).

---

## 🔗 Quick Links & Hackathon Information

* 🌐 **Official Hackathon Portal:** [https://www.wemakedevs.org/hackathons/trueforge](https://www.wemakedevs.org/hackathons/trueforge)
* 🤖 **TrueForge Core Engine:** [https://github.com/truefoundry/trueforge](https://github.com/truefoundry/trueforge)
* 📦 **Project Repository:** [https://github.com/gaminbhoot/omniforge](https://github.com/gaminbhoot/omniforge)
* 🔌 **Model Context Protocol (MCP):** [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
* 🛡️ **Qodo PR Agent App:** [https://github.com/apps/qodo-merge](https://github.com/apps/qodo-merge)

---

## 🎯 What is OmniForge?

OmniForge is an enterprise-grade autonomous multi-agent cockpit that provides safe, sandboxed execution and human-in-the-loop (HITL) approval governance across 3 critical operations:

1. **🛠️ OpsForge (SRE & Incident Remediation):** Outage diagnostics & safe recovery in isolated sandboxes.
2. **🛡️ SecurForge (AppSec & Vulnerability Patching):** CVE exploit simulation and automated regression testing with Qodo.
3. **📊 DataForge (DataOps & Sandboxed ETL):** Multi-database transformation pipelines with schema-validation approval gates.

---

## 🏗️ Architecture

```mermaid
flowchart TB
    Cockpit[OmniForge Mission Control Web UI] <--> TrueForge[TrueForge Agent Orchestrator]
    TrueForge --> SubAgents[SRE | AppSec | DataOps Subagents]
    SubAgents <--> Tools[MCP Servers & Docker Sandbox]
    SubAgents <--> HITL[🛑 Human-in-the-Loop Approval Gates]
    TrueForge <--> Qodo[Qodo Continuous Quality & PR Reviews]
```

---

## 🚀 Quick Start (Phase 0 Scaffold + Kick-off Guide)

```bash
# 0. TrueForge harness (Node 22+, per kick-off guide) — in a separate terminal
npx @truefoundry/trueforge          # → http://localhost:8790  Settings → Models → add API key
#   then Settings → Connectors (exa/deepwiki), Skills (SKILL.md), Sandbox → Daytona (or use local Docker below)

# 1. env
cp .env.example .env   # set ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL=https://api.meta.ai + ANTHROPIC_MODEL=muse-spark-1.2-contributor

# 2. install (use /tmp cache if npm perms complain)
npm install --cache /tmp/npm-cache

# 3. dev — runs web (5173) + server (3001) concurrently
npm run dev

# or individually:
npm run dev:web      # Mission Control → http://localhost:5173
npm run dev:server   # Orchestrator  → http://localhost:3001/api/health

# 4. sandbox (local Docker fallback — Daytona is the hosted alternative in harness)
docker compose up -d sandbox
docker exec omniforge-sandbox python /usr/local/bin/runner.py <<< '{"language":"python","code":"print(42)"}'

# 5. build
npm run build
```

> **Harness note:** OmniForge server stub (`apps/server/src/orchestrator.ts`) now talks to a real TrueForge harness at `http://localhost:8790` (SQLite). Agents `ops-forge/secur-forge/data-forge` on `anthropic/muse-spark-12` with `sandbox:true` + `mcp_servers:[deepwiki, exa]` are already wired; `npx trueforge` is the source of truth per [kick-off guide](https://www.wemakedevs.org/blogs/agent-harness-hackathon-kick-off).

## 📂 Monorepo Layout

```
apps/web        → Mission Control cockpit (Vite + React + Tailwind)
apps/server     → Orchestrator + HITL policy engine + routes + SSE stream
packages/mcp-tools → system / security / data FastMCP servers
packages/sandbox   → Docker sandbox + runner.py
docs/           → HACKATHON_GUIDE, ARCHITECTURE_SPEC, PLAYBOOK, CHECKLIST
```

See [`docs/README.md`](./docs/README.md) for the full documentation index.

## 📚 Complete Project Documentation

Explore our comprehensive guides in the [`docs/`](./docs) directory:

* 📊 **[Exhaustive Report & 8-Day Plan (Interactive)](./docs/EXHAUSTIVE_REPORT.md)** — [HTML](./docs/EXHAUSTIVE_REPORT.html)
* 🏆 **[Hackathon Master Guide & Prize Strategy](./docs/HACKATHON_GUIDE.md)**
* 🏗️ **[Technical Architecture Specification](./docs/ARCHITECTURE_SPEC.md)**
* 🚀 **[Step-by-Step Implementation Playbook](./docs/STEP_BY_STEP_PLAYBOOK.md)**
* 📦 **[Final Submission & Video Demo Checklist](./docs/SUBMISSION_CHECKLIST.md)**

---

## 🏆 Targeted Hackathon Tracks

*Per [Getting Started Guide (Aug 24)](https://www.wemakedevs.org/blogs/agent-harness-hackathon-kick-off) — $10,000 total:*

* 🥇 **Double-O / Grand Prize ($5,000 NVIDIA DGX Spark):** Deep use of TrueForge runtime — real MCP tools, sandboxed execution (Docker/Daytona), HITL approvals, subagents, persistent sessions, skills, context management.
* 🥈 **Q Branch (Mac Mini):** Code quality with **Qodo throughout development** (via [app.qodo.ai](https://app.qodo.ai/signin) + PR-Agent) — repo-context reviews, fix what it finds before merging.
* 🌐 **Universal Exports (Interview at TrueFoundry):** Top projects earn interview — no separate track to enter.
* 📝 **Field Report (Keychron Keyboard):** Best blog post on Dev.to/Hashnode/Medium.
* ⭐ **Calling Card (Logitech MX Master 3):** Star [truefoundry/trueforge](https://github.com/truefoundry/trueforge) → draw entry, no project required.
* 📻 **Radio Traffic (Swag ×10):** Top 10 social posts tagging `@WeMakeDevs` + `@TrueFoundry`.

> **Savile Row (UI/UX iPad)** was the pre-kickoff “Best UI” track — kick-off guide folds that polish into Double-O/Q Branch. The `ModuleSwitcher` + `AgentTimeline` + `TerminalStream` + `ApprovalModal` still win your video; keep it.

