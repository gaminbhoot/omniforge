# 🔍 OmniForge — Gap Analysis & Recommendations

**Mission:** TF-007 — Autonomous Multi-Agent Mission Control Platform
**Date:** 27 August 2026 — Phase 3 (Days 4–5: HITL & Cockpit), 3 days to deadline
**Basis:** Full read of all 7 repo docs + the official [kick-off guide](https://www.wemakedevs.org/blogs/agent-harness-hackathon-kick-off) + inspection of the installed `@truefoundry/trueforge@0.1.4` package + live verification of the running system (build/tests/API probes on 27 Aug).
**Context:** Bug-hunt fixes landed on `main` (27 Aug): HITL gate pause enforcement, step-ID collisions, web API error surfacing, SSE wildcard CORS (SA-06 ✅), MCP input-injection guards, sandbox exec timer hygiene, runner.py timeout robustness. Verifier: PASS, tests 8/8.

---

## 1. Verdict in One Paragraph

OmniForge is a "Mission Control" cockpit for governed agent execution: the judging hinge is the HITL gate matrix (LOW→auto, MEDIUM→Docker-sandbox-only, HIGH/CRITICAL→human 1-click) rendered through `ApprovalModal`, with three vertical slices (OpsForge/SecurForge/DataForge) and a self-built spec verifier + Qodo PR-Agent CI for the code-quality track. The docs suite is judge-grade. The critical gap is **substance vs. claim**: the TrueForge harness integration asserted in the README does not exist in code, and the Q Branch evidence trail (PR reviews) is empty. Both are fixable in the remaining window — but only if prioritized above further polish.

---

## 2. What Is Verified Working ✅

| Item | Evidence |
|---|---|
| HITL policy engine + gate integrity | `hitl.ts` 15 tools correctly tiered; `verifier:hitl-integrity:pass`; **now also enforced at session level** (proposals blocked while a gate is pending — fixed 27 Aug) |
| Sandbox isolation primitives | `Dockerfile` non-root `agent:1000`; compose `no-new-privileges`, `cap_drop:ALL`, 512m/1cpu; `runner.py` contract intact |
| Secrets hygiene (repo) | `.env` untracked; `gitleaks.yml` on push/PR; `verifier:security-secrets:pass` |
| CI present | `test_ci.yml`, `qodo_review.yml` (PR-triggered), `gitleaks.yml` |
| Cockpit UI scaffold | All 5 components from the directory contract exist and build |
| Verifier + monitor | `npm run verify:once` PASS; reports in `tmp/codex-monitor/` |

---

## 3. The Gaps (real vs. claimed) — Ranked by Consequence

### GAP-1 — The TrueForge integration is claimed but does not exist [CRITICAL — DQ RISK]
- README.md:71 says the server "talks to a real TrueForge harness at `http://localhost:8790`" — **zero references to the harness in any source file**.
- `.env` keys `TRUEFORGE_API_URL`, `TRUEFORGE_API_KEY`, `QODO_ENABLED`, `SANDBOX_IMAGE/MEMORY/CPUS` are **dead config** — unused anywhere.
- `apps/server/src/llm/client.ts` is dead code — the orchestrator never calls an LLM. Every timeline step and tool output is a string template from `orchestrator.ts:mockOutput()`.
- The installed harness exposes a real HTTP API (inspected in `dist/main.js`): `/api/v1/agents`, `/api/v1/sessions`, `/api/v1/mcp-servers`, `/api/v1/skills`, `/api/v1/sandbox-providers`, `/api/v1/models`.
- **Why it matters:** Hackathon rule 2 — *"Pure prompt wrappers or un-orchestrated API calls without harness runtime capabilities will be disqualified."* The OmniForge server is currently exactly that. The Double-O rubric ("real MCP tools, sandboxed execution, approvals, subagents, persistent sessions") is evaluated against the harness.

### GAP-2 — Q Branch evidence is zero [HIGH — track-losing]
- Kick-off guide: *"⚠️ Direct pushes to `main` do not count as reviewed work."* All work so far — including the 27 Aug bugfix batch — went direct to `main`.
- `qodo_review.yml` fires only on pull requests; **no PR has ever been opened** in this repo.
- Q Branch requires a **"Qodo Code Review Evidence"** README section with public PR links (per kick-off guide Step 5) — not present.

### GAP-3 — Phase 3 acceptance criteria are half-met [HIGH — the docs' own DoD]
Per `EXHAUSTIVE_REPORT.md` §5.2 / US-11 / US-23 and audit SA-10:
- [x] Approve path pauses → executes
- [x] Reject recorded (in-session)
- [x] **Reject → feedback → agent replans** (closed 27/28 Aug: feedback becomes the agent's next observation, mission continues `running`, one-click alternative suggestion surfaced in the Cockpit via `↻ Apply agent replan` button)
- [ ] **5-minute timeout → auto-reject** (absent)
- [ ] **Re-approval required after parameter change** (absent)
- [ ] **Durable audit log** (`session_cache/audit.jsonl`) — absent; steps live only in an in-memory Map

### GAP-4 — Audit P3/P4 hardening items still open [MEDIUM]
| ID | Item | Effort | Status |
|---|---|---|---|
| SA-01 | `chmod 600 .env` (+ rotate key at provider) | 5 min | Open |
| SA-02 | compose `read_only:true`, `pids_limit:128`, drop runtime `cap_add: SETUID/SETGID/CHOWN` | 1 h | Open |
| SA-04 | `X-API-Key` + session scoping + SSE `?token=` | 2 h | Open |
| SA-05 | `helmet` + `express-rate-limit` | 30 min | Open |
| SA-06 | SSE wildcard CORS | 10 min | ✅ Closed 27 Aug |
| SA-08 | zod arg schemas + code-size/timeout caps | 1 h | Open (partial: tool-type validation added 27 Aug) |
| SA-09 | DOMPurify / react-markdown for `AgentTimeline` | 30 min | Open (`esc()` covers `<`/`&` only) |
| SA-10 | Audit log + approval expiry + idempotency | 1.5 h | Open (= GAP-3 last two items) |

### GAP-5 — Demo terminal output is mock strings [MEDIUM — video credibility] — ✅ CLOSED 27/28 Aug
`run_diagnostic_script` / `test_exploit` / `run_etl_script` now execute **for real** via `sandboxExec` (Docker; dev fallback `localExec` per SA-03) and stream genuine `{exitCode, stdout, stderr, timedOut}` into the step → `TerminalStream`. Verified live: real Python 3.14 stdout rendered in the timeline. LOW/host tools (read_logs, metrics, …) remain deterministic mocks — acceptable; they are reads, not execs.

---

## 4. Recommendations — Prioritized for Aug 27–30

### P0 — Aug 27–28 (these decide the outcome)

**R1. Kill the DQ risk: integrate the real harness (GAP-1).**
Cheapest deep path:
1. Register the three local MCP servers in the harness (`Settings → Connectors`, stdio) so the saved agents `ops-forge / secur-forge / data-forge` run **our** tools.
2. Have `apps/server` proxy session steps from `GET /api/v1/sessions` on `:8790` into the Cockpit UI (`.env` keys already provisioned for this).
3. Keep our HITL engine as the governance layer wrapping harness tool calls (`require_approval_for_tools: ["@write","@destructive"]` mirrors it harness-side).
Reference: the official [example agents cookbook](https://github.com/truefoundry/trueforge/tree/examples/agent-cookbook/examples).
*Do this on a branch (see R2). Even a thin bridge — harness loop + our MCP + our HITL + our UI — converts the story from "parallel mock" to "deep harness use."*

**R2. Switch to PR flow immediately (GAP-2).**
- Next slice of work (R1) goes on `feat/harness-bridge` → PR → `qodo_review.yml` fires → fix High findings → merge.
- Add the README **"Qodo Code Review Evidence"** section (1 representative merged PR + what Qodo found + what changed).
- One reviewed PR beats ten direct pushes.

**R3. Make the demo terminal real (GAP-5).** ✅ Done 27/28 Aug — sandbox tools route through `sandboxExec`; real stdout streams to `TerminalStream`.
**R4. Finish Phase 3 DoD (GAP-3):** ~~reject→feedback→replan~~ ✅ done; remaining: 5-min timeout auto-reject, `session_cache/audit.jsonl`, re-approval on param change.
**R5. Record the HITL modal GIF as backup** (risk R4 in the risk register) — one flake on camera = reshoot at deadline.
**R6. P3/P4 audit batch (GAP-4):** SA-01 (chmod + rotate), SA-02, SA-04, SA-05, SA-08, SA-09.

### P2 — Aug 29–30

**R7.** 3 E2E golden-path walks on camera (Ops → Sec → Data); branch protection on `main`.
**R8.** Video per beat sheet → YouTube unlisted + Loom backup → blog (Field Report) → portal submit **by 11:00 PDT**; freeze `main` 10:00 PDT.

### Free points anytime
- ⭐ Star [`truefoundry/trueforge`](https://github.com/truefoundry/trueforge) — Calling Card draw (no project required).
- 📻 Radio Traffic: 5 posts tagging `@WeMakeDevs` + `@TrueFoundry` (kickoff/sandbox GIF/HITL GIF/Qodo thread/submission).
- ✍️ Field Report: blog outline already exists in `BLOG_OUTLINE.md`.
- 🔍 Refresh the stale verifier verdict (`tmp/codex-monitor/latest.json` is from 22 Aug): `npm run verify:once`.

---

## 5. What Was Deliberately Deferred (and why)

| Item | Reason |
|---|---|
| SSE change-detection / delta protocol | Cosmetic perf; full-state poll works for demo scale |
| LLM client rework (provider abstraction) | Dead code until R1 lands; then harness replaces it |
| SQLite session store (SA-12) | P4 optional; in-memory fine for demo |
| More unit tests | Current 8 cover the judging hinge; add after R1/R3 |

---

*Generated 27 Aug 2026 after full-doc review + live system verification. Companion context: `SECURITY_AUDIT_REPORT.md` (findings register), `STEP_BY_STEP_PLAYBOOK.md` (phases), `SUBMISSION_CHECKLIST.md` (deliverables).*
