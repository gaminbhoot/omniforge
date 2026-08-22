type Props = { title?: string; output?: string; status?: string };

export function TerminalStream({ title = "Sandbox Terminal", output, status }: Props) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-black/60">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.04]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="ml-2 text-xs font-mono tracking-wide text-muted">{title}</span>
        </div>
        {status && <span className="text-[11px] font-mono px-2 py-1 rounded bg-white/10 border border-white/10">{status}</span>}
      </div>
      <pre className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-auto text-zinc-200">
        {output ?? "$ awaiting sandbox output…\n$ tip: run a diagnostic via proposeTool → run_diagnostic_script"}
      </pre>
    </div>
  );
}
