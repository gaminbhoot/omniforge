import { ReactNode } from "react";
import { Cross, FrameCorners, ArrowTick, LogoMark } from "./bits";
import { DebugClock, DebugCursor } from "./DebugReadout";

export type SectionMeta = { id: string; label: string };

type TickerItem = { icon: string; title: string; value: string; change?: string; dir?: "up" | "down" };

function ChangeArrow({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {dir === "up" ? <path d="M6 8H2L4 5.5L6 8Z" fill="#7dd493" /> : <path d="M6 5.5H2L4 8L6 5.5Z" fill="#fb8989" />}
    </svg>
  );
}

export function FrameScreen({
  sections,
  activeSection,
  scrollPct,
  scrollHintOpacity = 1,
  onNavigate,
  menu,
  quote,
  tickers,
  sessionLine,
  children,
}: {
  sections: SectionMeta[];
  activeSection: string;
  scrollPct: number;
  scrollHintOpacity?: number;
  onNavigate: (id: string) => void;
  menu: ReactNode;
  quote: string;
  tickers: TickerItem[];
  sessionLine: string;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="frame">
        <FrameCorners />
        <header className="frame-header">
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("hero");
            }}
            className="flex items-center gap-3 no-underline"
            data-cursor-text="Top"
          >
            <LogoMark size={18} />
            <span className="font-mono text-[12px] tracking-[0.2em] uppercase text-white">OmniForge</span>
          </a>
          <ul className="menu-list">{menu}</ul>
        </header>

        <div className="frame-footer">
          <div className="quote">
            <span className="quote-dot">OF</span>
            <p>{quote}</p>
          </div>

          <div
            className="scroll-hint"
            style={{ opacity: scrollHintOpacity, visibility: scrollHintOpacity <= 0.01 ? "hidden" : "visible" }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="5" y="3.5" width="10" height="15" rx="3.5" stroke="white" />
              <rect x="9.5" y="6" width="1" height="4" rx="0.5" fill="white" />
            </svg>
            <span>Scroll down</span>
          </div>

          <div className="flex items-end">
            <div className="tickers">
              {tickers.map((t, i) => (
                <div key={t.title} className="flex items-center">
                  {i > 0 && <span className="ticker-div" />}
                  <div className="ticker">
                    <span className="ticker-ico">{t.icon}</span>
                    <div>
                      <span className="ticker-title">{t.title}</span>
                      <span className="ticker-val">
                        {t.value}
                        {t.change && (
                          <span className="flex items-center gap-1" style={{ color: t.dir === "up" ? "#7dd493" : "#fb8989" }}>
                            <ChangeArrow dir={t.dir ?? "up"} />
                            {t.change}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="foot-nums">
              <FrameCorners size={4} />
              <DebugCursor />
              <span className="ticker-div" />
              <div className="foot-col">
                <div>Scroll: <span>{scrollPct}%</span></div>
                <div>Time: <DebugClock /></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="prog">
        <div className="prog-line">
          <div className="prog-fill" style={{ height: `${scrollPct}%` }} />
        </div>
        <div className="prog-secs">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`prog-sec ${activeSection === s.id ? "active" : ""}`}
              onClick={() => onNavigate(s.id)}
              data-cursor-text={s.label}
              aria-label={s.label}
            >
              <i />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {children}

      <div className="edge-blur" aria-hidden="true">
        <div className="edge-blur__top" />
        <div className="edge-blur__bottom" />
      </div>
      <div className="noise" aria-hidden="true" />
      <span className="sr-only">{sessionLine}</span>
    </>
  );
}

export { ArrowTick, Cross };
