import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "./index.js";
import { createSession } from "./orchestrator.js";

process.env.SANDBOX_ALLOW_LOCAL = "true";

const PREV_TOKEN = process.env.OMNIFORGE_TOKEN;

beforeAll(() => {
  delete process.env.OMNIFORGE_TOKEN;
});

afterAll(() => {
  if (PREV_TOKEN === undefined) delete process.env.OMNIFORGE_TOKEN; else process.env.OMNIFORGE_TOKEN = PREV_TOKEN;
});

describe("GET /api/health", () => {
  it("reports service status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("omniforge-server");
  });
});

describe("mission lifecycle over HTTP", () => {
  it("creates a mission and classifies intent", async () => {
    const res = await request(app).post("/api/missions").send({ prompt: "outage: restart api-gateway" });
    expect(res.status).toBe(201);
    expect(res.body.subagent).toBe("OpsForge");
    expect(res.body.status).toBe("running");
  });

  it("rejects a mission without a string prompt", async () => {
    const res = await request(app).post("/api/missions").send({ prompt: 42 });
    expect(res.status).toBe(400);
  });

  it("proposes a LOW tool and executes it automatically", async () => {
    const s = createSession("outage: restart api-gateway");
    const res = await request(app).post(`/api/missions/${s.id}/tools`).send({ tool: "read_logs", args: { service: "api" } });
    expect(res.status).toBe(200);
    expect(res.body.pendingApproval).toBeNull();
  });

  it("pauses on a CRITICAL tool and returns a pending approval (HITL gate)", async () => {
    const s = createSession("outage: restart api-gateway");
    const res = await request(app).post(`/api/missions/${s.id}/tools`).send({ tool: "restart_service", args: { service: "api-gateway" } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("awaiting_approval");
    expect(res.body.pendingApproval.tool).toBe("restart_service");
    expect(res.body.pendingApproval.risk).toBe("CRITICAL");
  });

  it("resolves an approval and records the decision in the audit log", async () => {
    const s = createSession("outage: restart api-gateway");
    await request(app).post(`/api/missions/${s.id}/tools`).send({ tool: "restart_service", args: { service: "api-gateway" } });
    const res = await request(app).post(`/api/missions/${s.id}/approval`).send({ approved: true, feedback: "go" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("running");

    // audit trail on disk — the approval transition must be durably recorded
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const p = join(process.cwd(), "session_cache", "audit.jsonl");
    expect(existsSync(p)).toBe(true);
    const lines = readFileSync(p, "utf-8").trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.sessionId).toBe(s.id);
    expect(last.decision).toBe("approved");
  });

  it("rejects malformed tool proposals", async () => {
    const s = createSession("etl data");
    const noTool = await request(app).post(`/api/missions/${s.id}/tools`).send({ args: {} });
    expect(noTool.status).toBe(400);
    const badArgs = await request(app).post(`/api/missions/${s.id}/tools`).send({ tool: "read_logs", args: [1, 2] });
    expect(badArgs.status).toBe(400);
  });

  it("maps unknown sessions to 404 and blocked proposals to 409", async () => {
    const missing = await request(app).post("/api/missions/sess_nope/tools").send({ tool: "read_logs", args: {} });
    expect(missing.status).toBe(404);
    const s = createSession("outage: restart api-gateway");
    await request(app).post(`/api/missions/${s.id}/tools`).send({ tool: "restart_service", args: {} });
    const blocked = await request(app).post(`/api/missions/${s.id}/tools`).send({ tool: "read_logs", args: {} });
    expect(blocked.status).toBe(409);
  });

  it("returns 400 for approval on a session without a pending gate", async () => {
    const s = createSession("etl data");
    const res = await request(app).post(`/api/missions/${s.id}/approval`).send({ approved: true });
    expect(res.status).toBe(400);
  });

  it("returns the full session on GET", async () => {
    const s = createSession("cve patch pr");
    const res = await request(app).get(`/api/missions/${s.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(s.id);
    expect(Array.isArray(res.body.steps)).toBe(true);
  });

  it("resumes a mission on POST /:id/resume (persistent session)", async () => {
    const s = createSession("outage: restart api-gateway");
    const res = await request(app).post(`/api/missions/${s.id}/resume`).send({ prompt: "is it still healthy?" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(s.id);
    expect(res.body.steps.some((st: any) => st.text === "is it still healthy?")).toBe(true);
  });

  it("404s a resume on an unknown session and 400s without a prompt", async () => {
    const missing = await request(app).post("/api/missions/sess_missing/resume").send({ prompt: "x" });
    expect(missing.status).toBe(404);
    const s = createSession("etl data");
    const noPrompt = await request(app).post(`/api/missions/${s.id}/resume`).send({ prompt: 7 });
    expect(noPrompt.status).toBe(400);
  });

  it("409s a resume blocked by a pending HITL gate (same contract as /tools)", async () => {
    const s = createSession("outage: restart api-gateway");
    await request(app).post(`/api/missions/${s.id}/tools`).send({ tool: "restart_service", args: { service: "api-gateway" } });
    const res = await request(app).post(`/api/missions/${s.id}/resume`).send({ prompt: "try again" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/approval pending/i);
  });

  it("fans out a parallel squad on POST /squad", async () => {
    const res = await request(app).post("/api/missions/squad").send({ prompt: "outage on api-gateway and a CVE in lodash" });
    expect(res.status).toBe(201);
    expect(res.body.squadId).toMatch(/^squad_/);
    expect(res.body.sessions.length).toBe(3);
    expect(new Set(res.body.sessions.map((s: any) => s.squadId))).toEqual(new Set([res.body.squadId]));
  });

  it("rejects a squad without a string prompt", async () => {
    const res = await request(app).post("/api/missions/squad").send({ prompt: 9 });
    expect(res.status).toBe(400);
  });
});

describe("opt-in API auth (SA-04)", () => {
  it("allows mutations when no token is configured", async () => {
    const res = await request(app).post("/api/missions").send({ prompt: "etl data" });
    expect(res.status).toBe(201);
  });

  it("rejects mutations without the key when OMNIFORGE_TOKEN is set", async () => {
    process.env.OMNIFORGE_TOKEN = "secret-token";
    try {
      const denied = await request(app).post("/api/missions").send({ prompt: "etl data" });
      expect(denied.status).toBe(401);
      const wrongKey = await request(app).post("/api/missions").set("X-API-Key", "wrong").send({ prompt: "etl data" });
      expect(wrongKey.status).toBe(401);
      const allowed = await request(app).post("/api/missions").set("X-API-Key", "secret-token").send({ prompt: "etl data" });
      expect(allowed.status).toBe(201);
      // GETs stay open for read-only use
      const read = await request(app).get("/api/health");
      expect(read.status).toBe(200);
    } finally {
      delete process.env.OMNIFORGE_TOKEN;
    }
  });
});

describe("verify endpoints", () => {
  it("serves the canonical spec checklist", async () => {
    const res = await request(app).get("/api/verify/spec");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("omniforge-spec-v1");
  });

  it("ingests a monitor verdict and serves it back", async () => {
    const verdict = { id: "v_test_1", overall: "PASS", checks: [] };
    const post = await request(app).post("/api/verify/report").send(verdict);
    expect(post.status).toBe(200);
    const get = await request(app).get("/api/verify/latest");
    expect(get.status).toBe(200);
    expect(get.body.id).toBe("v_test_1");
  });

  it("rejects verdicts without an id", async () => {
    const res = await request(app).post("/api/verify/report").send({ overall: "PASS" });
    expect(res.status).toBe(400);
  });
});

describe("SSE stream (GET /api/stream/:id)", () => {
  it("404s for an unknown session", async () => {
    const res = await request(app).get("/api/stream/sess_nope");
    expect(res.status).toBe(404);
  });

  it("streams the session state and ends cleanly on disconnect", async () => {
    const { createSession: cs } = await import("./orchestrator.js");
    const s = cs("outage: restart api-gateway");
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    try {
      const controller = new AbortController();
      const res = await fetch(`http://127.0.0.1:${port}/api/stream/${s.id}`, { signal: controller.signal });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      const reader = res.body!.getReader();
      const { value } = await reader.read();
      const chunk = new TextDecoder().decode(value);
      expect(chunk).toContain("data: ");
      expect(chunk).toContain(s.id);
      controller.abort(); // client disconnect — server must clear the interval
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("harness bridge routes (no harness running -> graceful 502)", () => {
  it("reports harness availability honestly", async () => {
    const res = await request(app).get("/api/harness/health");
    expect(res.status).toBe(200);
    expect(typeof res.body.ok).toBe("boolean");
    expect(res.body.url).toBeDefined();
  });

  it("returns 502 (not a crash) when the harness is unreachable — never mutates a live harness", async () => {
    const health = await request(app).get("/api/harness/health");
    expect(health.status).toBe(200);
    if (health.body.ok === true) {
      // A live harness is running: verify read-only paths only — the mutating
      // POST must never be exercised against real harness data from tests.
      const sessions = await request(app).get("/api/harness/sessions");
      expect(sessions.status).toBe(200);
      return;
    }
    // No harness: every proxied route degrades to 502, and the mutating POST
    // fails closed without creating anything.
    const agents = await request(app).get("/api/harness/agents");
    expect(agents.status).toBe(502);
    const sessions = await request(app).get("/api/harness/sessions");
    expect(sessions.status).toBe(502);
    const created = await request(app).post("/api/harness/sessions").send({ prompt: "outage: restart api-gateway" });
    expect(created.status).toBe(502);
  });
});

describe("fallback routing", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not found");
  });
});
