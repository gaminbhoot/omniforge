# 🛡️ OmniForge — Security Audit Report (SAE Deep Dive)

**Mission:** TF-007 — Autonomous Multi-Agent Mission Control Platform  
**Date:** 25 August 2026 — Phase 2 (Days 2–3: Subagents & Docker Sandboxing)  
**Auditor:** Internal SAE — Codex Security Audit Engine (manual + verifier harness)  
**Spec refs:** `ARCHITECTURE_SPEC.md`, `STEP_BY_STEP_PLAYBOOK.md:Phase 0→5`, `EXHAUSTIVE_REPORT.md:§9`, `.github/workflows/gitleaks.yml`, `packages/verifier/src/spec.ts`  
**Verdict snapshot:** `tmp/codex-monitor/latest.json` → **PASS 7/10** (`security-secrets:pass`, `hitl-integrity:pass`, `no-bypass:pass`, `sandbox-isolation:pass` + 3 skipped) — manual audit concurs with 1 Critical (local-only) + 6 Medium/High hardenings required before Phase 3.

---

## 1. Executive Summary

Phase 2 hardens the core judging hinge — **sandboxed execution + HITL gates**. The codebase is **fundamentally sound** and on schedule: policies enforce `LOW→auto / MEDIUM→sandbox-only / HIGH+CRITICAL→human 1-click`, Docker isolation is correctly scoped, secrets are not in git, and no approval-bypass exists. The verifier confirms this.

The remaining risk is **operational hardening, not architectural flaw**. One Critical finding is confined to the developer workstation (plaintext `.env` credential) and does not affect the repo history, but must be closed before exposing the orchestrator. Six Medium/High items — unauthenticated API/SSE, missing rate-limit/helmet, `localExec` host fallback, unbounded code payloads, and a frontend XSS surface — are typical Phase-2 debt and map cleanly onto the Phase 3/4 hardening window.

**If the 4 High-priority fixes land by 28 Aug (Phase 3 exit), OmniForge enters Phase 4 (E2E + Qodo) with a clean security posture for the 30 Aug submission.**

> Schedule context: `STEP_BY_STEP_PLAYBOOK.md` phases — P0 Setup (22–23) ✅, P1 Harness+MCP (24) ✅, **P2 Sandboxing (25–26) ← you are here**, P3 HITL+Cockpit (27–28), P4 Testing+Qodo (29), P5 Video+Submission (30 20:00 London).

---

## 2. Audit Scope & Methodology

### 2.1 Scope — Phase 2 Gate

| Layer | In scope | Out of scope (P3/P4) |
|---|---|---|
| 1 UI (Vite/React) | `AgentTimeline.tsx`, `ApprovalModal.tsx`, `TerminalStream.tsx` XSS/CSP, HITL UX | Full WCAG, perf |
| 2 Orchestrator | `apps/server/src/index.ts`, `orchestrator.ts`, `routes/missions.ts`, `routes/stream.ts`, `policies/hitl.ts`, `policies/router.ts`, `llm/client.ts` | TrueForge remote harness swap |
| 3 Subagents | Intent router + dispatch prompt templates | LLM classifier (P2+ swap) |
| 4 MCP + Sandbox | `packages/sandbox/{Dockerfile,runner.py}`, `packages/mcp-tools/src/shared/sandboxExec.ts`, `docker-compose.yml` | ClickHouse/Postgres prod hardening |
| 5 QA | `packages/verifier/src/spec.ts/checks`, `.github/workflows/*.yml` | Qodo Gen (P4) |

### 2.2 Methodology

1. **Static diff + history scan** — `git log`, `git diff`, `git ls-files --cached`, `gitleaks` workflow, `rg` for secret patterns.
2. **Policy simulation** — replayed `evaluate("restart_service",{})` → `CRITICAL/approval`, `run_diagnostic_script` → `MEDIUM/sandbox`, unknown tool → `HIGH/host` against `hitl.ts:POLICIES`.
3. **Container review** — `Dockerfile` + `docker-compose.yml` vs CIS Docker Benchmark + `verifier/checks:sandbox-isolation`.
4. **Threat modeling** — STRIDE per trust boundary (operator → UI → API → subagent → MCP → sandbox → DB/host), OWASP Top 10 2021 + LLM Top 10 2025.
5. **Verifier cross-check** — `POST /api/verify` equivalent + `tmp/codex-monitor/latest.json` 10 checks.

### 2.3 Trust Boundaries

```
[Operator Browser] --(CORS/SSE)--> [Express API :3001] --(evaluate/proposeTool)--> [HITL Gate] --(approval token)--> [Human]
                                         |                           \
                                         v                            v
                                   [Session Memory]            [MCP Servers] --(sandboxExec)--> [Docker sandbox: omniforge-sandbox]
                                         |                                                        ^    |
                                         v                                                        |    v
                                   [LLM Adapter]                                           [workspace:/workspace rw] [host fallback localExec]
```

Every `MEDIUM` must stay inside the Docker box; every `HIGH/CRITICAL` must pause on `pendingApproval` until `POST /:id/approval {approved:boolean}`.

---

## 3. Architecture Security Posture (by layer)

| Layer | Strengths (evidence) | Debt |
|---|---|---|
| L2 Orchestrator | `orchestrator.ts:proposeTool` always calls `evaluate()`; `verifier/checks/hitl-integrity:pass`; `express.json({limit:"1mb"})` | No helmet/rate-limit, in-memory `sessions Map` (no persistence/isolation) |
| L4 Sandbox | `Dockerfile: non-root agent (uid 1000)`, `docker-compose: no-new-privileges:true, cap_drop:ALL`, `mem_limit 512m, cpus 1.0`, isolated `omniforge` net, `runner.py: capture_output, timeout` | `read_only:false`, `localExec` host spawn, no pids limit, workspace rw |
| HITL Matrix | `hitl.ts:POLICIES` 15 tools correctly tiered; `create_patch_pr:HIGH`, `execute_write:CRITICAL` | No audit log, no idempotency token expiry, no actor attribution |
| Secrets | `.gitignore:.env`, `.env.example` clean, `gitleaks.yml` on push/PR, `verifier:security-secrets:pass` | Live `.env` on disk (Critical, see SA-01) |
| API Surface | Minimal routes (5), typed `zod` available | Unauthenticated, SSE wildcard ACAO, verbose LLM errors |

---

## 4. Detailed Findings Register

Severity: **Critical** > High > Medium > Low. Each entry: Problem → Cause → Evidence → Impact → Fix (with effort & schedule slot).

### SA-01 — Live Credential in Plaintext `.env` on Developer Host [CRITICAL]

- **Problem:** `/.env:9-14` contains a real, active credential `ANTHROPIC_API_KEY=LLM_1520516176610290_85rGzWUeUDdqvU-kln-MfqnGjZo` with `ANTHROPIC_BASE_URL=https://api.meta.ai` and `ANTHROPIC_MODEL=muse-spark-1.2-contributor`. Any disk read, backup, screenshot, or `docker compose` env propagation leaks it.
- **Cause:** Early Phase-0 convenience — copied provider key into `.env` for `llm/client.ts:getLLMConfig()`. `.gitignore` correctly blocks commit, but no file-permission hardening, no secrets manager, and no rotation discipline.
- **Evidence:** `cat .env` shows non-placeholder value; `git ls-files --cached | grep .env` → empty (not committed); `.env.example` is clean (`ANTHROPIC_API_KEY=`); `verifier:security-secrets:pass` only scans diff, not disk state. Risk is local, not historic.
- **Impact:** Confidentiality C-4. Key can be used to incur LLM spend, poison demo traces, or pivot if the custom Meta endpoint reuses the token elsewhere. Hackathon judges will flag hardcoded secrets if accidentally staged (`git add -f`).
- **Fix (P2 — today, 30 min):**
  1. `chmod 600 .env && chmod 600 .env.*` and add to `AGENT_WORKFLOW_GUIDELINES.md` pre-commit check.
  2. Rotate/revoke `LLM_1520...` at provider, issue scoped dev key with spend cap; inject via `direnv` or `gh secret` / 1Password Connect, not file.
  3. Patch `llm/client.ts:sendLLMMessage` to never `throw new Error(...errText)` with raw body — return `status` + redacted excerpt.
  4. Add `scripts/check-secrets.sh` (`gitleaks detect --source=. --no-git -v` + `rg -n "LLM_\d+"`) to `test_ci.yml` as `security` job.
  5. Document: `README.md` “never commit .env; use `.env.example` + `ANTHROPIC_API_KEY` from vault”.
  *Effort: S. Owner: platform.*

### SA-02 — Sandbox Container Not Read-Only, Broad Filesystem + No PID Limit [HIGH]

- **Problem:** `docker-compose.yml:sandbox` runs `read_only:false`, `tmpfs:[/tmp]` only, no `pids_limit`, `cap_add: [CHOWN,SETUID,SETGID]`. Workspace mount is `packages/sandbox/workspace:/workspace:rw` from host. An exploited `run_diagnostic_script` or `test_exploit` could mutate image layer, fork-bomb, or traverse via symlink into host workspace.
- **Cause:** Dev ergonomics — read-only breaks `pip`/`apt` iteration and `workspace` rw eases debugging. Caps added for `useradd`/`chown` at build but not needed at runtime.
- **Evidence:** `docker-compose.yml:12-20`; `Dockerfile: RUN useradd -m -u 1000 agent && mkdir -p /workspace && chown agent:agent`; `security_opt: no-new-privileges:true` mitigates but does not replace `read_only`.
- **Impact:** Integrity I-3, Availability A-3. Escape is still blocked by `no-new-privileges` + `cap_drop:ALL`, but privilege retention and rw root increase blast radius if a Python dep is compromised.
- **Fix (P2, 1 h):**
  ```yaml
  read_only: true
  tmpfs: [/tmp, /workspace/.tmp]
  pids_limit: 128
  cap_drop: [ALL]   # drop CHOWN/SETUID/SETGID at runtime; keep for build only
  # optional: seccomp:unconfined → default, add apparmor profile
  ```
  1. Mount workspace as `:ro` by default; only `run_etl_script` gets an explicit rw sub-mount via `docker exec` into `/workspace/job_<id>`.
  2. Add `ulimit -u 256` + `ulimit -f` in `entrypoint.sh`.
  3. Verify: `docker run --read-only --rm omniforge-sandbox python -c "open('/usr/test','w')"` must fail.

### SA-03 — `sandboxExec` Host Fallback Executes Code on Host [HIGH]

- **Problem:** `packages/mcp-tools/src/shared/sandboxExec.ts:6` checks `SANDBOX_DOCKER !== "false"` then `try dockerExec else catch→localExec`. `localExec:53` spawns `spawn("bash",["-c",req.code])` / `spawn("python3",["-c",req.code])` directly on the host. If Docker is down (common on judges’ laptops), a `MEDIUM` tool like `run_diagnostic_script` silently becomes host execution, violating “every dynamic exec in Docker” (Double-O rubric).
- **Cause:** Graceful-dev fallback predates P2 Docker stabilization. No env gate distinguishing `development` vs `production`.
- **Evidence:** `sandboxExec.ts:14-34 dockerExec` + `45-60 localExec`; `verifier/checks/sandbox-isolation` passes because it scans diff, not runtime path; `docker-compose.yml` sandbox is not `depends_on`/`healthcheck` required.
- **Impact:** I-4 / Double-O disqualification risk. A malicious prompt could exfiltrate `~/.env` via bash.
- **Fix (P2, 45 min):**
  ```ts
  const isProd = process.env.NODE_ENV==="production";
  if (isProd && !useDocker) throw new Error("sandbox Docker required in production");
  // in dockerExec catch: if(isProd) throw; else return localExec(req) with warning header
  ```
  Add `healthcheck: ["CMD","python","/usr/local/bin/runner.py"]` + `depends_on: sandbox:condition:service_healthy` for server, and `SANDBOX_DOCKER=true` in `test_ci.yml`'s `docker-sandbox` job. Document fallback as dev-only in `packages/sandbox/README.md`.

### SA-04 — Unauthenticated API & SSE Stream — Full Session Disclosure [HIGH]

- **Problem:** `apps/server/src/routes/missions.ts:5-35` and `routes/stream.ts:5` expose `POST /api/missions`, `GET /api/missions/:id`, `POST /:id/tools`, `POST /:id/approval`, `GET /api/stream/:id` without auth, session scoping, or tenancy. `GET /api/stream/:id` streams the entire `Session` (prompt, tool args, approval state) to anyone who guesses `sess_<timestamp>_<rand>`. `GET /api/verify/latest` also leaks diff previews.
- **Cause:** Phase-1 scaffold prioritized demo speed; auth deferred to P3 “HITL governance”. `sessions Map` is in-process singleton, no isolation.
- **Evidence:** `index.ts:11 cors({origin:CORS_ORIGIN})` only checks Origin header (trivially spoofed); `missions.ts:14 listSessions()` returns all sessions; `stream.ts:10 writeHead Access-Control-Allow-Origin:*` overrides CORS; no `Authorization` check in any router.
- **Impact:** C-4. Any LAN participant can hijack a HITL approval (`POST /:id/approval {approved:true}`) and trigger `restart_service` / `execute_write`. For hackathon demo on shared WiFi this is live.
- **Fix (P3, 2 h):**
  1. Issue `X-API-Key` at startup (from `TRUEFORGE_API_KEY` or generated `tmp/.api_key`) and enforce in `index.ts` middleware for `/api/missions/*` + `/api/verify/*` (`except /api/health`).
  2. Scope `listSessions` + `getSession` to caller key; rotate `id` to `crypto.randomUUID()` (currently `Date.now()+Math.random` predictable).
  3. SSE: require `?token=` query param validated against session creator; drop wildcard `ACAO:*`, echo `CORS_ORIGIN`.
  4. Persist sessions to SQLite (`session_cache/` already gitignored) with per-session `ownerKey` before P4.

### SA-05 — Missing Rate-Limit, Helmet, and Security Headers [MEDIUM-HIGH]

- **Problem:** `apps/server/src/index.ts:12` only does `express.json({limit:"1mb"})`. No `helmet`, no `express-rate-limit`, no `HSTS/CSP/X-Frame`. A tight loop on `POST /:id/tools` can spam `evaluate()` + fill `sessions Map` (memory exhaustion), and browsers get no XSS/clickjacking guards.
- **Cause:** Scaffold omitted prod middleware for brevity; `zod` is installed but unused at the boundary.
- **Fix (P3, 30 min):**
  ```ts
  import helmet from "helmet"; import rateLimit from "express-rate-limit";
  app.use(helmet({contentSecurityPolicy:false})); // enable with nonce for Vite
  app.use(rateLimit({windowMs:60_000, max:120, standardHeaders:true}));
  app.use("/api/missions", rateLimit({windowMs:60_000,max:60}));
  ```

### SA-06 — CORS Misconfiguration: Single-Origin Elsewhere, Wildcard on SSE [MEDIUM]

- **Problem:** `index.ts:11` correctly restricts `cors({origin:CORS_ORIGIN})` (default `http://localhost:5173`), but `stream.ts:13` hardcodes `Access-Control-Allow-Origin:*` for SSE. Browsers will allow any origin to read `GET /api/stream/:id`.
- **Cause:** SSE `writeHead` was written before CORS middleware and bypasses it.
- **Fix (P3, 10 min):** Replace `*` with `process.env.CORS_ORIGIN ?? "http://localhost:5173"` and add `Vary: Origin`; or pipe SSE through the same `cors()` middleware instead of manual header.

### SA-07 — LLM Client Credential Smearing & Error Disclosure [MEDIUM]

- **Problem:** `apps/server/src/llm/client.ts:80-84` when `apiKey` does not start with `sk-` sets **both** `Authorization: Bearer <key>` and `x-api-key: <key>`, sending the secret to whichever header the endpoint ignores/log. On `!response.ok` it `throw new Error(\`LLM API responded with ${status}: ${errText}\`)` where `errText` may echo the key or internal endpoint details to the client (via `missionsRouter` 500? path).
- **Cause:** Attempt to support Anthropic + OpenAI-compatible gateways with one code path; no provider abstraction.
- **Evidence:** `getLLMConfig()` reads `ANTHROPIC_API_KEY || ANTHROPIC_AUTH_TOKEN || OPENAI_API_KEY` then smears; `catch` does `console.error` but rethrows.
- **Fix (P2, 30 min):**
  ```ts
  const isAnthropic = config.baseUrl.includes("anthropic.com");
  headers[isAnthropic ? "x-api-key" : "Authorization"] = isAnthropic ? config.apiKey! : `Bearer ${config.apiKey}`;
  // on error: throw new Error(`LLM ${response.status} — see server logs (${Date.now()})`);
  // log full errText server-side only with pino redaction
  ```

### SA-08 — Unvalidated Tool Args & Unbounded Code Payloads [MEDIUM]

- **Problem:** `missionsRouter.post("/:id/tools")` only checks `if(!tool)` then forwards `args ?? {}` to `proposeTool`→`evaluate`→`sandboxExec`. No `zod` schema, no `code` size cap, no `timeout_ms` ceiling. A crafted `run_diagnostic_script {code: "9GB string"}` or `execute_write {sql:"DROP TABLE..."}` bypasses the intended “validation” gate (medium) and can OOM the sandbox or queue a destructive write that only later hits HITL.
- **Cause:** `zod` already in `apps/server/package.json:15` but not wired; `runner.py: timeout_ms` trusted from client.
- **Fix (P3, 1 h):**
  ```ts
  const ToolArgs = z.object({
    code: z.string().max(64_000).optional(),
    timeout_ms: z.number().int().min(1000).max(30_000).optional(),
    sql: z.string().max(8_000).optional(),
  }).passthrough();
  // + tool-specific allowlists: restart_service:{service:z.enum([...])}, execute_write:{dryRun:z.boolean()}
  ```
  Enforce `code.length` + `timeout_ms` in `runner.py` as well (already has `subprocess` timeout but no input length check).

### SA-09 — Frontend XSS via `dangerouslySetInnerHTML` [MEDIUM]

- **Problem:** `apps/web/src/components/AgentTimeline.tsx: esc(s.text)` does `replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")` then `dangerouslySetInnerHTML`. Model or tool output containing `**<img onerror=...>**` or `` ` <svg onload=...>` `` can inject. `output` is rendered in `<pre>` safely, but `s.text` is not.
- **Cause:** Quick markdown helper without DOMPurify; assumption that `s.text` is trusted operator input, but after P2 it will contain LLM-generated `agent` steps.
- **Fix (P3, 30 min):** Replace manual `esc` with `DOMPurify.sanitize(marked.parseInline(text))` or render markdown via `react-markdown` without `allowDangerousHtml`; always `escapeHtml` before bold/code transforms. Add `helmet: CSP script-src` to block inline handlers.

### SA-10 — No Audit Log & Approvals Replayable [MEDIUM]

- **Problem:** `orchestrator.ts: Session.pendingApproval` holds a single `ApprovalRequest` with `status:"pending"|"approved"|"rejected"` but no persistence, no actor, no expiry, no idempotency key, no append-only log. Approvals are `POST /:id/approval {approved:boolean}` with no nonce — replayable. No `audit_log` table/file means disputed `execute_write` cannot be forensically attributed.
- **Cause:** Minimal HITL stub for Phase 0 demo; `tmp/codex-monitor` is the only durable store.
- **Fix (P4, 1.5 h):**
  1. Persist every `evaluate→pending→approved|rejected→execute` transition to `session_cache/audit.jsonl` (`{at, sessionId, approvalId, tool, argsHash, actor:"operator:apiKeyFingerprint", decision, reason}`).
  2. Add `expiresAt: Date.now()+15*60*1000` to `ApprovalRequest`; reject stale.
  3. Require `Idempotency-Key` header on `POST /:id/approval`; store once.
  4. Surface audit trail in UI `ApprovalModal` history tab for judges.

### SA-11 — Dependency & Supply-Chain Blind Spot [LOW-MEDIUM]

- **Problem:** `npm audit` is unreachable offline (`registry.npmjs.org ENOTFOUND` during this audit) and CI `test_ci.yml: lint-and-test` runs `npm ci || npm install` without `npm audit --audit-level=high`. New `+2785 lines` in `package-lock.json` (`@ai-sdk/* 2.0.35, anthropic 4.0.42`) are unaudited.
- **Cause:** Network-restricted audit runner; no `audit` job.
- **Fix (P4, 15 min):** Add CI step `npm audit --omit=dev --audit-level=moderate` (allow failure with `continue-on-error` + artifact), enable Dependabot + `npm pkg set overrides` for flagged CVEs, commit `package-lock.json`.

### SA-12 — In-Memory Session Store — No Isolation, No Eviction [LOW]

- **Problem:** `orchestrator.ts: const sessions = new Map<string,Session>()` lives in-process, no TTL, no per-tenant isolation, no snapshot. A long run leaks memory; server restart loses pending approvals.
- **Fix (P4, optional):** Swap to SQLite (`session_cache/sessions.db`, already gitignored) with `better-sqlite3` + 24 h TTL sweep. Not a blocker for demo, but mention in `ARCHITECTURE_SPEC.md: TF_STATE` as “SQLite in P4”.

---

## 5. Sandbox & Runner Contract — Line-by-Line Verification

| Check | Result | Detail |
|---|---|---|
| `runner.py: stdin {language,code,timeout_ms} → stdout {exitCode,stdout,stderr,timedOut}` | ✅ intact | `verifier:sandbox-contract:pass` — no diff touches contract; `run_python` uses `NamedTemporaryFile + subprocess.run(capture_output=True, timeout)` correctly, no `shell=True` |
| `run_bash` uses `bash -c` | ⚠️ contained | Required for diagnostics; only reachable via `sandboxExec` (which is Docker-gated). Add `set -euo pipefail` prefix in `runner.py` and reject `code` containing `$(` → host exfil if fallback triggers (mitigated by SA-03) |
| Non-root | ✅ | `Dockerfile: USER agent` |
| No host FS | ✅* | `docker-compose: volume ./workspace:/workspace:rw` is the only mount; `WORKDIR /workspace`; no `/host` bind. Tighten to SA-02 |
| Network egress | ✅ for demo | Isolated `omniforge` bridge; no `--network host`. Consider `network_mode` per-tool if exfil is a concern |

---

## 6. HITL Gate Matrix — Verification vs Spec

Spec matrix `ARCHITECTURE_SPEC.md: HITL Gate Matrix` vs `hitl.ts:POLICIES`:

| Tool | Spec Risk | `hitl.ts` Risk | Approval | Mode | Verdict |
|---|---|---|---|---|---|
| `read_logs`,`get_metrics`,`inspect_container` | LOW | LOW | false | local | ✅ |
| `scan_dependencies`,`inspect_diff`,`list_tables`,`query_readonly`,`preview_csv` | LOW | LOW | false | local | ✅ |
| `run_diagnostic_script`,`test_exploit`,`run_etl_script`,`validate_schema` | MEDIUM | MEDIUM | false | sandbox | ✅ |
| `create_patch_pr` | HIGH | HIGH | true | host | ✅ |
| `restart_service` | CRITICAL | CRITICAL | true | host | ✅ |
| `execute_write` (+ `dryRun:false→CRITICAL`) | CRITICAL | CRITICAL | true | target | ✅ |
| unknown tool | HIGH (safe default) | HIGH | true | host | ✅ |

No bypass patterns found: `rg "skipHitl|bypass.*hitl|forceApprove|approved\\s*:\\s*true.*CRITICAL"` → only verifier’s own regex definitions; `orchestrator.ts: proposeTool → evaluate()` path intact per `verifier:no-bypass:pass`.

---

## 7. Remediation Plan — Aligned to Schedule

### P2 Exit (26 Aug) — 3 h total, must-ship

- [ ] **SA-01** rotate `.env` + `chmod 600` + redact LLM errors (30 m) — *blocks any public deploy*
- [ ] **SA-02** `read_only:true` + `pids_limit:128` + drop runtime caps (1 h)
- [ ] **SA-03** fail-closed `sandboxExec` in prod + healthcheck (45 m)
- [ ] **SA-07** provider-specific LLM headers (30 m)

### P3 HITL & Cockpit (27–28 Aug) — 5 h

- [ ] **SA-04** `X-API-Key` + session scoping + SSE token (2 h)
- [ ] **SA-05** `helmet` + `rateLimit` (30 m)
- [ ] **SA-06** fix SSE wildcard (10 m)
- [ ] **SA-08** `zod` args + code size cap (1 h)
- [ ] **SA-09** DOMPurify / react-markdown (30 m)
- [ ] **SA-10** audit log + expiry (1.5 h, may slip to P4 morning)

### P4 Hardening & Qodo (29 Aug)

- [ ] **SA-11** CI `npm audit` + Dependabot
- [ ] **SA-12** SQLite session store (optional, nice for video)
- [ ] E2E: outage→diagnose→HITL→fix, CVE→exploit→PR→HITL, ETL→validate→HITL — each must show modal + terminal stream + Qodo review

### P5 Submission (30 Aug) — No code changes after 12:00 PDT

Video beat 1:15–2:30 must demonstrably show SA-04+SA-10: “every CRITICAL pauses, requires human 1-click, is audit-logged, and every MEDIUM runs in Docker.”

---

## 8. Compliance Snapshot

| Framework | Relevant controls | Current | After P3 fixes |
|---|---|---|---|
| OWASP Top 10 2021 | A01 Broken Access Control, A03 Injection, A05 Misconfig, A07 Auth | 🟡 Partial (SA-04/05/08) | 🟢 Covered |
| OWASP LLM Top 10 2025 | LLM01 Prompt Injection, LLM06 Sensitive Info Disclosure, LLM07 Insecure Plugin (MCP) | 🟡 SA-01/07/08 | 🟢 with SA-07/08 + prompt allowlisting |
| CIS Docker Benchmark | 4.1 read-only rootfs, 5.9 cap drop, 5.11 pids limit, 5.28 no-new-privs | 🟡 3/4 pass | 🟢 4/4 |
| TruffleHog/Gitleaks | No secrets in git | 🟢 Pass | 🟢 |
| Double-O rubric | “every dynamic exec in Docker + HITL on critical” | 🟡 SA-03 fallback | 🟢 fail-closed |

---

## 9. Appendices

### A. Commands to Reproduce This Audit

```bash
# secrets — history + staged + disk
git ls-files --cached | grep -E "\.env"
git log -p --all -S "LLM_" -- .env 2>/dev/null | head
gitleaks detect --source=. --verbose --no-git 2>&1 | head -n 50
rg -n "ANTHROPIC_API_KEY|OPENAI_API_KEY|sk-ant-|ghp_|AKIA" --hidden --glob "!.git/*" | grep -v node_modules

# hitl
rg -n "evaluate\(|POLICIES|requiresApproval|CRITICAL" apps/server/src --glob "*.ts"
node -e "import('./apps/server/src/policies/hitl.js').then(m=>console.log(m.evaluate('restart_service',{})))"

# sandbox
cat docker-compose.yml | grep -A2 "read_only\|cap_drop\|no-new-privileges\|mem_limit"
cat packages/sandbox/runner.py | head -n 60
cat packages/mcp-tools/src/shared/sandboxExec.ts

# api surface
rg -n "cors|helmet|rateLimit|express.json|CORS_ORIGIN" apps/server --glob "*.ts"
curl -s http://localhost:3001/api/health | jq .
curl -s http://localhost:3001/api/verify/latest | jq .overall,.checks[].id
```

### B. Risk Matrix (pre- vs post-fix)

| ID | Severity | Likelihood | Pre-fix Risk | Post-fix Risk |
|---|---|---|---|---|
| SA-01 | Critical | High (disk) | **High** | Low |
| SA-02 | High | Medium | Medium | Low |
| SA-03 | High | Medium (Docker down) | **High** | Low |
| SA-04 | High | High (LAN) | **High** | Low |
| SA-05 | Medium-High | High | Medium | Low |
| SA-06 | Medium | Medium | Medium | Low |
| SA-07 | Medium | Medium | Medium | Low |
| SA-08 | Medium | Medium | Medium | Low |
| SA-09 | Medium | Low (needs LLM content) | Low | Negligible |
| SA-10 | Medium | Low | Low | Low |
| SA-11 | Low-Med | Low | Low | Negligible |

### C. Verifier Evidence (25 Aug 06:58 UTC)

```
spec: omniforge-spec-v1@1.0.0
overall: PASS 7/10 (3 skipped --skip-heavy on no-diff)
hitl-integrity: pass — CRITICAL→approval gate present | orchestrator.ts: proposeTool → evaluate() intact
sandbox-isolation: pass — No raw host exec outside sandboxExec | sandbox runner present
security-secrets: pass — No secrets in diff (filtered)
no-bypass: pass — No bypass patterns in diff
sandbox-contract: pass — runner.py stdin {language,code,timeout_ms} → {exitCode,stdout,stderr,timedOut} intact
```

### D. Ownership

- **Owner for P2 fixes:** platform (server + sandbox) — Codex
- **Owner for P3 UI fixes:** Mission Control web — Codex
- **Reviewer:** Muse (verifier harness `POST /api/verify` + `verify:watch`)
- **Next audit:** 28 Aug EOD — re-run this checklist gate before P4 E2E

---

*Generated for `docs/` per SAE schedule. Keep this file versioned; the next update should flip the P2 checkbox states and attach `gitleaks` + `npm audit` artifacts under `tmp/`.*
