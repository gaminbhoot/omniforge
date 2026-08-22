// @ts-nocheck
/**
 * Verify route — exposes Muse's spec-verdict for Codex fixes.
 * POST   /api/verify          → run verifier on current diff (or supplied diff) and return verdict
 * POST   /api/verify/report   → ingest a verdict from the monitor daemon (broadcast path)
 * GET    /api/verify/latest   → last verdict (from memory + tmp file fallback)
 * GET    /api/verify/spec     → the canonical spec checklist
 */
import { Router } from "express";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SPEC } from "@omniforge/verifier/spec";
import { verify } from "@omniforge/verifier";

export const verifyRouter = Router();

// in-memory last verdict (survives till restart) + file fallback
let lastVerdict: any = null;
const LATEST_PATH = join(process.cwd(), "tmp", "codex-monitor", "latest.json");
function loadLatestFromDisk(): any {
  try { if (existsSync(LATEST_PATH)) return JSON.parse(readFileSync(LATEST_PATH,"utf-8")); } catch {}
  return null;
}

// POST /api/verify — trigger a verification run
verifyRouter.post("/", async (req, res) => {
  const { diff, stat, nameOnly, source, base, head, skipHeavy } = req.body ?? {};
  try {
    const verdict = await verify({ diff, stat, nameOnly, source, base, head, skipHeavy: Boolean(skipHeavy) });
    lastVerdict = verdict;
    res.json(verdict);
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? String(e) });
  }
});

// POST /api/verify/report — monitor daemon pushes verdict (no re-verify)
verifyRouter.post("/report", (req, res) => {
  const v = req.body;
  if (!v || !v.id) return res.status(400).json({ error: "verdict body required" });
  lastVerdict = v;
  res.json({ ok: true, id: v.id });
});

// GET /api/verify/latest
verifyRouter.get("/latest", (_req, res) => {
  const v = lastVerdict ?? loadLatestFromDisk();
  if (!v) return res.status(404).json({ error: "no verdict yet — trigger POST /api/verify or run the monitor daemon" });
  res.json(v);
});

// GET /api/verify/spec
verifyRouter.get("/spec", (_req, res) => {
  res.json(SPEC);
});

// GET /api/verify/health
verifyRouter.get("/health", (_req, res) => {
  res.json({ ok: true, spec: SPEC.id, version: SPEC.version, hasLatest: Boolean(lastVerdict ?? loadLatestFromDisk()) });
});
