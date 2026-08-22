import { ReactNode } from "react";

export function CockpitLayout({ header, main, side }: { header: ReactNode; main: ReactNode; side: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink bg-grid">
      <header className="sticky top-0 z-40 backdrop-blur border-b border-white/10 bg-ink/80">
        <div className="mx-auto max-w-[1280px] px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-lg bg-white text-ink grid place-items-center font-black text-sm">TF</span>
            <div>
              <div className="text-sm font-bold tracking-wide">
                OMNIFORGE <span className="font-normal text-muted">· Mission TF-007</span>
              </div>
              <div className="text-[11px] text-muted -mt-0.5">Autonomous Mission Control · Sandboxed · HITL Governed</div>
            </div>
          </div>
          {header}
        </div>
      </header>
      <div className="mx-auto max-w-[1280px] px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="min-w-0 space-y-6">{main}</div>
        <div className="space-y-6">{side}</div>
      </div>
      <footer className="mx-auto max-w-[1280px] px-4 py-6 text-center text-xs text-muted border-t border-white/10 mt-6">
        Built for The Agent Harness Hackathon (TrueForge) — WeMakeDevs × TrueFoundry × Qodo · Mission TF-007
      </footer>
    </div>
  );
}
