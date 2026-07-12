import { useEffect, useState } from "react";
import { scrollOffset } from "../utils/scrollOffset";
import { activeHeadingId } from "../utils/scrollspy";

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
      const tops = ids.map((id) => {
        const el = document.getElementById(id);
        return { id, top: el ? el.getBoundingClientRect().top : null };
      });
      setActiveId(activeHeadingId(tops, threshold));
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
