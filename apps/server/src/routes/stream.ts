import { Router } from "express";
import { getSession } from "../orchestrator.js";

export const streamRouter = Router();

// GET /api/stream/:id — SSE stream of session steps (simple polling-based for Phase 0)
streamRouter.get("/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).end();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // CORS is enforced by the app-level cors({ origin: CORS_ORIGIN }) middleware
    // — no wildcard here (SA-05).
  });

  const send = () => {
    const s = getSession(req.params.id);
    if (s) res.write(`data: ${JSON.stringify(s)}\n\n`);
  };

  send();
  const interval = setInterval(() => {
    const s = getSession(req.params.id);
    if (!s) {
      clearInterval(interval);
      res.end();
      return;
    }
    res.write(`data: ${JSON.stringify(s)}\n\n`);
  }, 1500);
  req.on("close", () => clearInterval(interval));
});
