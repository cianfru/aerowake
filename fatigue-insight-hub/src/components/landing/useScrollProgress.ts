import { useEffect, useState, RefObject } from 'react';

/**
 * Returns a 0-1 value representing how far the referenced element
 * has scrolled through the viewport (0 = just entered, 1 = fully passed).
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const elementHeight = rect.height;

      // Progress from 0 (element just entering viewport at bottom)
      // to 1 (element fully scrolled past top of viewport)
      const rawProgress = (windowHeight - rect.top) / (windowHeight + elementHeight);
      setProgress(Math.max(0, Math.min(1, rawProgress)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [ref]);

  return progress;
}
