/**
 * TrueForge Harness Bridge — thin proxy to the real harness at TRUEFORGE_API_URL
 * R1 for GAP-1: makes the "talks to real harness" claim true.
 * Keep our HITL engine as governance wrapping harness tool calls.
 *
 * Harness API (from dist/main.js): /api/v1/agents, /sessions, /sessions/:id/turns, /mcp-servers, /skills, /models
 * Local stub stays as fallback when harness is down (dev without `npx trueforge`).
 */

const HARNESS_URL = process.env.TRUEFORGE_API_URL ?? "http://localhost:8790";
const HARNESS_BASE = HARNESS_URL.replace(/\/$/, "");

async function harnessFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${HARNESS_BASE}${path}`;
  return fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string> ?? {}) },
  });
}

export async function isHarnessAvailable(): Promise<boolean> {
  try {
    const res = await harnessFetch("/api/v1/models", { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export type HarnessSession = { id: string; agent: { name: string; id: string } };
export type HarnessTurn = { id: string; state: { status: string; output?: unknown } };

export async function createHarnessSession(agentName: string): Promise<HarnessSession> {
  const res = await harnessFetch("/api/v1/sessions", {
    method: "POST",
    body: JSON.stringify({ agent: { name: agentName } }),
  });
  if (!res.ok) throw new Error(`harness create session ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: HarnessSession };
  return json.data;
}

export async function createHarnessTurn(sessionId: string, content: string): Promise<HarnessTurn> {
  const res = await harnessFetch(`/api/v1/sessions/${sessionId}/turns`, {
    method: "POST",
    body: JSON.stringify({ input: [{ type: "user.message", content }], stream: false }),
  });
  if (!res.ok) throw new Error(`harness create turn ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: HarnessTurn };
  return json.data;
}

export async function getHarnessSession(sessionId: string): Promise<unknown> {
  const res = await harnessFetch(`/api/v1/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`harness get session ${res.status}`);
  return res.json();
}

export async function listHarnessSessions(): Promise<unknown> {
  const res = await harnessFetch("/api/v1/sessions");
  if (!res.ok) throw new Error(`harness list ${res.status}`);
  return res.json();
}

// Map our subagent names to harness agent names (created in Phase 2)
const SUBAGENT_TO_HARNESS: Record<string, string> = {
  OpsForge: "ops-forge",
  SecurForge: "secur-forge",
  DataForge: "data-forge",
  General: "ops-forge",
};

export function harnessAgentFor(subagent: string): string {
  return SUBAGENT_TO_HARNESS[subagent] ?? "ops-forge";
}
