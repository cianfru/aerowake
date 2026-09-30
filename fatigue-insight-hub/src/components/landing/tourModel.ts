import { TOUR_BASE, TOUR_DUTIES, TOUR_WATCH_KSS, type TourDuty } from './tourData';
import { roundKss } from './landingKss';

/** Duty with the highest peak (first in date order on a tie). */
export function highestDuty(duties: TourDuty[] = TOUR_DUTIES): TourDuty {
  return duties.reduce((best, d) => (roundKss(d.peakKss) > roundKss(best.peakKss) ? d : best));
}

/** Duties whose displayed peak reaches the watch level, in date order. */
export function dutiesToWatch(duties: TourDuty[] = TOUR_DUTIES, watch = TOUR_WATCH_KSS): TourDuty[] {
  return duties.filter((d) => roundKss(d.peakKss) >= watch).sort((a, b) => a.date.localeCompare(b.date));
}

export interface TourRoute {
  key: string;
  from: string;
  to: string;
  duties: number;
  sectors: number;
  /** Worst duty peak among duties flying this airport pair (whole-duty, not per sector). */
  worstKss: number;
}

/** Undirected airport pairs with the worst peak of any duty that flies them. */
export function aggregateRoutes(duties: TourDuty[] = TOUR_DUTIES): TourRoute[] {
  const map = new Map<string, TourRoute>();
  for (const duty of duties) {
    const seen = new Set<string>();
    for (let i = 1; i < duty.route.length; i++) {
      const [a, b] = [duty.route[i - 1], duty.route[i]].sort();
      const key = `${a}-${b}`;
      const route = map.get(key) ?? { key, from: b === TOUR_BASE.code ? b : a, to: b === TOUR_BASE.code ? a : b, duties: 0, sectors: 0, worstKss: 0 };
      route.sectors += 1;
      if (!seen.has(key)) route.duties += 1;
      seen.add(key);
      route.worstKss = Math.max(route.worstKss, duty.peakKss);
      map.set(key, route);
    }
  }
  return [...map.values()].sort((a, b) => b.worstKss - a.worstKss || a.key.localeCompare(b.key));
}
