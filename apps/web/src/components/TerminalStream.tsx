import { FrameCorners } from "./chrome/bits";

type Props = { title?: string; output?: string; status?: string };

export function TerminalStream({ title = "Sandbox Terminal", output, status }: Props) {
  return (
    <div className="panel scanlines" data-cursor-text="Sandbox feed">
      <FrameCorners size={4} />
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="panel-label">{title}</span>
        {status && <span className="border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[1px]">{status}</span>}
      </div>
      <pre className="max-h-64 overflow-auto p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-white/80">
        {output ?? "$ awaiting sandbox output…\n$ tip: run a diagnostic via proposeTool → run_diagnostic_script"}
      </pre>
    </div>
  );
}
