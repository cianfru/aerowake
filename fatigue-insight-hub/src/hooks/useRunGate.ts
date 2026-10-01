import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether a decorative animation may run: the element is on screen, the tab
 * is visible, and nothing covers it. "Covered" means a modal has hidden the
 * rest of the page (Radix marks it aria-hidden or locks scrolling), or the
 * element sits inside a decorative backdrop (an aria-hidden/inert ancestor).
 */
export function useRunGate(ref: RefObject<Element>, enabled = true): boolean {
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: '64px' });
      observer.observe(el);
    }
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    const check = () => {
      const hiddenAncestor = el.parentElement?.closest('[aria-hidden="true"], [inert]');
      setCovered(!!hiddenAncestor || document.body.hasAttribute('data-scroll-locked'));
    };
    check();
    let mutations: MutationObserver | null = null;
    if ('MutationObserver' in window) {
      mutations = new MutationObserver(check);
      mutations.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['aria-hidden', 'inert', 'data-scroll-locked'] });
    }
    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ref, enabled]);

  return enabled && onScreen && tabVisible && !covered;
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type NavigatorHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

/** Coarse device budget for decorative animation. */
export function motionBudget(): 'full' | 'low' | 'static' {
  if (typeof navigator === 'undefined') return 'full';
  const nav = navigator as NavigatorHints;
  if (nav.connection?.saveData) return 'static';
  if ((nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4) return 'low';
  return 'full';
}
