# Contributing to OmniForge (Mission TF-007)

## Quick Start

```bash
cp .env.example .env
npm install --cache /tmp/npm-cache   # if npm cache is root-owned
npm run dev          # web http://localhost:5173 + server http://localhost:3001
```

Optional sandbox (requires Docker Desktop running):

```bash
docker compose up -d sandbox
docker exec omniforge-sandbox python /usr/local/bin/runner.py <<< '{"language":"python","code":"print(42)"}'
```

## Project Structure

```
apps/web              # Vite + React + Tailwind cockpit (Savile Row)
apps/server           # Express orchestrator + HITL engine + SSE (Double-O)
packages/mcp-tools    # system / security / data MCP servers (FastMCP)
packages/sandbox      # Docker sandbox Dockerfile + runner.py
```

## Conventions

- **Branching:** feature branches → PR → `main` (squash merge). Phase 0 scaffold was `chore/scaffold`.
- **Commits:** conventional (`feat:`, `fix:`, `chore:`, `docs:`). No secrets in diff.
- **PRs:** every PR gets a Qodo review (see `.pr_agent.toml`). Address unresolved criticals before merge.
- **HITL:** never add a `CRITICAL` tool without a matching policy in `apps/server/src/policies/hitl.ts` and an `ApprovalModal` path.
- **Sandbox:** all dynamic code via `packages/sandbox/runner.py` — no raw `child_process.exec` elsewhere.

## Before Opening a PR

```bash
npm run build && npm run lint
python3 packages/sandbox/runner.py <<< '{"language":"python","code":"print(\"ok\")"}'  # if sandbox container is up
```

## Definition of Done (per PR)

- [ ] Unit test + Given/When/Then AC satisfied
- [ ] Qodo comment addressed (no unresolved criticals)
- [ ] No secret in diff (`gitleaks` or manual check)
- [ ] SSE event visible in `AgentTimeline` if applicable
- [ ] Sandbox isolation preserved

## Useful Links

- Hackathon portal: https://www.wemakedevs.org/hackathons/trueforge
- TrueForge: https://github.com/truefoundry/trueforge
- Qodo Merge app: https://github.com/apps/qodo-merge
