# @omniforge/web — Mission Control Cockpit

Next-gen mission-control UI: Vite + React + Tailwind, dark grid, HITL approval modal, live timeline, sandbox terminal.

## Run

```bash
npm run dev:web     # from root, or
npm --workspace apps/web run dev   # → http://localhost:5173
```

Proxies `/api` → `http://localhost:3001` (see `vite.config.ts`).

## Components

- `CockpitLayout` — header + 2-col grid
- `ModuleSwitcher` — OpsForge / SecurForge / DataForge
- `AgentTimeline` — step-by-step reasoning trace
- `ApprovalModal` — HITL gate (the judging hinge)
- `TerminalStream` — sandbox stdout/stderr

## Build

```bash
npm --workspace apps/web run build   # → dist/
```
