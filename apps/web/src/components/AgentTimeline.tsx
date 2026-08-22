type Step = { id: string; role: string; text: string; tool?: string; output?: string; risk?: string; timestamp: string };

export function AgentTimeline({ steps }: { steps: Step[] }) {
  if (!steps.length) return <div className="text-sm text-muted py-8 text-center">No mission yet — dispatch one from the command bar.</div>;
  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <div key={s.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dot(s)}`} />
            <span className="w-px flex-1 bg-white/10 mt-1" />
          </div>
          <div className={`flex-1 rounded-xl border px-4 py-3 ${card(s)}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-wide uppercase opacity-70">{label(s)}</span>
              <span className="text-[11px] font-mono text-muted">{new Date(s.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: esc(s.text) }} />
            {s.tool && <div className="mt-2 text-xs font-mono text-muted">tool: {s.tool}{s.risk ? ` · risk ${s.risk}` : ""}</div>}
            {s.output && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words border border-white/10">
                {s.output}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function label(s: Step) {
  if (s.role === "hitl") return "⛔ Approval Gate";
  if (s.role === "tool") return "Tool";
  if (s.role === "user") return "Operator";
  return "Agent";
}
function dot(s: Step) {
  if (s.role === "hitl") return "bg-danger shadow-[0_0_8px_rgba(239,68,68,0.6)]";
  if (s.role === "tool") return "bg-accent";
  if (s.role === "user") return "bg-white";
  return "bg-warn";
}
function card(s: Step) {
  if (s.role === "hitl") return "bg-danger/10 border-danger/30";
  if (s.role === "tool") return "bg-white/[0.06] border-white/10";
  if (s.role === "user") return "bg-white/[0.04] border-white/10";
  return "bg-white/[0.06] border-white/10";
}
function esc(t: string) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">$1</code>');
}
