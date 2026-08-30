import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sandboxExec } from "../shared/sandboxExec.js";

/**
 * Data MCP — multi-DB queries, sandboxed ETL, schema validation
 *  LOW:    query_readonly, list_tables, preview_csv
 *  MEDIUM: run_etl_script (sandbox)
 *  CRITICAL: execute_write (UPDATE/DELETE/DROP — HITL)
 */
export function createDataMcpServer() {
  const server = new McpServer({ name: "omniforge-data-mcp", version: "0.1.0" });

  server.tool(
    "list_tables",
    "List tables in a database (LOW)",
    { connection: z.enum(["postgres", "clickhouse", "duckdb"]).default("duckdb") },
    async ({ connection }) => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ connection, tables: ["users", "orders", "events"], source: "mock" }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "query_readonly",
    "Run a SELECT-only query (LOW — auto-approved, rejects writes)",
    { sql: z.string().describe("SELECT statement"), connection: z.string().default("duckdb") },
    async ({ sql, connection }) => {
      if (/\b(UPDATE|DELETE|DROP|INSERT|ALTER|TRUNCATE)\b/i.test(sql)) {
        return { content: [{ type: "text", text: `BLOCKED: write keyword detected — use execute_write (CRITICAL/HITL) instead. sql=${sql}` }] };
      }
      // Extra guard: these characters would break out of the sandboxed Python
      // string interpolation below — reject instead of trying to escape.
      if (/[;\\]/.test(sql) || /--/.test(sql) || /\/\*/.test(sql)) {
        return { content: [{ type: "text", text: `BLOCKED: sql contains characters not allowed in readonly demo queries (; \\ -- /*). sql=${sql}` }] };
      }
      // In prod, routes to real DB via connection string. Here we run a demo DuckDB snippet in sandbox.
      const result = await sandboxExec({
        language: "python",
        code: `
import duckdb
con = duckdb.connect(':memory:')
con.execute("CREATE TABLE users AS SELECT * FROM (VALUES (1,'alice'),(2,'bob')) t(id,name)")
print(con.execute("""${sql.replace(/"/g, '\\"').replace(/\n/g, " ")}""").fetchdf().to_string())
`,
      });
      return { content: [{ type: "text", text: `connection=${connection}\n${result.stdout || result.stderr}` }] };
    }
  );

  server.tool(
    "preview_csv",
    "Preview first N rows of a CSV in sandbox (LOW)",
    { path: z.string().default("/workspace/sample.csv"), n: z.number().default(5) },
    async ({ path, n }) => {
      // Reject traversal segments ("..") — the regex alone allows them
      const safePath = !path.includes("..") && /^\/?[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(path);
      const safeN = Number.isInteger(n) && n >= 1 && n <= 100;
      if (!safePath || !safeN) {
        return { content: [{ type: "text", text: `BLOCKED: invalid path/n — refusing to run (path=${JSON.stringify(path)} n=${JSON.stringify(n)})` }] };
      }
      const result = await sandboxExec({
        language: "python",
        code: `import pandas as pd, pathlib\np=pathlib.Path("${path}")\nprint(pd.read_csv(p).head(${n}).to_string() if p.exists() else "[mock] ${path} not found — upload a CSV to sandbox workspace")`,
      });
      return { content: [{ type: "text", text: result.stdout || result.stderr }] };
    }
  );

  server.tool(
    "run_etl_script",
    "Run a transformation script in sandbox (MEDIUM — sandbox auto-approved)",
    { language: z.enum(["python"]).default("python"), code: z.string(), timeout_ms: z.number().default(20000) },
    async ({ language, code, timeout_ms }) => {
      const result = await sandboxExec({ language, code, timeout_ms });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "execute_write",
    "Execute a write/migration SQL (CRITICAL — requires HITL approval)",
    { sql: z.string(), connection: z.string().default("postgres"), dryRun: z.boolean().default(true) },
    async ({ sql, connection, dryRun }) => {
      if (dryRun) {
        return { content: [{ type: "text", text: `[DRY RUN] connection=${connection} sql=${sql} — approve to execute for real` }] };
      }
      return { content: [{ type: "text", text: `[execute_write] APPROVED — executed on ${connection}: ${sql} (mock)` }] };
    }
  );

  server.tool(
    "validate_schema",
    "Validate a DataFrame/table schema against expected columns (MEDIUM — sandbox)",
    {
      expected_columns: z.array(z.string()),
      sample_code: z.string().describe("python code that produces a DataFrame `df`"),
    },
    async ({ expected_columns, sample_code }) => {
      const code = `${sample_code}\ncols=set(df.columns)\nexp=set(${JSON.stringify(expected_columns)})\nprint({"ok": cols==exp, "missing": list(exp-cols), "extra": list(cols-exp)})`;
      const result = await sandboxExec({ language: "python", code });
      return { content: [{ type: "text", text: result.stdout || result.stderr }] };
    }
  );

  return server;
}

if (process.argv[1]?.endsWith("server.js")) {
  const server = createDataMcpServer();
  await server.connect(new StdioServerTransport());
}
