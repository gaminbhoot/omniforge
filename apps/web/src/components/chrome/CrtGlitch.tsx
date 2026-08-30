import { useEffect, useRef, useState } from "react";

/**
 * CRT glitch transition overlay.
 * Increment `tick` to fire a ~620ms glitch pulse: RGB tear bands sweep down,
 * a bright scan line travels the screen, and the UI jolt-shifts briefly.
 */
export function CrtGlitch({ tick }: { tick: number }) {
  const [active, setActive] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setActive(true);
    document.body.classList.add("crt-on");
    const t = setTimeout(() => {
      setActive(false);
      document.body.classList.remove("crt-on");
    }, 620);
    return () => {
      clearTimeout(t);
      document.body.classList.remove("crt-on");
    };
  }, [tick]);

  return (
    <div className={`crt ${active ? "crt--on" : ""}`} aria-hidden="true">
      <div className="crt__scan" />
      <div className="crt__band crt__band--r" />
      <div className="crt__band crt__band--g" />
      <div className="crt__band crt__band--c" />
      <div className="crt__tear" />
    </div>
  );
}
