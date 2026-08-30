import { Router } from "express";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isHarnessAvailable, createHarnessSession, createHarnessTurn, getHarnessSession, listHarnessSessions, harnessAgentFor, listHarnessSkills, registerHarnessSkill } from "../trueforge/harness.js";
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

// GET /api/harness/skills — list skills registered with the harness
harnessRouter.get("/skills", async (_req, res) => {
  try {
    const data = await listHarnessSkills();
    res.json(data);
  } catch (e: unknown) {
    res.status(502).json({ error: String((e as Error).message ?? e) });
  }
});

// POST /api/harness/skills/register — register every skills/<agent>/SKILL.md with the harness
const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../skills");

harnessRouter.post("/skills/register", async (_req, res) => {
  try {
    const agents = await readdir(SKILLS_DIR, { withFileTypes: true });
    const results: Array<{ skill: string; ok: boolean; detail?: string }> = [];
    for (const entry of agents) {
      if (!entry.isDirectory()) continue;
      try {
        const content = await readFile(join(SKILLS_DIR, entry.name, "SKILL.md"), "utf8");
        const skill = parseSkillMd(entry.name, content);
        await registerHarnessSkill(skill);
        results.push({ skill: entry.name, ok: true });
      } catch (e: unknown) {
        results.push({ skill: entry.name, ok: false, detail: String((e as Error).message ?? e) });
      }
    }
    res.json({ registered: results.filter((r) => r.ok).length, results });
  } catch (e: unknown) {
    res.status(502).json({ error: String((e as Error).message ?? e) });
  }
});

/** Minimal SKILL.md frontmatter parser — `name:` and `description:` keys, body preserved. */
function parseSkillMd(dirName: string, content: string) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = fm?.[1] ?? "";
  const name = meta.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? dirName;
  const description = meta.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? `${dirName} runbook`;
  const body = fm ? content.slice(fm[0].length) : content;
  return { name, description, content: body };
}
