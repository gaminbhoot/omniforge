const BASE = "";

// When the server runs with OMNIFORGE_TOKEN set, mutating requests must carry
// it. The cockpit picks it up from VITE_OMNIFORGE_TOKEN at build/dev time.
const API_TOKEN = (import.meta as any).env?.VITE_OMNIFORGE_TOKEN as string | undefined;

async function request(path: string, init?: RequestInit): Promise<any> {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) ?? {}),
    ...(API_TOKEN ? { "X-API-Key": API_TOKEN } : {}),
  };
  const r = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const body = await r.json();
      if (body?.error) msg = body.error;
    } catch { /* non-JSON error body */ }
    throw new Error(msg);
  }
  return r.json();
}

export type Session = {
  id: string;
  mission: { type: string; confidence: number; reason: string };
  subagent: string;
  steps: Array<{ id: string; role: string; text: string; tool?: string; args?: any; output?: string; risk?: string; suggest?: { tool: string; args: any }; timestamp: string }>;
  pendingApproval: null | { id: string; tool: string; args: any; risk: string; executionMode: string; reason: string; createdAt: string };
  status: string;
  harnessSessionId?: string;
  harnessAgent?: string;
  squadId?: string;
};

export async function createMission(prompt: string): Promise<Session> {
  return request("/api/missions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
}
export async function listMissions(): Promise<Session[]> {
  return request("/api/missions");
}
export async function getMission(id: string): Promise<Session> {
  return request(`/api/missions/${id}`);
}
export async function proposeTool(id: string, tool: string, args: any): Promise<Session> {
  return request(`/api/missions/${id}/tools`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool, args }) });
}
export async function resolveApproval(id: string, approved: boolean, feedback?: string): Promise<Session> {
  return request(`/api/missions/${id}/approval`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved, feedback }) });
}
export async function resumeMission(id: string, prompt: string): Promise<Session> {
  return request(`/api/missions/${id}/resume`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
}
export async function createSquad(prompt: string): Promise<{ squadId: string; sessions: Session[] }> {
  return request("/api/missions/squad", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
}

// TrueForge harness proxy (R1 — makes the README claim true)
// These hit the real harness at TRUEFORGE_API_URL via the server's /api/harness/* proxy.
export async function getHarnessHealth(): Promise<{ ok: boolean; url: string }> {
  return request("/api/harness/health");
}
export async function createHarnessMission(prompt: string): Promise<any> {
  return request("/api/harness/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
}
export async function listHarnessSessions(): Promise<any> {
  return request("/api/harness/sessions");
}
