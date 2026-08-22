# @omniforge/server — TrueForge Orchestrator (Phase 0 Scaffold)

Phase 0 stub that mirrors the real TrueForge harness API so the cockpit is runnable before Aug 24.

## Run

```bash
npm run dev:server   # from root, or
npm --workspace apps/server run dev
```

Env: `PORT` (default 3001), `CORS_ORIGIN` (default http://localhost:5173)

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | healthcheck |
| POST | `/api/missions` | `{prompt}` → create mission, auto-classifies to OpsForge/SecurForge/DataForge |
| GET | `/api/missions` | list sessions |
| GET | `/api/missions/:id` | get session + steps |
| POST | `/api/missions/:id/tools` | `{tool, args}` → auto-exec if LOW/MEDIUM, else returns `pendingApproval` (HITL) |
| POST | `/api/missions/:id/approval` | `{approved: bool, feedback?}` → resume |
| GET | `/api/stream/:id` | SSE stream (polls every 1.5s) |

## HITL

See `src/policies/hitl.ts` — CRITICAL tools (`restart_service`, `execute_write`) require approval. The web UI renders `ApprovalModal` when `pendingApproval` is non-null.

> On Aug 24, swap `src/orchestrator.ts` internals to call real `@truefoundry/trueforge` SDK. Keep the route contract stable so `apps/web` needs zero changes.
