import { Router } from "express";
import { createSession, getSession, listSessions, proposeTool, resolveApproval } from "../orchestrator.js";

export const missionsRouter = Router();

// POST /api/missions — create a mission from user prompt
missionsRouter.post("/", (req, res) => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "prompt (string) required" });
  const session = createSession(prompt);
  res.status(201).json(session);
});

// GET /api/missions — list
missionsRouter.get("/", (_req, res) => res.json(listSessions()));

// GET /api/missions/:id
missionsRouter.get("/:id", (req, res) => {
  const s = getSession(req.params.id);
  if (!s) return res.status(404).json({ error: "not found" });
  res.json(s);
});

// POST /api/missions/:id/tools — propose a tool call (triggers HITL if needed)
missionsRouter.post("/:id/tools", (req, res) => {
  const { tool, args } = req.body ?? {};
  if (!tool) return res.status(400).json({ error: "tool required" });
  try {
    const session = proposeTool(req.params.id, tool, args ?? {});
    res.json(session);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
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
