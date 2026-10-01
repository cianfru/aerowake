/**
 * Screen-space airport label placement for the route map.
 *
 * Greedy placement in priority order (home base first, then the selected
 * route's endpoints, then the busiest airports). Each label tries eight
 * positions around its marker, starting with the one it used last frame so
 * labels do not flicker while the map moves. Markers closer than
 * `clusterPx` merge into one label ("DOH +2") that zooms in when activated.
 */

export interface LabelVariant { text: string; width: number }
export interface LabelItem {
  id: string;
  x: number;
  y: number;
  /** Marker radius in px. */
  r: number;
  /** Lower draws first and wins collisions. 0 = home base. */
  priority: number;
  /** Preferred first (e.g. "NJF Najaf"), then shorter fallbacks ("NJF"). */
  variants: LabelVariant[];
}
export interface Box { x0: number; y0: number; x1: number; y1: number }
export type Anchor = 'start' | 'middle' | 'end';
export interface PlacedLabel {
  id: string;
  text: string;
  /** Text anchor point (baseline). */
  x: number;
  y: number;
  anchor: Anchor;
  box: Box;
  slot: number;
  /** Number of other airports folded into this label. */
  more: number;
}
export interface Cluster { lead: string; members: string[]; x: number; y: number; minDist: number }
export interface LabelLayout { placed: Map<string, PlacedLabel>; clusters: Cluster[] }

export const SLOT_NAMES = ['E', 'W', 'NE', 'SE', 'NW', 'SW', 'N', 'S'] as const;

/** Approximate advance of a monospace code plus an optional sans-serif name. */
export function estimateLabelWidth(code: string, name = '', fontSize = 12): number {
  const codeW = 0.6 * fontSize * code.length;
  const nameW = name ? 0.55 * (fontSize - 1) * (name.length + 1) : 0;
  return Math.ceil(codeW + nameW + 4);
}

export const boxesOverlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function slotBox(slot: number, x: number, y: number, r: number, w: number, h: number): { box: Box; anchor: Anchor } {
  const g = 3;
  const d = r * 0.72 + 2;
  switch (slot) {
    case 0: return { box: { x0: x + r + g, y0: y - h / 2, x1: x + r + g + w, y1: y + h / 2 }, anchor: 'start' };
    case 1: return { box: { x0: x - r - g - w, y0: y - h / 2, x1: x - r - g, y1: y + h / 2 }, anchor: 'end' };
    case 2: return { box: { x0: x + d, y0: y - d - h, x1: x + d + w, y1: y - d }, anchor: 'start' };
    case 3: return { box: { x0: x + d, y0: y + d, x1: x + d + w, y1: y + d + h }, anchor: 'start' };
    case 4: return { box: { x0: x - d - w, y0: y - d - h, x1: x - d, y1: y - d }, anchor: 'end' };
    case 5: return { box: { x0: x - d - w, y0: y + d, x1: x - d, y1: y + d + h }, anchor: 'end' };
    case 6: return { box: { x0: x - w / 2, y0: y - r - g - h, x1: x + w / 2, y1: y - r - g }, anchor: 'middle' };
    default: return { box: { x0: x - w / 2, y0: y + r + g, x1: x + w / 2, y1: y + r + g + h }, anchor: 'middle' };
  }
}

function anchorPoint(box: Box, anchor: Anchor, fontSize: number): [number, number] {
  const baseline = box.y0 + (box.y1 - box.y0) / 2 + fontSize * 0.36;
  if (anchor === 'start') return [box.x0 + 2, baseline];
  if (anchor === 'end') return [box.x1 - 2, baseline];
  return [(box.x0 + box.x1) / 2, baseline];
}

/** Union-find clusters of markers closer than `px`. */
export function clusterMarkers(items: LabelItem[], px: number): Cluster[] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y) < px) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, LabelItem[]>();
  items.forEach((item, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), item]);
  });
  const clusters: Cluster[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    let minDist = Infinity;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        minDist = Math.min(minDist, Math.hypot(members[i].x - members[j].x, members[i].y - members[j].y));
      }
    }
    clusters.push({
      lead: members[0].id,
      members: members.map((m) => m.id),
      x: members.reduce((s, m) => s + m.x, 0) / members.length,
      y: members.reduce((s, m) => s + m.y, 0) / members.length,
      minDist,
    });
  }
  return clusters;
}

/** Points every `step` px along polylines, so a label box cannot slip between samples. */
export function densify(runs: Array<Array<[number, number]>>, step = 5): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const run of runs) {
    for (let i = 0; i < run.length; i++) {
      const [x, y] = run[i];
      out.push([x, y]);
      if (i === run.length - 1) break;
      const [nx, ny] = run[i + 1];
      const n = Math.floor(Math.hypot(nx - x, ny - y) / step);
      for (let j = 1; j < n; j++) out.push([x + ((nx - x) * j) / n, y + ((ny - y) * j) / n]);
    }
  }
  return out;
}

/** Spatial hash of points (e.g. route lines) that labels should avoid covering when they can. */
export function pointGrid(points: Array<[number, number]>, cell = 24) {
  const grid = new Map<string, Array<[number, number]>>();
  for (const p of points) {
    const key = `${Math.floor(p[0] / cell)}:${Math.floor(p[1] / cell)}`;
    const list = grid.get(key);
    if (list) list.push(p); else grid.set(key, [p]);
  }
  return (box: Box) => {
    for (let cx = Math.floor(box.x0 / cell); cx <= Math.floor(box.x1 / cell); cx++) {
      for (let cy = Math.floor(box.y0 / cell); cy <= Math.floor(box.y1 / cell); cy++) {
        const list = grid.get(`${cx}:${cy}`);
        if (list?.some(([x, y]) => x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1)) return true;
      }
    }
    return false;
  };
}

export function placeLabels(
  items: LabelItem[],
  size: { w: number; h: number },
  opts: {
    fontSize?: number; prev?: Map<string, number>; clusterPx?: number; inset?: number;
    /** Screen areas labels must avoid (map controls). */
    obstacles?: Box[];
    /** Points labels avoid covering when another position is free (route lines). */
    soft?: Array<[number, number]>;
  } = {},
): LabelLayout {
  const { fontSize = 12, prev, clusterPx = 10, inset = 4, obstacles = [], soft = [] } = opts;
  const covers = soft.length ? pointGrid(soft) : null;
  const h = fontSize + 4;
  const clusters = clusterMarkers(items, clusterPx);
  const clusterOf = new Map<string, Cluster>();
  for (const c of clusters) for (const m of c.members) clusterOf.set(m, c);
  const markerBoxes = items.map((m) => ({ id: m.id, box: { x0: m.x - m.r - 1, y0: m.y - m.r - 1, x1: m.x + m.r + 1, y1: m.y + m.r + 1 } }));
  const inside = (b: Box) => b.x0 >= inset && b.y0 >= inset && b.x1 <= size.w - inset && b.y1 <= size.h - inset;
  const taken: Box[] = [];
  const placed = new Map<string, PlacedLabel>();
  const order = [...items].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  for (const item of order) {
    const cluster = clusterOf.get(item.id);
    if (cluster && cluster.lead !== item.id) continue;
    const more = cluster ? cluster.members.length - 1 : 0;
    const variants = more
      ? item.variants.slice(-1).map((v) => ({ text: `${v.text} +${more}`, width: v.width + Math.ceil(0.6 * fontSize * (String(more).length + 2)) }))
      : item.variants;
    const ignore = new Set(cluster ? cluster.members : [item.id]);
    const first = prev?.get(item.id);
    const slots = first != null ? [first, ...[0, 1, 2, 3, 4, 5, 6, 7].filter((s) => s !== first)] : [0, 1, 2, 3, 4, 5, 6, 7];
    let chosen: PlacedLabel | null = null;
    // First try to keep route lines readable, then accept covering them.
    for (const avoidLines of covers ? [true, false] : [false]) {
      for (const variant of variants) {
        for (const slot of slots) {
          const { box, anchor } = slotBox(slot, item.x, item.y, item.r, variant.width, h);
          if (!inside(box)) continue;
          if (taken.some((t) => boxesOverlap(t, box))) continue;
          if (obstacles.some((o) => boxesOverlap(o, box))) continue;
          if (markerBoxes.some((m) => !ignore.has(m.id) && boxesOverlap(m.box, box))) continue;
          if (avoidLines && covers!(box)) continue;
          const [x, y] = anchorPoint(box, anchor, fontSize);
          chosen = { id: item.id, text: variant.text, x, y, anchor, box, slot, more };
          break;
        }
        if (chosen) break;
      }
      if (chosen) break;
    }
    if (!chosen && item.priority === 0) {
      // The home base always keeps a label: clamp its preferred slot into the viewport.
      const variant = variants[variants.length - 1];
      const slot = first ?? 0;
      const raw = slotBox(slot, item.x, item.y, item.r, variant.width, h);
      const dx = Math.max(inset - raw.box.x0, 0) - Math.max(raw.box.x1 - (size.w - inset), 0);
      const dy = Math.max(inset - raw.box.y0, 0) - Math.max(raw.box.y1 - (size.h - inset), 0);
      const box = { x0: raw.box.x0 + dx, x1: raw.box.x1 + dx, y0: raw.box.y0 + dy, y1: raw.box.y1 + dy };
      const [x, y] = anchorPoint(box, raw.anchor, fontSize);
      chosen = { id: item.id, text: variant.text, x, y, anchor: raw.anchor, box, slot, more };
    }
    if (chosen) {
      taken.push(chosen.box);
      placed.set(item.id, chosen);
    }
  }
  return { placed, clusters };
}
