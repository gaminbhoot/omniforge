# Sandbox — Isolated Docker Execution

Lightweight `python:3.11-slim` container with `pandas`, `polars`, `duckdb`, and `runner.py`.

## Build & run

```bash
docker compose build sandbox
docker compose up -d sandbox
docker exec omniforge-sandbox python /usr/local/bin/runner.py <<'JSON'
{"language":"python","code":"import pandas as pd; print(pd.__version__)"}
JSON
```

## Security

- `no-new-privileges`, `cap_drop: ALL`, `read_only: true`, `pids_limit: 128`
- `tmpfs` mounts for `/tmp` and `/home/agent` (scratch space only)
- Runs as non-root `agent` (uid 1000)
- `mem_limit: 512m`, `cpus: 1`
- No host filesystem access except the `/workspace` bind mount
