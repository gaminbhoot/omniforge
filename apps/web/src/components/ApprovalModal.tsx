import { CrossButton, CrossCorners } from "./chrome/bits";

type Props = {
  open: boolean;
  request: { id: string; tool: string; args: any; risk: string; executionMode: string; reason: string } | null;
  onApprove: () => void;
  onReject: (feedback: string) => void;
  onClose: () => void;
};

export function ApprovalModal({ open, request, onApprove, onReject, onClose }: Props) {
  if (!open || !request) return null;
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-box" data-cursor-text="HITL gate" onClick={(e) => e.stopPropagation()}>
        <CrossCorners />
        <div className="risk-badge">
          <span className="h-1.5 w-1.5 bg-danger" />
          Human-in-the-loop — {request.risk}
        </div>
        <h2 className="mt-4 text-xl font-light tracking-tight">Approval required</h2>
        <p className="mt-1.5 text-sm font-light leading-relaxed text-white/60">{request.reason}</p>

        <div className="mt-5 border border-white/10 bg-black/40 p-4">
          <div className="panel-label">tool</div>
          <div className="font-mono text-sm">{request.tool}</div>
          <div className="mt-4 panel-label">args &amp; execution</div>
          <pre className="mt-1.5 max-h-40 overflow-auto border border-white/10 bg-white/[0.04] p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
            {JSON.stringify({ executionMode: request.executionMode, args: request.args }, null, 2)}
          </pre>
          <p className="mt-3 text-xs font-light text-white/50">
            Execution mode: <span className="text-white">{request.executionMode}</span> · runs on the{" "}
            {request.executionMode === "sandbox" ? "isolated sandbox" : "target system"} only after approval.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <div className="flex-1">
            <CrossButton onClick={onApprove} cursorText="Execute" className="w-full">
              <span className="font-sans font-normal normal-case">Approve &amp; Execute</span>
            </CrossButton>
          </div>
          <div className="flex-1">
            <CrossButton
              onClick={() => {
                const fb = prompt("Reason for rejection (sent to agent):") ?? "";
                onReject(fb);
              }}
              cursorText="Send back"
              className="w-full"
            >
              <span className="font-sans font-normal normal-case">Reject</span>
            </CrossButton>
          </div>
        </div>
        <div className="mt-4 text-center font-mono text-[10px] uppercase tracking-[1px] text-white/40">
          Request {request.id} · All approvals are audit-logged
        </div>
      </div>
    </div>
  );
}
