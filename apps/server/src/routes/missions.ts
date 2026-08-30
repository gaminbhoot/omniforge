import { Router } from "express";
import { createSession, getSession, listSessions, proposeTool, resolveApproval, resumeSession, fanoutSquad } from "../orchestrator.js";

export const missionsRouter = Router();

// POST /api/missions — create a mission from user prompt
missionsRouter.post("/", (req, res) => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "prompt (string) required" });
  const session = createSession(prompt);
  res.status(201).json(session);
});

// POST /api/missions/squad — parallel subagent fan-out (one session per matched domain)
missionsRouter.post("/squad", (req, res) => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "prompt (string) required" });
  const squad = fanoutSquad(prompt);
  res.status(201).json(squad);
});

// GET /api/missions — list
missionsRouter.get("/", (_req, res) => res.json(listSessions()));

// GET /api/missions/:id
missionsRouter.get("/:id", (req, res) => {
  const s = getSession(req.params.id);
  if (!s) return res.status(404).json({ error: "not found" });
  res.json(s);
});

// POST /api/missions/:id/resume — follow-up on the same session (persistent context)
missionsRouter.post("/:id/resume", (req, res) => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "prompt (string) required" });
  try {
    const session = resumeSession(req.params.id, prompt);
    res.json(session);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

// POST /api/missions/:id/tools — propose a tool call (triggers HITL if needed)
missionsRouter.post("/:id/tools", (req, res) => {
  const { tool, args } = req.body ?? {};
  if (typeof tool !== "string" || !tool) return res.status(400).json({ error: "tool (string) required" });
  if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) {
    return res.status(400).json({ error: "args (object) required" });
  }
  try {
    const session = proposeTool(req.params.id, tool, args ?? {});
    res.json(session);
  } catch (e: any) {
    const code = String(e?.message ?? "").includes("not found") ? 404 : 409;
    res.status(code).json({ error: e.message });
  }
});

// POST /api/missions/:id/approval — approve/reject pending HITL
missionsRouter.post("/:id/approval", (req, res) => {
  const { approved, feedback } = req.body ?? {};
  if (typeof approved !== "boolean") return res.status(400).json({ error: "approved (boolean) required" });
  try {
    const session = resolveApproval(req.params.id, approved, feedback);
    res.json(session);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
