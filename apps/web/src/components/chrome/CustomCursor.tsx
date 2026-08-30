import { useEffect, useRef } from "react";

export function CustomCursor() {
  const chipRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: -9999, y: -9999 });
  const pos = useRef({ x: -9999, y: -9999 });
  const label = useRef<string | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.body.classList.add("stage-cursor");
    const chip = chipRef.current;
    if (!chip) return;

    let raf = 0;
    function loop() {
      pos.current.x += (target.current.x - pos.current.x) * 0.28;
      pos.current.y += (target.current.y - pos.current.y) * 0.28;
      chip!.style.transform = `translate3d(${pos.current.x + 12}px, ${pos.current.y + 14}px, 0)`;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function onMove(e: MouseEvent) {
      target.current = { x: e.clientX, y: e.clientY };
      const el = (e.target as HTMLElement)?.closest?.("[data-cursor-text]") as HTMLElement | null;
      const overField = !!(e.target as HTMLElement)?.closest?.("input, textarea, select");
      const next = overField ? null : el?.dataset.cursorText ?? null;
      if (next !== label.current) {
        label.current = next;
        chip!.textContent = next ?? "";
        chip!.classList.toggle("on", next !== null || true);
        if (!next && !overField) chip!.classList.add("on");
      }
      chip!.classList.toggle("on", !overField);
    }
    function onLeave() {
      chip!.classList.remove("on");
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.body.classList.remove("stage-cursor");
    };
  }, []);

  return <div ref={chipRef} className="cursor-chip" aria-hidden="true" />;
}
