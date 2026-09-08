import { useEffect, useRef, useState } from "react";

/**
 * Returns 0 -> 1 progress of an element travelling through the viewport.
 * 0 = element top hits viewport bottom, 1 = element bottom hits viewport top.
 */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = rect.height + vh;
      const raw = (vh - rect.top) / total;
      setProgress(Math.min(1, Math.max(0, raw)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { ref, progress };
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Maps p from [a,b] onto [0,1]. */
export const range = (p: number, a: number, b: number) =>
  clamp01((p - a) / (b - a || 1));
