# Contributing to OmniForge

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev          # web http://localhost:5173 + server http://localhost:3001
```

Optional sandbox (requires Docker):

```bash
docker compose up -d sandbox
docker exec omniforge-sandbox python /usr/local/bin/runner.py <<< '{"language":"python","code":"print(42)"}'
```

## Project Structure

```
apps/web              # Vite + React + Tailwind mission-control cockpit
apps/server           # Express orchestrator + HITL policy engine + SSE
packages/mcp-tools    # system / security / data MCP servers (FastMCP)
packages/sandbox      # Docker sandbox: Dockerfile + runner.py
packages/verifier     # Spec verifier: 10 checks incl. HITL integrity and secrets
```

## Conventions

- **Branching:** feature branches via pull request into `main` (squash merge).
- **Commits:** conventional (`feat:`, `fix:`, `chore:`, `docs:`). No secrets in diffs.
- **Reviews:** every pull request is reviewed by Qodo PR-Agent (see `.pr_agent.toml`). Resolve all critical findings before merge.
- **HITL:** never add a `CRITICAL` tool without a matching policy in `apps/server/src/policies/hitl.ts` and an approval path in the web cockpit.
- **Sandbox:** all dynamic code executes via `packages/sandbox/runner.py` — no raw `child_process.exec` elsewhere.

## Before Opening a Pull Request

```bash
npm run build && npm run lint && npm test
npm run verify       # spec verifier — must PASS
```

## Definition of Done (per PR)

- [ ] Unit test added or updated; acceptance criteria satisfied
- [ ] Qodo review addressed (no unresolved critical findings)
- [ ] No secrets in the diff (`gitleaks` passes)
- [ ] SSE events visible in `AgentTimeline` where applicable
- [ ] Sandbox isolation preserved

## Resources

- TrueForge: https://github.com/truefoundry/trueforge
- Model Context Protocol: https://modelcontextprotocol.io
- Qodo Merge app: https://github.com/apps/qodo-merge
