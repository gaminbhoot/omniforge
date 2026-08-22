# @omniforge/mcp-tools — FastMCP Tool Servers

Three MCP servers exposing the tool surface the orchestrator's subagents use.

| Server | File | Tools | Risk |
|--------|------|-------|------|
| **system** | `src/system/server.ts` | `read_logs`, `get_metrics`, `inspect_container`, `run_diagnostic_script`, `restart_service` | LOW → CRITICAL |
| **security** | `src/security/server.ts` | `scan_dependencies`, `inspect_diff`, `test_exploit`, `create_patch_pr` | LOW → HIGH |
| **data** | `src/data/server.ts` | `list_tables`, `query_readonly`, `preview_csv`, `run_etl_script`, `validate_schema`, `execute_write` | LOW → CRITICAL |

Each server is a standalone **Stdio MCP server** (connects via `StdioServerTransport`) and also importable in-process via `src/index.ts`.

Sandbox execution delegates to `src/shared/sandboxExec.ts` — tries `docker exec omniforge-sandbox` first, falls back to local subprocess for dev without Docker.

## Run standalone

```bash
npm --workspace packages/mcp-tools run build
node packages/mcp-tools/dist/system/server.js   # stdio
```
