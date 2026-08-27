const BASE = "";

async function request(path: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`${BASE}${path}`, init);
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
  steps: Array<{ id: string; role: string; text: string; tool?: string; args?: any; output?: string; risk?: string; timestamp: string }>;
  pendingApproval: null | { id: string; tool: string; args: any; risk: string; executionMode: string; reason: string; createdAt: string };
  status: string;
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
