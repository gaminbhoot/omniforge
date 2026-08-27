import { Router } from "express";
import { isHarnessAvailable, createHarnessSession, createHarnessTurn, getHarnessSession, listHarnessSessions, harnessAgentFor } from "../trueforge/harness.js";
import { classifyIntent, subagentFor } from "../policies/router.js";

export const harnessRouter = Router();

// GET /api/harness/health — is the real harness reachable?
harnessRouter.get("/health", async (_req, res) => {
  const ok = await isHarnessAvailable();
  res.json({ ok, url: process.env.TRUEFORGE_API_URL ?? "http://localhost:8790" });
});

// GET /api/harness/agents — list harness agents (ops-forge etc)
harnessRouter.get("/agents", async (_req, res) => {
  try {
    const r = await fetch(`${process.env.TRUEFORGE_API_URL ?? "http://localhost:8790"}/api/v1/agents`);
    const j = await r.json();
    res.status(r.status).json(j);
  } catch (e: unknown) {
    res.status(502).json({ error: String((e as Error).message ?? e) });
  }
});

// GET /api/harness/sessions — proxy to harness
harnessRouter.get("/sessions", async (_req, res) => {
  try {
    const data = await listHarnessSessions();
    res.json(data);
  } catch (e: unknown) {
    res.status(502).json({ error: String((e as Error).message ?? e) });
  }
});

// POST /api/harness/sessions — create via harness + classify intent for UI parity
harnessRouter.post("/sessions", async (req, res) => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "prompt (string) required" });
  try {
    const mission = classifyIntent(prompt);
    const subagent = subagentFor(mission);
    const agentName = harnessAgentFor(subagent);
    const session = await createHarnessSession(agentName);
    // also create first turn with the prompt so harness has context
    await createHarnessTurn(session.id, prompt);
    res.status(201).json({ ...session, mission, subagent, harness: true });
  } catch (e: unknown) {
    res.status(502).json({ error: String((e as Error).message ?? e) });
  }
});

// GET /api/harness/sessions/:id — proxy
harnessRouter.get("/sessions/:id", async (req, res) => {
  try {
    const data = await getHarnessSession(req.params.id);
    res.json(data);
  } catch (e: unknown) {
    res.status(502).json({ error: String((e as Error).message ?? e) });
  }
});

// POST /api/harness/sessions/:id/turns — create a turn (tool-like)
harnessRouter.post("/sessions/:id/turns", async (req, res) => {
  const { content } = req.body ?? {};
  if (!content || typeof content !== "string") return res.status(400).json({ error: "content (string) required" });
  try {
    const turn = await createHarnessTurn(req.params.id, content);
    res.status(201).json(turn);
  } catch (e: unknown) {
    res.status(502).json({ error: String((e as Error).message ?? e) });
  }
});
