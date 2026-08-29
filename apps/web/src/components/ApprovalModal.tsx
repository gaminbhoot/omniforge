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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-white/15 bg-panel shadow-2xl overflow-hidden">
        <div className="px-6 pt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/15 px-3 py-1 text-xs font-bold tracking-wide text-red-200">
            HUMAN-IN-THE-LOOP — {request.risk}
          </div>
          <h2 className="mt-3 text-lg font-bold">Approval required</h2>
          <p className="mt-1 text-sm text-muted">{request.reason}</p>
        </div>

        <div className="mx-6 mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="text-xs font-mono text-muted">tool</div>
          <div className="font-mono text-sm font-semibold">{request.tool}</div>
          <div className="mt-3 text-xs font-mono text-muted">args &amp; execution</div>
          <pre className="mt-1 max-h-40 overflow-auto text-xs font-mono whitespace-pre-wrap break-words bg-white/[0.04] p-3 rounded-lg border border-white/10">
            {JSON.stringify({ executionMode: request.executionMode, args: request.args }, null, 2)}
          </pre>
          <p className="mt-3 text-xs text-muted">
            Execution mode: <span className="text-white font-semibold">{request.executionMode}</span> · This action will run on the {request.executionMode === "sandbox" ? "isolated sandbox" : "target system"} only after approval.
          </p>
        </div>

        <div className="flex gap-3 p-6">
          <button onClick={onApprove} className="flex-1 rounded-xl bg-accent text-ink font-bold py-2.5 hover:brightness-110 transition">
            ✓ Approve &amp; Execute
          </button>
          <button
            onClick={() => {
              const fb = prompt("Reason for rejection (sent to agent):") ?? "";
              onReject(fb);
            }}
            className="flex-1 rounded-xl bg-white/10 border border-white/15 font-semibold py-2.5 hover:bg-white/15 transition"
          >
            ✕ Reject
          </button>
        </div>
        <div className="px-6 pb-4 text-[11px] text-muted text-center">Request {request.id} · All approvals are audit-logged</div>
      </div>
    </div>
  );
}
