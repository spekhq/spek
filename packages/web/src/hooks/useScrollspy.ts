import { useEffect, useState } from "react";
import { scrollOffset } from "../utils/scrollOffset";

export function useScrollspy(ids: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      setActiveId(null);
      return;
    }

    const computeActive = () => {
      // 與錨點捲動同一條偏移線（sticky header 底邊），highlight 才會對上實際置頂的 heading
      const threshold = scrollOffset();
      let lastAbove: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - threshold <= 0) {
          lastAbove = id;
        } else {
          break;
        }
      }
      setActiveId(lastAbove ?? ids[0] ?? null);
    };

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        computeActive();
      });
    };

    computeActive();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [ids.join("|")]);

  return activeId;
}
