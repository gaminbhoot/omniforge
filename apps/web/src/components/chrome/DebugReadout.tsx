import { useEffect, useRef, useState } from "react";

/** Cursor X/Y column — own state so mouse moves never re-render the page tree. */
export function DebugCursor() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    function onMouse(e: MouseEvent) {
      setPos((p) => (p.x === e.clientX && p.y === e.clientY ? p : { x: e.clientX, y: e.clientY }));
    }
    window.addEventListener("mousemove", onMouse, { passive: true });
    return () => window.removeEventListener("mousemove", onMouse);
  }, []);
  return (
    <div className="foot-col">
      <div>Cursor X: <span>{pos.x}</span></div>
      <div>Cursor Y: <span>{pos.y}</span></div>
    </div>
  );
}

/** Ticking session clock — own state so the 100ms interval never re-renders parents. */
export function DebugClock() {
  const [time, setTime] = useState("0.0s");
  const start = useRef(Date.now());
  useEffect(() => {
    const t = setInterval(() => setTime(`${((Date.now() - start.current) / 1000).toFixed(1)}s`), 100);
    return () => clearInterval(t);
  }, []);
  return <span>{time}</span>;
}
