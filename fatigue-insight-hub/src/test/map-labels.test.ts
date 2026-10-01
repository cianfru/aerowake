import { describe, expect, it } from 'vitest';
import { boxesOverlap, clusterMarkers, densify, estimateLabelWidth, placeLabels, type LabelItem } from '@/lib/map-labels';
import { LAND_110, LAND_110_LITE, graticuleFor } from '@/lib/map-land';

const item = (id: string, x: number, y: number, priority: number, name?: string): LabelItem => ({
  id, x, y, r: priority === 0 ? 5.5 : 4, priority,
  variants: name ? [{ text: `${id} ${name}`, width: estimateLabelWidth(id, name) }, { text: id, width: estimateLabelWidth(id) }] : [{ text: id, width: estimateLabelWidth(id) }],
});
const SIZE = { w: 400, h: 300 };

describe('label placement', () => {
  it('never overlaps labels with each other or with other markers', () => {
    const items = [item('DOH', 200, 150, 0), item('AUH', 222, 154, 3), item('BAH', 186, 138, 4), item('SHJ', 236, 146, 5), item('KWI', 170, 110, 6)];
    const { placed } = placeLabels(items, SIZE);
    const boxes = [...placed.values()].map((p) => p.box);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) expect(boxesOverlap(boxes[i], boxes[j])).toBe(false);
      for (const m of items) {
        if (m.id === [...placed.keys()][i]) continue;
        expect(boxesOverlap(boxes[i], { x0: m.x - m.r, y0: m.y - m.r, x1: m.x + m.r, y1: m.y + m.r })).toBe(false);
      }
    }
  });

  it('always places the home base label, even when crowded against the edge', () => {
    const items = [item('AUH', 392, 6, 1), item('DOH', 396, 4, 0)];
    const { placed } = placeLabels(items, SIZE, { clusterPx: 0 });
    const doh = placed.get('DOH');
    expect(doh).toBeDefined();
    expect(doh!.box.x1).toBeLessThanOrEqual(SIZE.w);
    expect(doh!.box.y0).toBeGreaterThanOrEqual(0);
  });

  it('keeps last frame positions when they are still free (no flicker)', () => {
    const items = [item('NJF', 100, 100, 3)];
    const first = placeLabels(items, SIZE, { prev: new Map([['NJF', 4]]) });
    expect(first.placed.get('NJF')!.slot).toBe(4);
  });

  it('prefers positions that leave route lines readable', () => {
    const items = [item('NJF', 100, 100, 3)];
    const line = densify([[[104, 100], [300, 100]]]);
    const { placed } = placeLabels(items, SIZE, { soft: line });
    const box = placed.get('NJF')!.box;
    expect(line.some(([x, y]) => x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1)).toBe(false);
  });

  it('adds a city name when there is room and drops it when there is not', () => {
    const roomy = placeLabels([item('NJF', 100, 100, 3, 'Najaf')], SIZE);
    expect(roomy.placed.get('NJF')!.text).toBe('NJF Najaf');
    const tight = placeLabels([item('NJF', 30, 8, 3, 'Najaf'), item('XXX', 200, 200, 4)], { w: 80, h: 30 });
    expect(tight.placed.get('NJF')?.text ?? 'NJF').toBe('NJF');
  });

  it('avoids map controls', () => {
    const controls = [{ x0: 340, y0: 0, x1: 400, y1: 300 }];
    const { placed } = placeLabels([item('TRV', 330, 150, 3)], SIZE, { obstacles: controls });
    expect(placed.get('TRV')!.box.x1).toBeLessThanOrEqual(340);
  });

  it('clusters markers that sit on top of each other into "DOH +1"', () => {
    const items = [item('DOH', 200, 150, 0), item('BAH', 204, 147, 5)];
    expect(clusterMarkers(items, 10)).toHaveLength(1);
    const { placed, clusters } = placeLabels(items, SIZE);
    expect(placed.get('DOH')!.text).toBe('DOH +1');
    expect(placed.has('BAH')).toBe(false);
    expect(clusters[0].lead).toBe('DOH');
    expect(clusters[0].minDist).toBeCloseTo(5);
  });
});

describe('land layers', () => {
  it('ships a lighter hero coastline with the same features', () => {
    const count = (fc: typeof LAND_110) => JSON.stringify(fc).length;
    expect(LAND_110_LITE.features).toHaveLength(LAND_110.features.length);
    expect(count(LAND_110_LITE)).toBeLessThan(count(LAND_110) * 0.75);
  });

  it('refines the graticule as the map zooms, windowed around the centre', () => {
    const world = graticuleFor(4, [50, 25]);
    const fine = graticuleFor(60, [50, 25]);
    const lngs = fine.coordinates.flat().map((p) => p[0]);
    expect(Math.min(...lngs)).toBeGreaterThanOrEqual(50 - 30);
    expect(Math.max(...lngs)).toBeLessThanOrEqual(50 + 30);
    expect(world).not.toBe(fine);
  });
});
