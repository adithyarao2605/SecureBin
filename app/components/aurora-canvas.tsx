"use client";

import { useEffect, useRef } from "react";

export function AuroraCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;

    const draw = (time: number) => {
      const width = window.innerWidth;
      const height = Math.max(window.innerHeight, 720);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const drift = reducedMotion ? 0 : time * 0.000035;
      const first = context.createRadialGradient(width * (0.68 + Math.sin(drift) * 0.08), height * 0.2, 0, width * 0.68, height * 0.2, width * 0.72);
      first.addColorStop(0, "rgba(39, 113, 111, 0.22)");
      first.addColorStop(0.45, "rgba(27, 74, 76, 0.09)");
      first.addColorStop(1, "rgba(13, 21, 24, 0)");
      context.fillStyle = first;
      context.fillRect(0, 0, width, height);
      const second = context.createRadialGradient(width * (0.13 + Math.cos(drift * 1.3) * 0.06), height * 0.8, 0, width * 0.13, height * 0.8, width * 0.55);
      second.addColorStop(0, "rgba(184, 104, 72, 0.1)");
      second.addColorStop(0.5, "rgba(80, 52, 49, 0.04)");
      second.addColorStop(1, "rgba(13, 21, 24, 0)");
      context.fillStyle = second;
      context.fillRect(0, 0, width, height);
      if (!reducedMotion) animationFrame = requestAnimationFrame(draw);
    };

    const resizeObserver = new ResizeObserver(() => draw(performance.now()));
    resizeObserver.observe(canvas);
    draw(0);
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="landing-aurora" aria-hidden="true" />;
}
