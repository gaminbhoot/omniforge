import { useCallback, useEffect, useRef, useState } from "react";
import { FrameScreen, SectionMeta } from "./components/chrome/FrameScreen";
import { BootLoader } from "./components/chrome/BootLoader";
import { CustomCursor } from "./components/chrome/CustomCursor";
import { AmbientBackdrop } from "./components/chrome/AmbientBackdrop";
import { CrtGlitch } from "./components/chrome/CrtGlitch";
import { ArrowTick, CrossButton } from "./components/chrome/bits";
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

const SECTIONS: SectionMeta[] = [
  { id: "hero", label: "Intro" },
  { id: "command", label: "Mission" },
  { id: "intel", label: "Intel" },
  { id: "colophon", label: "End" },
];

const MENU = [
  { label: "github", href: "https://github.com/gaminbhoot/omniforge", external: true },
  { label: "readme", href: "https://github.com/gaminbhoot/omniforge#readme", external: true },
  { label: "health", href: "/api/health", external: true },
];

export default function App() {
  const [module, setModule] = useState("ops");
  const [prompt, setPrompt] = useState(PRESETS.ops.prompt);
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const dismissedRef = useRef<string | null>(null);

  const [booted, setBooted] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [scrollPct, setScrollPct] = useState(0);
  const [heroFade, setHeroFade] = useState(1);
  const [glitchTick, setGlitchTick] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const zoomTimer = useRef<number>(0);
  const lastZoom = useRef("");
  const activeRef = useRef("hero");

  const clearZoom = useCallback(() => {
    document.querySelectorAll(".sec-zoom-out, .sec-zoom-in").forEach((el) =>
      el.classList.remove("sec-zoom-out", "sec-zoom-in", "zoom-fwd", "zoom-bwd")
    );
  }, []);

  const fireZoom = useCallback((fromId: string, toId: string, fwd: boolean) => {
    if (fromId === toId) return;
    const key = `${fromId}>${toId}:${fwd ? "f" : "b"}`;
    if (lastZoom.current === key) return;
    lastZoom.current = key;
    clearZoom();
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    fromEl?.classList.add("sec-zoom-out", fwd ? "zoom-fwd" : "zoom-bwd");
    toEl?.classList.add("sec-zoom-in", fwd ? "zoom-fwd" : "zoom-bwd");
    window.clearTimeout(zoomTimer.current);
    zoomTimer.current = window.setTimeout(clearZoom, 760);
  }, []);

  useEffect(() => {
    setPrompt(PRESETS[module].prompt);
  }, [module]);

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

  const handleScroll = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.round((el.scrollTop / max) * 100) : 0;
    setScrollPct(pct);
    setHeroFade(Math.max(0, Math.min(1, 1 - el.scrollTop / (el.clientHeight * 0.5))));
    const mid = el.scrollTop + el.clientHeight * 0.4;
    let current = SECTIONS[0].id;
    for (const s of SECTIONS) {
      const node = document.getElementById(s.id);
      if (node && node.offsetTop <= mid) current = s.id;
    }
    setActiveSection(current);
    if (current !== activeRef.current) {
      const prevIdx = SECTIONS.findIndex((s) => s.id === activeRef.current);
      const nextIdx = SECTIONS.findIndex((s) => s.id === current);
      fireZoom(SECTIONS[Math.max(0, prevIdx)].id, current, nextIdx > prevIdx);
      activeRef.current = current;
    }
  }, [fireZoom]);

  const navigate = useCallback((id: string) => {
    const prevIdx = SECTIONS.findIndex((s) => s.id === activeRef.current);
    const nextIdx = SECTIONS.findIndex((s) => s.id === id);
    if (prevIdx !== nextIdx) fireZoom(SECTIONS[Math.max(0, prevIdx)].id, id, nextIdx > prevIdx);
    setGlitchTick((t) => t + 1);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [fireZoom]);

  // random idle glitches — fires every 6–16s once booted
  useEffect(() => {
    if (!booted) return;
    let t: number;
    const schedule = () => {
      t = window.setTimeout(() => {
        setGlitchTick((v) => v + 1);
        schedule();
      }, 6000 + Math.random() * 10000);
    };
    schedule();
    return () => clearTimeout(t);
  }, [booted]);

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
  const replan = [...(session?.steps ?? [])].reverse().find((s) => s.suggest)?.suggest;
  const pending = session?.pendingApproval ? 1 : 0;
  const stepCount = session?.steps?.length ?? 0;

  const tickers = [
    { icon: "SES", title: "Session", value: session ? session.id.slice(0, 8) : "—", change: session?.status, dir: "up" as const },
    { icon: "STP", title: "Steps", value: String(stepCount).padStart(2, "0"), change: stepCount ? "+run" : undefined, dir: "up" as const },
    { icon: "GTE", title: "Gate", value: String(pending), change: pending ? "await" : "clear", dir: pending ? ("down" as const) : ("up" as const) },
  ];

  return (
    <>
      <BootLoader
        onDone={() => {
          setBooted(true);
          setGlitchTick((t) => t + 1);
        }}
      />
      <CrtGlitch tick={glitchTick} />
      <CustomCursor />
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

      <AmbientBackdrop />
      <div
        ref={stageRef}
        onScroll={handleScroll}
        className="stage relative"
        style={{ opacity: booted ? 1 : 0, transition: "opacity .6s ease" }}
      >
        {/* ---------- HERO ---------- */}
        <section id="hero" className="snap-sec" style={{ padding: 0 }}>
          <div className="wrap relative z-10 flex min-h-[100dvh] flex-col justify-center">
            <ul className="tags mb-8">
              <li>Mission Control</li>
              <li>Sandboxed</li>
              <li>HITL Governed</li>
              <li>MCP Native</li>
            </ul>
            <h1 className="h-big max-w-4xl" data-cursor-text="Dispatch below">
              <span className="glitch-wrap" data-text="Autonomous agents,">Autonomous agents,</span>
              <br />
              <b>governed by humans</b>
            </h1>
            <p className="lede mt-6">
              OmniForge runs ops, security and data missions through sandboxed agents — while every critical
              step waits at your approval gate. Diagnose outages, patch CVEs, move data.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <CrossButton onClick={() => navigate("command")} cursorText="Start mission">
                Dispatch Mission
              </CrossButton>
              <CrossButton onClick={() => navigate("colophon")} cursorText="Project info">
                About the Forge
              </CrossButton>
            </div>
          </div>
        </section>

        {/* ---------- COMMAND ---------- */}
        <section id="command" className="snap-sec">
          <div className="wrap grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0 space-y-6">
              <div className="panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ModuleSwitcher active={module} onChange={setModule} />
                  <span className="font-mono text-[11px] uppercase tracking-[1px] text-white/50">
                    Subagent: <span className="text-white">{session?.subagent ?? "—"}</span>
                    {session && ` · ${session.status}`}
                  </span>
                </div>

                <div className="mt-5">
                  <label className="panel-label">Mission prompt</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    className="field mt-2 leading-relaxed"
                    placeholder="Describe the mission…"
                  />
                  <div className="mt-4 flex items-center gap-4">
                    <CrossButton onClick={dispatchMission} disabled={busy || !prompt.trim()} cursorText="Send to orchestrator">
                      {busy ? "Dispatching…" : "▶ Dispatch Mission"}
                    </CrossButton>
                    {session && <span className="font-mono text-[11px] text-white/40">{session.id}</span>}
                  </div>
                </div>

                {session && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {PRESETS[module].tools.map((t) => (
                      <button key={t.tool} onClick={() => fireTool(t.tool, t.args)} disabled={busy} className="chip-btn" data-cursor-text={`Run ${t.tool}`}>
                        ▶ {t.tool}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel p-5">
                <h2 className="text-sm font-normal tracking-[0.08em] uppercase">Agent Timeline</h2>
                <p className="panel-label mt-1">Live reasoning · tool calls · HITL gates — streams from orchestrator</p>
                <div className="mt-5">
                  <AgentTimeline steps={session?.steps ?? []} />
                </div>
                {replan && (
                  <button
                    onClick={() => replan && fireTool(replan.tool, replan.args)}
                    disabled={busy}
                    className="mt-4 w-full border border-warn/40 bg-warn/10 px-4 py-2.5 font-mono text-[12px] uppercase tracking-[1px] text-warn transition hover:bg-warn/20 disabled:opacity-40"
                    data-cursor-text="Apply replan"
                  >
                    ↻ Apply agent replan → {replan.tool}
                  </button>
                )}
              </div>
            </div>

            {/* ---------- INTEL (side on desktop) ---------- */}
            <div id="intel" className="space-y-6 scroll-mt-24">
              <TerminalStream output={lastToolOutput} status={session?.status} />
              <div className="panel p-5">
                <h3 className="text-sm font-normal uppercase tracking-[0.08em]">HITL Policy Matrix</h3>
                <table className="policy-table mt-4">
                  <thead>
                    <tr>
                      <th>Tool</th>
                      <th>Risk</th>
                      <th>Gate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="text-white/80">read_logs</td><td className="text-accent">LOW</td><td>auto</td></tr>
                    <tr><td className="text-white/80">run_diagnostic_script</td><td className="text-warn">MED</td><td>sandbox auto</td></tr>
                    <tr><td className="text-white/80">create_patch_pr</td><td className="text-warn">HIGH</td><td>approval</td></tr>
                    <tr><td className="text-white/80">restart_service</td><td className="text-danger">CRIT</td><td>1-click</td></tr>
                    <tr><td className="text-white/80">execute_write</td><td className="text-danger">CRIT</td><td>1-click</td></tr>
                  </tbody>
                </table>
                <p className="mt-4 text-xs font-light leading-relaxed text-white/50">
                  Try it: run <code className="bg-white/10 px-1 font-mono">restart_service</code> → the approval modal opens →
                  Approve → the terminal confirms execution.
                </p>
              </div>
              <div className="panel p-5">
                <h3 className="text-sm font-normal uppercase tracking-[0.08em]">Project Links</h3>
                <ul className="mt-3 space-y-2 text-xs font-light text-white/60">
                  <li><a className="hover:text-white" href="https://github.com/gaminbhoot/omniforge#readme" target="_blank" rel="noreferrer">README — overview and quick start</a></li>
                  <li><a className="hover:text-white" href="https://github.com/gaminbhoot/omniforge/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">CONTRIBUTING — conventions and PR checklist</a></li>
                  <li><a className="hover:text-white" href="https://github.com/truefoundry/trueforge" target="_blank" rel="noreferrer">TrueForge — agent harness runtime</a></li>
                  <li><a className="hover:text-white" href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">Model Context Protocol</a></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- COLOPHON ---------- */}
        <section id="colophon" className="snap-sec">
          <div className="wrap flex flex-col items-center text-center">
            <svg viewBox="0 0 190 22" className="h-6 w-auto max-w-[280px]" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <text x="0" y="17" fill="white" fontFamily="Inter, sans-serif" fontSize="20" fontWeight="300" letterSpacing="6">
                OMNIFORGE
              </text>
            </svg>
            <p className="lede mt-6 max-w-md">
              Autonomous multi-agent mission control with sandboxed execution and human-in-the-loop governance.
            </p>
            <ul className="tags mt-8 justify-center">
              <li>TrueForge</li>
              <li>MCP</li>
              <li>Qodo</li>
            </ul>
            <div className="mt-10">
              <CrossButton onClick={() => navigate("hero")} cursorText="Back to top">
                ↑ Back to intro
              </CrossButton>
            </div>
            <p className="panel-label mt-12">Built on TrueForge, Model Context Protocol, and Qodo — WeMakeDevs × TrueFoundry</p>
          </div>
        </section>
      </div>

      <FrameScreen
        sections={SECTIONS}
        activeSection={activeSection}
        scrollPct={scrollPct}
        scrollHintOpacity={heroFade}
        onNavigate={navigate}
        quote="Agents execute in the sandbox — humans hold the gates"
        tickers={tickers}
        sessionLine={session ? `${session.id} · ${session.status}` : "no active session"}
        menu={
          <>
            {MENU.map((m) => (
              <li key={m.label}>
                <a href={m.href} target="_blank" rel="noopener noreferrer" className="menu-link" data-cursor-text={m.label}>
                  {m.label}
                  <ArrowTick />
                </a>
              </li>
            ))}
          </>
        }
      />
    </>
  );
}
