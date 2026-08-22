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

## 🚀 Quick Start (Phase 0 Scaffold)

```bash
# 1. env
cp .env.example .env

# 2. install (use /tmp cache if npm perms complain)
npm install --cache /tmp/npm-cache

# 3. dev — runs web (5173) + server (3001) concurrently
npm run dev

# or individually:
npm run dev:web      # Mission Control → http://localhost:5173
npm run dev:server   # Orchestrator  → http://localhost:3001/api/health

# 4. sandbox (optional, Docker)
docker compose up -d sandbox
docker exec omniforge-sandbox python /usr/local/bin/runner.py <<< '{"language":"python","code":"print(42)"}'

# 5. build
npm run build
```

> Server is a Phase 0 stub mirroring TrueForge's API — swap `apps/server/src/orchestrator.ts` internals on Aug 24 when the harness drops. Web needs zero changes.

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

* 🥇 **Double-O Track ($5,000 NVIDIA DGX Spark):** Deep use of TrueForge runtime, MCP tools, Docker sandboxing, and HITL approval gates.
* 🥈 **Q Branch Track ($1,000 Apple Mac Mini):** Continuous automated PR reviews and test generation using Qodo.
* 🥉 **Savile Row Track (Apple iPads):** Modern mission-control UI with live execution streams, sandbox terminal, and interactive approval modals.

