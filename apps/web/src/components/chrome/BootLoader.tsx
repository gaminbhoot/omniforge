import { useEffect, useRef, useState } from "react";
import { LogoMark } from "./bits";

export function BootLoader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState<"load" | "fade" | "gone">("load");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    document.body.classList.add("boot-lock");
    let raf = 0;
    let cancelled = false;
    let doneTimer1 = 0;
    let doneTimer2 = 0;
    const start = performance.now();
    const dur = 1400;
    let fontsReady = false;
    document.fonts?.ready.then(() => {
      fontsReady = true;
    });

    function tick(now: number) {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(eased * 100));
      if (t < 1 || (!fontsReady && now - start < 2000)) {
        raf = requestAnimationFrame(tick);
      } else {
        setPct(100);
        doneTimer1 = window.setTimeout(() => !cancelled && setPhase("fade"), 250);
        doneTimer2 = window.setTimeout(() => {
          if (cancelled) return;
          setPhase("gone");
          document.body.classList.remove("boot-lock");
          onDoneRef.current();
        }, 1100);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(doneTimer1);
      clearTimeout(doneTimer2);
      document.body.classList.remove("boot-lock");
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={`boot ${phase === "fade" ? "done" : ""}`} aria-hidden="true">
      <div className="boot-inner">
        <LogoMark size={30} />
        <div className="boot-line">
          <div className="boot-bar" style={{ width: `${pct}%` }} />
        </div>
        <span className="boot-pct">{pct}%</span>
      </div>
    </div>
  );
}
