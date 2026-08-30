import { useEffect, useRef } from "react";

/**
 * Ambient hero background.
 * If /mbg.mp4 exists in public/, it plays as the backdrop (video.onError hides it).
 * Beneath it, an original canvas animation renders drifting vertical bars —
 * the fallback that shows when no video is supplied.
 */
export function AmbientBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    function resize() {
      if (!canvas || !ctx) return;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const bars = Array.from({ length: 28 }, (_, i) => ({
      x: (i / 28) * 1.05,
      speed: 0.02 + Math.random() * 0.06,
      width: 1 + Math.random() * 2,
      alpha: 0.04 + Math.random() * 0.1,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    function draw() {
      if (!ctx) return;
      t += 0.008;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.75);
      g.addColorStop(0, "rgba(255,255,255,0.05)");
      g.addColorStop(0.5, "rgba(255,255,255,0.015)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const b of bars) {
        const y = ((b.phase + t * b.speed) % 1.2) * h - h * 0.1;
        const a = b.alpha * (0.5 + 0.5 * Math.sin(t * 2 + b.phase));
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.fillRect(b.x * w, y, b.width, 40 + 90 * Math.abs(Math.sin(t + b.phase)));
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onError={(e) => {
          (e.target as HTMLVideoElement).style.display = "none";
        }}
      >
        <source src="/mbg.mp4" type="video/mp4" onError={(e) => {
          const video = (e.target as HTMLSourceElement).closest("video");
          if (video) video.style.display = "none";
        }} />
      </video>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 0%, rgba(15,15,15,0.55) 78%, rgba(15,15,15,0.85) 100%)" }} />
    </div>
  );
}
