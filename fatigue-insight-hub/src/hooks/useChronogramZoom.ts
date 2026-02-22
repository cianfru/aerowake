import { useState, useCallback, useRef, useEffect } from 'react';

interface ZoomState {
  scaleX: number;  // Horizontal zoom (time axis)
  scaleY: number;  // Vertical zoom (days axis)
  panX: number;    // Horizontal pan offset (pixels)
  panY: number;    // Vertical pan offset (pixels)
}

interface UseChronogramZoomOptions {
  minScaleX?: number;
  maxScaleX?: number;
  minScaleY?: number;
  maxScaleY?: number;
}

export function useChronogramZoom(options: UseChronogramZoomOptions = {}) {
  const {
    minScaleX = 1,
    maxScaleX = 4,
    minScaleY = 1,
    maxScaleY = 3,
  } = options;

  const [zoom, setZoom] = useState<ZoomState>({
    scaleX: 1,
    scaleY: 1,
    panX: 0,
    panY: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isPinching = useRef(false);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const lastPanPosition = useRef<{ x: number; y: number } | null>(null);

  // Calculate distance between two touch points
  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get center point between two touches
  const getTouchCenter = (touches: TouchList) => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  // Get position relative to container
  const getRelativePosition = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      isPinching.current = true;
      lastTouchDistance.current = getTouchDistance(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    } else if (e.touches.length === 1 && (zoom.scaleX > 1 || zoom.scaleY > 1)) {
      // Single touch for panning when zoomed
      lastPanPosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, [zoom.scaleX, zoom.scaleY]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && isPinching.current) {
      e.preventDefault();
      
      const newDistance = getTouchDistance(e.touches);
      const newCenter = getTouchCenter(e.touches);
      
      if (lastTouchDistance.current && lastTouchCenter.current) {
        const scaleChange = newDistance / lastTouchDistance.current;
        
        // Get pinch center relative to container
        const relCenter = getRelativePosition(newCenter.x, newCenter.y);
        
        setZoom(prev => {
          // Calculate new scales
          const newScaleX = Math.min(maxScaleX, Math.max(minScaleX, prev.scaleX * scaleChange));
          const newScaleY = Math.min(maxScaleY, Math.max(minScaleY, prev.scaleY * scaleChange));
          
          // Calculate pan adjustment to keep pinch center stationary
          // The point under the pinch should remain at the same screen position
          const scaleRatioX = newScaleX / prev.scaleX;
          const scaleRatioY = newScaleY / prev.scaleY;
          
          // Adjust pan so the point under fingers stays fixed
          const newPanX = relCenter.x - scaleRatioX * (relCenter.x - prev.panX);
          const newPanY = relCenter.y - scaleRatioY * (relCenter.y - prev.panY);
          
          return {
            scaleX: newScaleX,
            scaleY: newScaleY,
            panX: newPanX,
            panY: newPanY,
          };
        });
      }
      
      lastTouchDistance.current = newDistance;
      lastTouchCenter.current = newCenter;
    } else if (e.touches.length === 1 && lastPanPosition.current && (zoom.scaleX > 1 || zoom.scaleY > 1)) {
      // Pan when zoomed with single touch
      const deltaX = e.touches[0].clientX - lastPanPosition.current.x;
      const deltaY = e.touches[0].clientY - lastPanPosition.current.y;
      
      setZoom(prev => ({
        ...prev,
        panX: prev.panX + deltaX,
        panY: prev.panY + deltaY,
      }));
      
      lastPanPosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, [minScaleX, maxScaleX, minScaleY, maxScaleY, zoom.scaleX, zoom.scaleY]);

  const handleTouchEnd = useCallback(() => {
    isPinching.current = false;
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
    lastPanPosition.current = null;
  }, []);

  // Mouse wheel zoom (desktop) - zoom toward cursor position
  const handleWheel = useCallback((e: WheelEvent) => {
    // Only zoom if Ctrl/Meta is pressed (standard zoom gesture)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const isHorizontal = e.shiftKey; // Shift + wheel = horizontal only
      
      // Get cursor position relative to container
      const cursorPos = getRelativePosition(e.clientX, e.clientY);
      
      setZoom(prev => {
        const newScaleX = Math.min(maxScaleX, Math.max(minScaleX, prev.scaleX * delta));
        const newScaleY = isHorizontal 
          ? prev.scaleY 
          : Math.min(maxScaleY, Math.max(minScaleY, prev.scaleY * delta));
        
        // Calculate pan adjustment to keep cursor point stationary
        const scaleRatioX = newScaleX / prev.scaleX;
        const scaleRatioY = newScaleY / prev.scaleY;
        
        // Adjust pan so the point under cursor stays fixed
        const newPanX = cursorPos.x - scaleRatioX * (cursorPos.x - prev.panX);
        const newPanY = cursorPos.y - scaleRatioY * (cursorPos.y - prev.panY);
        
        return {
          scaleX: newScaleX,
          scaleY: newScaleY,
          panX: newPanX,
          panY: newPanY,
        };
      });
    }
  }, [minScaleX, maxScaleX, minScaleY, maxScaleY]);

  // Reset zoom
  const resetZoom = useCallback(() => {
    setZoom({ scaleX: 1, scaleY: 1, panX: 0, panY: 0 });
  }, []);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel]);

  const isZoomed = zoom.scaleX > 1 || zoom.scaleY > 1;

  return {
    zoom,
    containerRef,
    resetZoom,
    isZoomed,
  };
}
