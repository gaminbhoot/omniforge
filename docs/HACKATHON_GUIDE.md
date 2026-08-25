# 🏆 TrueForge Hackathon: Master Dossier & Strategy Guide

**Event:** The Agent Harness Hackathon (Powered by TrueForge)  
**Organizers:** [WeMakeDevs](https://www.wemakedevs.org) & [TrueFoundry](https://www.truefoundry.com) (with [Qodo](https://www.qodo.ai))  
**Theme:** *Mission Dossier: File TF-007 (James Bond / Secret Agent Theme)*  
**Official Portal:** [https://www.wemakedevs.org/hackathons/trueforge](https://www.wemakedevs.org/hackathons/trueforge)  
**TrueForge Upstream Repo:** [https://github.com/truefoundry/trueforge](https://github.com/truefoundry/trueforge)  
**Project Repository:** [https://github.com/gaminbhoot/omniforge](https://github.com/gaminbhoot/omniforge)

---

## 📌 Critical Links & Resources

| Resource | URL | Purpose |
| :--- | :--- | :--- |
| **Official Hackathon Portal** | [wemakedevs.org/hackathons/trueforge](https://www.wemakedevs.org/hackathons/trueforge) | Registration, updates, submission portal |
| **TrueForge Core Engine** | [github.com/truefoundry/trueforge](https://github.com/truefoundry/trueforge) | Official Agent Harness framework (Star required) |
| **Model Context Protocol (MCP)** | [modelcontextprotocol.io](https://modelcontextprotocol.io) | Tool definition standard for LLMs |
| **Qodo Merge (PR Agent)** | [github.com/apps/qodo-merge](https://github.com/apps/qodo-merge) | Automated AI PR review tool (Q Branch track) |
| **WeMakeDevs Community** | [discord.gg/wemakedevs](https://discord.gg/wemakedevs) | Matchmaking, general announcements |
| **TrueFoundry Discord** | [discord.gg/truefoundry](https://discord.gg/truefoundry) | Technical support, harness debugging |

---

## ⏱️ Timeline & Deadlines

* **Registration:** Open now on [WeMakeDevs Portal](https://www.wemakedevs.org/hackathons/trueforge).
* **Hackathon Kickoff Livestream:** **Monday, August 24, 2026 @ 8:00 AM London Time (8:00 AM PDT / 12:30 PM IST)**.
* **Building Period:** August 24 – August 30, 2026.
* **Optional SF In-Person Build Day:** Saturday, August 29, 2026 (San Francisco, CA).
* **Final Submission Deadline:** **Sunday, August 30, 2026 @ 8:00 PM London Time (12:00 PM PDT / 12:30 AM IST next day)**.

> **You are not behind** (per kick-off guide) — you don't need to learn every TrueForge part before building. Pick a workflow where someone gathers info, moves between tools, or repeats steps, and let the agent take over that workflow.

---

## 🚀 Getting Started — From Kick-off Guide (Aug 24)

> **Source:** [agent-harness-hackathon-kick-off](https://www.wemakedevs.org/blogs/agent-harness-hackathon-kick-off) — Steps to go from empty workspace to reusable agent.

**What makes this hackathon different:** Not a chat wrapper. Judges want an agent that **does work**: retrieve via tools, work with APIs/data sources, execute generated code, process files/data, delegate to subagents, carry context across sessions, and **stop to ask a human before important actions**. TrueForge provides the runtime (MCP tools, skills, sandboxing, approvals, subagents, context management, persistent sessions). Qodo ensures the *code behind it* is shippable.

**The gap to solve:** LLMs explain what to do; the harder problem is an AI system that **reliably does it** — investigate a prod issue (not just advise), research a market across sources with subagents and remember it later, clean/transform data by generating and safely executing code.

### TrueForge — 7 Steps to First Agent (Node 22+, `npx @truefoundry/trueforge`)

1. **Run TrueForge** — `npx @truefoundry/trueforge` → open `http://localhost:8790` (single process, SQLite, local-only; keep on localhost)
2. **Add model provider** — `Settings → Models` → choose provider from catalog → add API key → models become selectable
3. **Connect MCP tool** — `Settings → Connectors` → pick from built-in catalog or add by URL → agent can then *use* the tool, not just describe it
4. **Add skill** — `Settings → Skills` → skills are git-backed `SKILL.md` instruction packs → enable from built-ins or import from GitHub. *Tools give capabilities; skills give reusable instructions for using them.*
5. **Add sandbox** — `Settings → Sandbox providers → Daytona` → create Daytona API key with required perms → add key → agent now has isolated exec. *Local `omniforge-sandbox` Docker (this repo) is the dev fallback; Daytona is the hosted option.*
6. **Compose agent** — back to chat → choose model → open `Tools` → enable `Connectors`, `Skills`, `Dynamic sub-agents`, `Sandbox`
7. **Save agent** — `Save Agent` → name + instructions → model/connectors/skills/instructions captured → found in `Agents Library` for new sessions

### Qodo — 5 Steps to Shippable Code (per kick-off guide)

1. **Create Qodo account** — [app.qodo.ai/signin](https://app.qodo.ai/signin) (Google/GitHub/email) — accept team invite first if invited
2. **Connect Git account** — link Git so Qodo identifies you across PRs/commits → install Qodo app on your hackathon repo
3. **Connect tools (optional)** — link Jira / Linear / Azure DevOps to tie code changes to issues
4. **Open a PR** — Qodo auto-reviews with **full repo context** (structure, deps, history) — surfaces bugs/risks/standards, explains and prioritizes
5. **Fix what Qodo finds** — don't wait until submission day; address meaningful issues as you build — this is the Q Branch signal

> **OmniForge note:** This repo already has Qodo PR-Agent via `.pr_agent.toml` + `qodo_review.yml` (GitHub App at `github.com/apps/qodo-merge`). The `app.qodo.ai` flow above is the newer platform — either satisfies Q Branch if PRs show review comments + fixes. Keep `.pr_agent.toml` and also follow the 5 steps if you have a Qodo team.

### What Can You Build? (Kick-off Guide Examples)

> **Start with a workflow where someone gathers info, decides, moves between tools, or repeats steps. Then ask: can the agent take over a meaningful part?** The agent should *do work*, not generate an answer. Examples (you don't need to pick one):

* **Developer operations agent:** Failed deployment/prod issue → inspect via MCP, split investigation across subagents, run diagnostics in sandbox, prepare fix, **ask before sensitive action**. Qodo reviews the connector code.
* **Research agent:** Company/tech/market → gather via external tools, delegate research tasks to subagents, process findings, keep context for return visits. Repo must show how workflow/tools/prompts/logic fit together, not just the report.
* **Data workflow agent:** Files needing clean/analyze/transform → collect inputs, generate code, **execute inside sandbox**, inspect output, decide next step. Sandbox is there because the agent *needs safe exec*, not as a feature checkbox.
* **Engineering workflow agent:** Dev task → gather repo context, use external eng tools, run/test inside sandbox, ask before non-automatic actions. Natural Qodo-in-PR fit since the project *is* software.
* **Operations agent:** Multi-tool, decision-heavy, repetitive workflow → gather info, follow reusable `SKILL.md` instructions, auto safe actions, stop for human confirmation.

**OmniForge maps 1:1:** OpsForge = dev-ops, SecurForge = engineering, DataForge = data workflow — each is a vertical slice of the pattern above with its own HITL gate.

---

## 🎯 Competition Tracks & Prize Strategy

---

## 🎯 Competition Tracks & Prize Strategy

> **Source (Aug 24 Kick-off):** [Getting Started Guide — Agent Harness Hackathon](https://www.wemakedevs.org/blogs/agent-harness-hackathon-kick-off) — $10,000 total + interviews. Pre-kickoff spec listed 5 tracks incl. Savile Row (iPad); kick-off guide lists 6 prizes below. Judging still evaluates harness depth, code quality, and usefulness — build for **useful work, not a chat wrapper**.

Every valid submission is evaluated for the primary tracks (a team can win at most one main track — Double-O vs Q Branch):

### 1. 🥇 Grand Prize — Double-O Track: "Best Use of TrueForge" (Presented by TrueFoundry)
* **Prize:** **NVIDIA DGX Spark** ($5,000 Personal AI Supercomputer)
* **Winning Criteria (per kick-off guide):** Deepest effective use of the harness — real MCP tools, **sandboxed code execution** (Daytona or local Docker), **human approvals** before sensitive actions, **subagents** for parallel work, **persistent sessions** + context management/compaction, and other TrueForge capabilities (skills, etc.). The agent must **do work** (retrieve via tools, use APIs, execute code, process files/data, delegate to subagents, carry context) not just generate an answer.

### 2. 🥈 Q Branch Track: "Best Code Quality" (Presented by Qodo)
* **Prize:** **Apple Mac Mini**
* **Winning Criteria:** Looks like real software, not a hackathon demo. Engineering rigor, high test coverage, clean modular architecture, and **active use of Qodo throughout development** (connect repo via [app.qodo.ai](https://app.qodo.ai/signin), link Git, install app, open PRs, address findings). Qodo reviews with **full repo context**, not just diff. Top Q Branch repos are cloneable, understandable, and extendable.

### 3. 🌐 Universal Exports — Job Interviews at TrueFoundry
* **Prize:** **Interview opportunity with TrueFoundry** (team behind TrueForge)
* **No separate track to enter.** Top projects across all tracks are invited. Nothing to apply for.

### 4. 📝 Field Report Track: "Best Technical Blog Post"
* **Prize:** **Keychron Mechanical Keyboard**
* **Winning Criteria:** Tell the story of what you built — problem chosen, how TrueForge helped, what broke, what you learned. Publish on Dev.to / Hashnode / Medium.

### 5. ⭐ Calling Card — Star the Repo Draw
* **Prize:** **Logitech MX Master 3**
* **How to enter:** Star the [TrueForge GitHub repo](https://github.com/truefoundry/trueforge) → entered into draw. **No project required.**

### 6. 📻 Radio Traffic: "Community Swag — Top 10 Social"
* **Prize:** **Swag Packs for Top 10** most active sharers.
* **How to win:** Share what you're building — clip of agent working, surprising result, bug encountered. Tag `@WeMakeDevs` and `@TrueFoundry` on X / LinkedIn so posts can be found.

> **Legacy note:** Pre-kickoff docs listed **Savile Row — Best UI/UX (iPad × team)** for live thought trace + terminal + approval UX. The kick-off guide doesn't list Savile Row as a separate prize; that polish now counts toward Double-O (agent does useful work *visibly*) and Q Branch (real software). Keep Savile Row polish — it still wins video/crowd — but submit expecting the 6 prizes above.

---

## 📜 Key Hackathon Rules

1. **Originality:** Ideas can be conceptualized beforehand, but actual code implementation must be committed during the hackathon period (Aug 24–30).
2. **True Harness Utilization:** Pure prompt wrappers or un-orchestrated OpenAI/Anthropic API calls without harness runtime capabilities will be disqualified.
3. **Safety & Security:** No hardcoded secrets or API keys in public repositories. All dynamic agent commands must run inside sandboxes.
4. **Deliverables:** Public GitHub repository + comprehensive README + 3-minute video demo.

