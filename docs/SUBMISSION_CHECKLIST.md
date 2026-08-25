# 📦 OmniForge: Final Submission & Deliverables Checklist

**Submission Deadline:** Sunday, August 30, 2026 @ 8:00 PM London Time (12:00 PM PDT)  
**Submission Portal:** [https://www.wemakedevs.org/hackathons/trueforge](https://www.wemakedevs.org/hackathons/trueforge)

---

## 🎯 Mandatory Deliverables Checklist

- [ ] **1. Public GitHub Repository:**
  - URL: [https://github.com/gaminbhoot/omniforge](https://github.com/gaminbhoot/omniforge)
  - Must be public with an open-source license (MIT Apache 2.0).
  - Contains complete source code, tests, and configurations.
- [ ] **2. Polished `README.md` for Judges:**
  - Clear 1-sentence value proposition.
  - Architecture diagram showing TrueForge, MCP, Sandboxing, and HITL gates.
  - Step-by-step instructions to run locally (`docker compose up` or `npm run dev`).
  - Environment variable setup guide.
  - Explanation of how each judging track criteria is satisfied.
- [ ] **3. 3-Minute Video Demo:**
  - Hosted on YouTube (Unlisted or Public) or Loom.
  - Clearly demonstrates:
    1. Agent receiving a task and reasoning step-by-step.
    2. Model Context Protocol (MCP) tool invocation.
    3. Safe command execution inside the Docker sandbox.
    4. **The Human-in-the-Loop (HITL) approval gate pausing execution** and continuing upon approval.
    5. Clean visual UI and Qodo code quality review trail.
- [ ] **4. Project Write-up on Submission Form:**
  - Problem Statement
  - Solution & Architecture
  - How TrueForge was utilized
  - Challenges faced & future roadmap
- [ ] **5. (Optional - Field Report Track) Technical Blog Post:**
  - Published on [Dev.to](https://dev.to), [Medium](https://medium.com), or [Hashnode](https://hashnode.com).
  - Deep-dive into building autonomous agents with TrueForge and MCP.
- [ ] **6. (Optional - Community Swag) Social Media Share:**
  - Share a video preview on X (Twitter) or LinkedIn tagging `@WeMakeDevs` and `@TrueFoundry`.

---

## 🎬 3-Minute Demo Video Script Guide

```text
[0:00 - 0:30] The Hook & Problem
- "Autonomous agents are powerful, but giving LLMs direct access to production servers, databases, and codebases is risky. Unchecked agents can break production, wipe databases, or run dangerous scripts."
- "Introducing OmniForge: An Autonomous Multi-Agent Mission Control Platform powered by TrueForge, Model Context Protocol, and Qodo."

[0:30 - 1:15] Architecture Walkthrough
- Show the architecture diagram:
  - TrueForge Orchestrator managing specialized subagents (OpsForge, SecurForge, DataForge).
  - FastMCP tool servers connecting to system logs, Git, and databases.
  - Isolated Docker Sandbox executing all dynamic code safely.
  - HITL Policy Engine enforcing human oversight.

[1:15 - 2:15] Live Action & The "Wow" Factor
- Trigger a real-world scenario (e.g. SRE Incident Outage):
  - Agent ingests the error alert and fetches container metrics via MCP.
  - Agent spins up the Docker sandbox and runs diagnostic scripts.
  - THE HITL GATE: The UI pops up an interactive approval modal showing the exact command (`kubectl rollout restart`).
  - The human clicks "Approve". The agent executes the fix and confirms system recovery.

[2:15 - 2:45] Qodo Code Quality & Multi-Agent Switcher
- Show the AppSec module creating a patch and show the GitHub Pull Request with Qodo PR-Agent's automated code review and test suite.
- Show the DataOps module with sandboxed ETL schema validation.

[2:45 - 3:00] Closing & Call to Action
- "OmniForge delivers autonomous power with production safety. Built for the TrueForge Hackathon."
```

---

## 🔗 Submission Form Reference Data

| Field | Content to Enter |
| :--- | :--- |
| **Project Name** | OmniForge |
| **Tagline** | Autonomous Multi-Agent Mission Control Platform with Sandboxed Execution & HITL Governance |
| **Repository URL** | [https://github.com/gaminbhoot/omniforge](https://github.com/gaminbhoot/omniforge) |
| **Technologies Used** | TrueForge (MCP, Skills SKILL.md, Sandbox Daytona + Docker, Approvals, Subagents, Persistent Sessions), Qodo (app.qodo.ai + PR-Agent), Next.js, React, Tailwind CSS, TypeScript, Python (pandas/DuckDB) |
| **Tracks Targeted** | Double-O Grand Prize (Best TrueForge — DGX Spark), Q Branch (Code Quality — Mac Mini), Universal Exports (Interview), Field Report (Blog — Keychron), Calling Card (Star draw — Logitech MX Master 3), Radio Traffic (Swag) — *Savile Row UI polish folded into Double-O/Q Branch per kick-off guide* |
| **Kick-off Source** | [Getting Started Guide — Agent Harness Hackathon (Aug 24)](https://www.wemakedevs.org/blogs/agent-harness-hackathon-kick-off) — Steps to run `npx @truefoundry/trueforge`, add model/MCP/skill/sandbox, compose agent |

