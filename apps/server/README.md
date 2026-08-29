# @omniforge/server

Express orchestrator: mission sessions, HITL policy engine, SSE streaming, and the TrueForge harness bridge.

## Run

```bash
npm run dev:server                # from the repository root
# or
npm --workspace apps/server run dev
```

Environment: `PORT` (default 3001), `CORS_ORIGIN` (default http://localhost:5173). See `.env.example` for the full list.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/missions` | `{prompt}` — create a mission; auto-classifies to OpsForge / SecurForge / DataForge |
| GET | `/api/missions` | List sessions |
| GET | `/api/missions/:id` | Get session and steps |
| POST | `/api/missions/:id/tools` | `{tool, args}` — executes automatically at LOW/MEDIUM risk; HIGH/CRITICAL returns `pendingApproval` |
| POST | `/api/missions/:id/approval` | `{approved, feedback?}` — resolve a pending HITL gate |
| GET | `/api/stream/:id` | SSE stream of session steps |
| GET | `/api/harness/health` | TrueForge harness availability probe |
| GET | `/api/verify/latest` | Latest spec-verifier verdict |

## HITL policy engine

Tool risk tiers and approval rules live in `src/policies/hitl.ts`. HIGH/CRITICAL tools pause the session; approvals expire after `APPROVAL_TTL_MS`; every decision is appended to `session_cache/audit.jsonl`.
