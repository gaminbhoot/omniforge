# @omniforge/web

Mission-control cockpit: Vite + React + Tailwind, dark theme, live agent timeline, sandbox terminal stream, and HITL approval modal.

## Run

```bash
npm run dev:web     # from the repository root → http://localhost:5173
# or
npm --workspace apps/web run dev
```

Requests to `/api` are proxied to the orchestrator at `http://localhost:3001` (see `vite.config.ts`).

## Components

- `CockpitLayout` — page shell and header
- `ModuleSwitcher` — OpsForge / SecurForge / DataForge views
- `AgentTimeline` — step-by-step reasoning and tool trace
- `ApprovalModal` — HITL gate: risk badge, command, approve or reject with feedback
- `TerminalStream` — live sandboxed stdout/stderr
