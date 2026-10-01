import { useEffect, useRef, type RefObject } from 'react';

/**
 * Hand-built map gestures on Pointer Events (no d3-zoom):
 * one-pointer drag pans, two pointers pinch-zoom about their midpoint, a
 * double click or double tap zooms in (Shift zooms out), and the wheel zooms.
 *
 * In `cooperative` mode (a map inline in a scrolling page) a plain wheel keeps
 * scrolling the page and only Ctrl/⌘ + wheel zooms (trackpad pinch arrives as
 * Ctrl + wheel), so the page never gets trapped. `onBlockedWheel` lets the map
 * show a hint.
 *
 * Handlers receive anchors in element-local CSS pixels. Drag capture starts
 * only after the pointer moves a few pixels, so plain taps still click routes.
 */
export interface MapGestureHandlers {
  onPan: (dx: number, dy: number) => void;
  onZoom: (factor: number, anchor: { x: number; y: number }) => void;
  onDoubleTap?: (anchor: { x: number; y: number }, zoomOut: boolean) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  onBlockedWheel?: () => void;
}

export interface MapGestureOptions {
  enabled?: boolean;
  cooperative?: boolean;
}

const DRAG_THRESHOLD = { mouse: 3, touch: 8, pen: 4 } as Record<string, number>;
const WHEEL_IDLE_MS = 160;

/** Zoom factor for one wheel event (pixel, line or page deltas). */
export function wheelZoomFactor(e: Pick<WheelEvent, 'deltaY' | 'deltaMode' | 'ctrlKey'>): number {
  const unit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.002;
  // Trackpad pinch arrives as small ctrl+wheel deltas; give it a usable rate.
  const pinch = e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaY) < 40 ? 5 : 1;
  return Math.min(2, Math.max(0.5, 2 ** (-e.deltaY * unit * pinch)));
}

export function useMapGestures(ref: RefObject<HTMLElement>, handlers: MapGestureHandlers, options: MapGestureOptions = {}) {
  const { enabled = true, cooperative = false } = options;
  const latest = useRef(handlers);
  latest.current = handlers;
  /** True for a moment after a drag, so the click that ends it is ignored. */
  const suppressClick = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const pointers = new Map<number, { x: number; y: number; type: string }>();
    let dragging = false;
    let start: { x: number; y: number } | null = null;
    let pinch: { dist: number; mid: { x: number; y: number } } | null = null;
    let lastTap: { t: number; x: number; y: number } | null = null;
    let wheelTimer = 0;
    let wheeling = false;

    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const beginGesture = () => {
      if (!dragging) {
        dragging = true;
        latest.current.onGestureStart?.();
      }
    };
    const endGesture = () => {
      if (dragging) {
        dragging = false;
        suppressClick.current = true;
        window.setTimeout(() => { suppressClick.current = false; }, 0);
        latest.current.onGestureEnd?.();
      }
    };
    const pinchState = () => {
      const [a, b] = [...pointers.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const p = local(e);
      pointers.set(e.pointerId, { ...p, type: e.pointerType });
      if (pointers.size === 1) {
        start = p;
      } else if (pointers.size === 2) {
        pinch = pinchState();
        for (const id of pointers.keys()) {
          try { el.setPointerCapture(id); } catch { /* pointer already gone */ }
        }
        beginGesture();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      pointers.set(e.pointerId, { ...p, type: prev.type });
      if (pointers.size >= 2 && pinch) {
        const next = pinchState();
        latest.current.onZoom(next.dist / pinch.dist, next.mid);
        latest.current.onPan(next.mid.x - pinch.mid.x, next.mid.y - pinch.mid.y);
        pinch = next;
        return;
      }
      if (!dragging) {
        if (!start || Math.hypot(p.x - start.x, p.y - start.y) < (DRAG_THRESHOLD[prev.type] ?? 4)) return;
        try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        beginGesture();
      }
      latest.current.onPan(p.x - prev.x, p.y - prev.y);
    };

    const onPointerEnd = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.delete(e.pointerId);
      if (pointers.size === 1) {
        // Pinch → single-finger pan without a jump.
        pinch = null;
        const [rest] = pointers.values();
        start = { x: rest.x, y: rest.y };
        return;
      }
      if (pointers.size > 0) return;
      const wasDrag = dragging;
      endGesture();
      pinch = null;
      if (!wasDrag && e.type === 'pointerup' && prev.type !== 'mouse' && latest.current.onDoubleTap) {
        const now = performance.now();
        if (lastTap && now - lastTap.t < 320 && Math.hypot(prev.x - lastTap.x, prev.y - lastTap.y) < 24) {
          latest.current.onDoubleTap({ x: prev.x, y: prev.y }, false);
          lastTap = null;
        } else {
          lastTap = { t: now, x: prev.x, y: prev.y };
        }
      }
    };

    const onDblClick = (e: MouseEvent) => {
      if (!latest.current.onDoubleTap) return;
      e.preventDefault();
      latest.current.onDoubleTap(local(e), e.shiftKey);
    };
    // A double click would otherwise select text next to the map.
    const onMouseDown = (e: MouseEvent) => { if (e.detail > 1) e.preventDefault(); };

    const onWheel = (e: WheelEvent) => {
      if (cooperative && !e.ctrlKey && !e.metaKey) {
        latest.current.onBlockedWheel?.();
        return;
      }
      e.preventDefault();
      if (!wheeling) {
        wheeling = true;
        latest.current.onGestureStart?.();
      }
      latest.current.onZoom(wheelZoomFactor(e), local(e));
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        wheeling = false;
        latest.current.onGestureEnd?.();
      }, WHEEL_IDLE_MS);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', onPointerEnd);
    el.addEventListener('lostpointercapture', onPointerEnd);
    el.addEventListener('dblclick', onDblClick);
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
      el.removeEventListener('lostpointercapture', onPointerEnd);
      el.removeEventListener('dblclick', onDblClick);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('wheel', onWheel);
      window.clearTimeout(wheelTimer);
      if (wheeling) latest.current.onGestureEnd?.();
    };
  }, [ref, enabled, cooperative]);

  return { suppressClick };
}
