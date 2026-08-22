const BASE = "";

export type Session = {
  id: string;
  mission: { type: string; confidence: number; reason: string };
  subagent: string;
  steps: Array<{ id: string; role: string; text: string; tool?: string; args?: any; output?: string; risk?: string; timestamp: string }>;
  pendingApproval: null | { id: string; tool: string; args: any; risk: string; executionMode: string; reason: string; createdAt: string };
  status: string;
};

export async function createMission(prompt: string): Promise<Session> {
  const r = await fetch(`${BASE}/api/missions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function listMissions(): Promise<Session[]> {
  const r = await fetch(`${BASE}/api/missions`);
  return r.json();
}
export async function getMission(id: string): Promise<Session> {
  const r = await fetch(`${BASE}/api/missions/${id}`);
  return r.json();
}
export async function proposeTool(id: string, tool: string, args: any): Promise<Session> {
  const r = await fetch(`${BASE}/api/missions/${id}/tools`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool, args }) });
  return r.json();
}
export async function resolveApproval(id: string, approved: boolean, feedback?: string): Promise<Session> {
  const r = await fetch(`${BASE}/api/missions/${id}/approval`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved, feedback }) });
  return r.json();
}
