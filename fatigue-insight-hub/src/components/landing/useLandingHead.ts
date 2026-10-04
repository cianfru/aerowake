import { useEffect } from 'react';

export const LANDING_CANONICAL_URL = 'https://aerowake.madebylantern.xyz/';
/** Browser bar colour for the always-daylight landing page. */
export const LANDING_THEME_COLOR = '#f5f5ef';

/**
 * Head tags that belong to the landing page only. index.html is the shell for
 * every route, so a static canonical would mark /privacy, /learn and the
 * workspace as copies of '/'. The browser uses the first matching
 * theme-color, so the unqualified one added here wins over the
 * light/dark pair in index.html while the landing is mounted.
 */
export function useLandingHead() {
  useEffect(() => {
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = LANDING_CANONICAL_URL;
    const themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    themeColor.content = LANDING_THEME_COLOR;
    document.head.prepend(themeColor);
    document.head.appendChild(canonical);
    return () => {
      canonical.remove();
      themeColor.remove();
    };
  }, []);
}
