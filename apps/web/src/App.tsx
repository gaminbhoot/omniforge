import { useEffect, useRef, useState } from "react";
import { CockpitLayout } from "./components/CockpitLayout";
import { ModuleSwitcher } from "./components/ModuleSwitcher";
import { AgentTimeline } from "./components/AgentTimeline";
import { TerminalStream } from "./components/TerminalStream";
import { ApprovalModal } from "./components/ApprovalModal";
import { createMission, getMission, proposeTool, resolveApproval } from "./lib/api";
import type { Session } from "./lib/api";

const PRESETS: Record<string, { prompt: string; tools: Array<{ tool: string; args: any }> }> = {
  ops: {
    prompt: "Outage alert: api-gateway p99 latency 600ms, error rate 12% — diagnose and propose recovery",
    tools: [
      { tool: "read_logs", args: { service: "api-gateway", tail: 50 } },
      { tool: "get_metrics", args: { service: "api-gateway", window: "5m" } },
      { tool: "run_diagnostic_script", args: { language: "python", code: "print('checking latency buckets... ok')" } },
      { tool: "restart_service", args: { service: "api-gateway", strategy: "rolling" } },
    ],
  },
  security: {
    prompt: "CVE-2021-23337 in lodash 4.17.20 — simulate exploit in sandbox and prepare patch PR",
    tools: [
      { tool: "scan_dependencies", args: { manifest: "all" } },
      { tool: "test_exploit", args: { cve: "CVE-2021-23337", language: "python", exploit_code: "print('exploit reproduced in sandbox')" } },
      { tool: "create_patch_pr", args: { branch: "fix/CVE-2021-23337", title: "fix: bump lodash 4.17.20 → 4.17.21", body: "Automated patch (mock)" } },
    ],
  },
  data: {
    prompt: "ETL: join users + orders CSVs, validate schema, stage for warehouse load",
    tools: [
      { tool: "list_tables", args: { connection: "duckdb" } },
      { tool: "query_readonly", args: { sql: "SELECT * FROM users LIMIT 5", connection: "duckdb" } },
      { tool: "run_etl_script", args: { language: "python", code: "import pandas as pd, duckdb\nprint('etl mock — 1200 rows transformed')" } },
      { tool: "execute_write", args: { sql: "INSERT INTO warehouse.orders SELECT * FROM staging.orders", connection: "postgres", dryRun: false } },
    ],
  },
};

export default function App() {
  const [module, setModule] = useState("ops");
  const [prompt, setPrompt] = useState(PRESETS.ops.prompt);
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const dismissedRef = useRef<string | null>(null);

  useEffect(() => {
    setPrompt(PRESETS[module].prompt);
  }, [module]);

  // Poll session if awaiting
  useEffect(() => {
    if (!session) return;
    const id = setInterval(async () => {
      try {
        const s = await getMission(session.id);
        setSession(s);
        if (s.pendingApproval && s.pendingApproval.id !== dismissedRef.current) setApprovalOpen(true);
      } catch {}
    }, 1500);
    return () => clearInterval(id);
  }, [session?.id]);

  async function dispatchMission() {
    setBusy(true);
    try {
      const s = await createMission(prompt);
      setSession(s);
      dismissedRef.current = null;
    } catch (e: any) {
      alert(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function fireTool(tool: string, args: any) {
    if (!session) return;
    setBusy(true);
    try {
      const s = await proposeTool(session.id, tool, args);
      setSession(s);
      dismissedRef.current = null;
      if (s.pendingApproval) setApprovalOpen(true);
    } catch (e: any) {
      alert(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!session) return;
    try {
      const s = await resolveApproval(session.id, true);
      setSession(s);
      setApprovalOpen(false);
    } catch (e: any) {
      alert(String(e.message ?? e));
    }
  }
  async function reject(feedback: string) {
    if (!session) return;
    try {
      const s = await resolveApproval(session.id, false, feedback);
      setSession(s);
      setApprovalOpen(false);
    } catch (e: any) {
      alert(String(e.message ?? e));
    }
  }

  const lastToolOutput = [...(session?.steps ?? [])].reverse().find((s) => s.output)?.output;

  return (
    <>
      <ApprovalModal
        open={approvalOpen}
        request={session?.pendingApproval ?? null}
        onApprove={approve}
        onReject={reject}
        onClose={() => {
          dismissedRef.current = session?.pendingApproval?.id ?? null;
          setApprovalOpen(false);
        }}
      />
      <CockpitLayout
      header={
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-xs font-mono px-2 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent">Phase 3 Cockpit · Live</span>
          <a href="/api/health" target="_blank" className="text-xs text-muted hover:text-white underline">health</a>
        </div>
      }
      main={
        <>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ModuleSwitcher active={module} onChange={setModule} />
              <span className="text-xs text-muted">Subagent: <span className="text-white font-semibold">{session?.subagent ?? "—"}</span> {session && `· ${session.status}`}</span>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold tracking-wide uppercase text-muted">Mission prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="Describe the mission…"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={dispatchMission}
                  disabled={busy || !prompt.trim()}
                  className="rounded-xl bg-white text-ink font-bold px-5 py-2.5 text-sm disabled:opacity-40 hover:brightness-110 transition"
                >
                  {busy ? "Dispatching…" : "▶ Dispatch Mission"}
                </button>
                {session && (
                  <span className="self-center text-xs font-mono text-muted">{session.id}</span>
                )}
              </div>
            </div>

            {session && (
              <div className="mt-4 flex flex-wrap gap-2">
                {PRESETS[module].tools.map((t) => (
                  <button
                    key={t.tool}
                    onClick={() => fireTool(t.tool, t.args)}
                    disabled={busy}
                    className="text-xs font-mono rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 hover:bg-white/10 disabled:opacity-40"
                  >
                    ▶ {t.tool}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-bold">Agent Timeline</h2>
            <p className="text-xs text-muted">Live reasoning · tool calls · HITL gates — streams from orchestrator</p>
            <div className="mt-4">
              <AgentTimeline steps={session?.steps ?? []} />
            </div>
          </div>
        </>
      }
      side={
        <>
          <TerminalStream output={lastToolOutput} status={session?.status} />
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <h3 className="text-sm font-bold">HITL Policy Matrix</h3>
            <table className="mt-3 w-full text-xs">
              <thead className="text-muted">
                <tr><th className="text-left font-normal">Tool</th><th className="text-left font-normal">Risk</th><th className="text-left font-normal">Gate</th></tr>
              </thead>
              <tbody className="font-mono">
                <tr><td>read_logs</td><td className="text-accent">LOW</td><td>auto</td></tr>
                <tr><td>run_diagnostic</td><td className="text-warn">MED</td><td>sandbox auto</td></tr>
                <tr><td>create_patch_pr</td><td className="text-warn">HIGH</td><td>approval</td></tr>
                <tr><td>restart_service</td><td className="text-danger">CRIT</td><td>1-click</td></tr>
                <tr><td>execute_write</td><td className="text-danger">CRIT</td><td>1-click</td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">The ✦ moment for judges: fire <code className="bg-white/10 px-1 rounded">restart_service</code> → modal pops → Approve → terminal confirms.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <h3 className="text-sm font-bold">Project Docs</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              <li><a className="hover:text-white underline" href="/docs/HACKATHON_GUIDE.md" target="_blank">HACKATHON_GUIDE.md</a></li>
              <li><a className="hover:text-white underline" href="/docs/ARCHITECTURE_SPEC.md" target="_blank">ARCHITECTURE_SPEC.md</a></li>
              <li><a className="hover:text-white underline" href="/docs/STEP_BY_STEP_PLAYBOOK.md" target="_blank">STEP_BY_STEP_PLAYBOOK.md</a></li>
              <li><a className="hover:text-white underline" href="/docs/SUBMISSION_CHECKLIST.md" target="_blank">SUBMISSION_CHECKLIST.md</a></li>
            </ul>
          </div>
        </>
      }
    />
    </>
  );
}
