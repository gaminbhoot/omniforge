import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sandboxExec } from "../shared/sandboxExec.js";

/**
 * System MCP — logs, metrics, container ops, diagnostics
 * Risk mapping:
 *  LOW:    read_logs, get_metrics, inspect_container
 *  MEDIUM: run_diagnostic_script (sandbox-only)
 *  CRITICAL: restart_service (requires HITL)
 */
export function createSystemMcpServer() {
  const server = new McpServer({ name: "omniforge-system-mcp", version: "0.1.0" });

  server.tool(
    "read_logs",
    "Fetch recent logs for a container/service (LOW — auto-approved)",
    { service: z.string().describe("container or service name"), tail: z.number().default(100) },
    async ({ service, tail }) => {
      // Stub: in prod, tails docker logs / k8s logs
      return {
        content: [
          {
            type: "text",
            text: `[read_logs] service=${service} tail=${tail}\n2026-08-23T00:00:00Z INFO  service healthy (mock)\n2026-08-23T00:01:00Z WARN  latency p99=420ms`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_metrics",
    "Fetch CPU/memory/latency metrics (LOW — auto-approved)",
    { service: z.string(), window: z.string().default("5m") },
    async ({ service, window }) => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ service, window, cpu: "42%", memory: "512MiB", p99: "210ms", source: "mock" }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "inspect_container",
    "Inspect running container metadata (LOW)",
    { container: z.string() },
    async ({ container }) => {
      const result = await sandboxExec({
        language: "bash",
        code: `echo '{"container":"${container}","status":"running","image":"mock:latest","startedAt":"2026-08-23T00:00:00Z"}'`,
      });
      return { content: [{ type: "text", text: result.stdout || result.stderr }] };
    }
  );

  server.tool(
    "run_diagnostic_script",
    "Run a diagnostic python/bash snippet INSIDE the sandbox (MEDIUM — sandbox auto-approved)",
    {
      language: z.enum(["python", "bash"]).default("python"),
      code: z.string().describe("diagnostic code to run in sandbox"),
      timeout_ms: z.number().default(15000),
    },
    async ({ language, code, timeout_ms }) => {
      const result = await sandboxExec({ language, code, timeout_ms });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "restart_service",
    "Restart a service/container (CRITICAL — requires HITL approval token)",
    { service: z.string(), strategy: z.enum(["rolling", "recreate"]).default("rolling") },
    async ({ service, strategy }) => {
      // This tool is gated by the orchestrator's HITL interceptor — if we reach here, approval was granted
      return {
        content: [{ type: "text", text: `[restart_service] APPROVED — restarting ${service} strategy=${strategy} (mock)` }],
      };
    }
  );

  return server;
}

// Standalone entrypoint for `node dist/system/server.js`
if (process.argv[1]?.endsWith("server.js")) {
  const server = createSystemMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
