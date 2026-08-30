type Step = { id: string; role: string; text: string; tool?: string; output?: string; risk?: string; timestamp: string };

export function AgentTimeline({ steps }: { steps: Step[] }) {
  if (!steps.length)
    return <div className="py-10 text-center font-mono text-[12px] uppercase tracking-[1px] text-white/40">No mission yet — dispatch one from the command bar</div>;
  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <div key={s.id} className="flex gap-3">
          <div className="flex flex-col items-center pt-2">
            <span className={`h-2 w-2 ${dot(s)}`} />
            <span className="mt-1 w-px flex-1 bg-white/10" />
          </div>
          <div className={`tl-card flex-1 ${s.role === "hitl" ? "hitl" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="panel-label">{label(s)}</span>
              <span className="font-mono text-[11px] text-white/40">{new Date(s.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="mt-1.5 text-sm font-light leading-relaxed whitespace-pre-wrap break-words text-white/90" dangerouslySetInnerHTML={{ __html: esc(s.text) }} />
            {s.tool && (
              <div className="mt-2 font-mono text-[11px] uppercase tracking-[1px] text-white/40">
                tool: <span className="text-white/80">{s.tool}</span>
                {s.risk ? ` · risk ${s.risk}` : ""}
              </div>
            )}
            {s.output && <pre className="tl-out">{s.output}</pre>}
          </div>
        </div>
      ))}
    </div>
  );
}

function label(s: Step) {
  if (s.role === "hitl") return "Approval Gate";
  if (s.role === "tool") return "Tool";
  if (s.role === "user") return "Operator";
  return "Agent";
}
function dot(s: Step) {
  if (s.role === "hitl") return "bg-danger";
  if (s.role === "tool") return "bg-accent";
  if (s.role === "user") return "bg-white";
  return "bg-warn";
}
function esc(t: string) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1 py-0.5 font-mono text-xs">$1</code>');
}
