import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sandboxExec } from "../shared/sandboxExec.js";

/**
 * Security MCP — dependency audit, CVE feed, exploit sim, git ops
 *  LOW:    scan_dependencies, inspect_diff
 *  MEDIUM: test_exploit (sandbox)
 *  HIGH:   create_patch_pr / git_commit (HITL — human review)
 */
export function createSecurityMcpServer() {
  const server = new McpServer({ name: "omniforge-security-mcp", version: "0.1.0" });

  server.tool(
    "scan_dependencies",
    "Scan manifest for known CVEs (LOW)",
    { manifest: z.enum(["package.json", "requirements.txt", "all"]).default("all") },
    async ({ manifest }) => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                manifest,
                findings: [
                  { pkg: "lodash", version: "4.17.20", cve: "CVE-2021-23337", severity: "high" },
                  { pkg: "requests", version: "2.28.0", cve: "CVE-2023-32681", severity: "medium" },
                ],
                source: "mock — wire to OSV / GitHub Advisory in Phase 2",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "inspect_diff",
    "Show git diff for a path or commit range (LOW)",
    { path: z.string().default("."), base: z.string().optional() },
    async ({ path, base }) => {
      const code = base
        ? `git diff ${base}..HEAD -- ${path} 2>&1 | head -n 200 || echo "[mock diff] no git repo"`
        : `git diff -- ${path} 2>&1 | head -n 200 || echo "[mock diff] no git repo"`;
      const result = await sandboxExec({ language: "bash", code });
      return { content: [{ type: "text", text: result.stdout || result.stderr }] };
    }
  );

  server.tool(
    "test_exploit",
    "Simulate CVE exploit inside sandbox (MEDIUM — sandbox auto-approved)",
    {
      cve: z.string().describe("CVE id e.g. CVE-2021-23337"),
      language: z.enum(["python", "bash"]).default("python"),
      exploit_code: z.string().describe("proof-of-concept code to run in sandbox"),
    },
    async ({ cve, language, exploit_code }) => {
      const result = await sandboxExec({ language, code: exploit_code, timeout_ms: 15000 });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ cve, exploitResult: result }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "create_patch_pr",
    "Create a patch branch + PR (HIGH — requires HITL approval)",
    {
      branch: z.string(),
      title: z.string(),
      body: z.string().default(""),
      patch: z.string().describe("unified diff or file contents"),
    },
    async ({ branch, title }) => {
      return {
        content: [{ type: "text", text: `[create_patch_pr] APPROVED — branch=${branch} title="${title}" (mock — git ops in Phase 2)` }],
      };
    }
  );

  return server;
}

if (process.argv[1]?.endsWith("server.js")) {
  const server = createSecurityMcpServer();
  await server.connect(new StdioServerTransport());
}
