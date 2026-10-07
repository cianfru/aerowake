import { describe, expect, it } from 'vitest';
import { bandAt, bandGradient, bandRuns } from '@/lib/kss-band-gradient';
import { riskCssColor } from '@/lib/risk-scale';

const H = 3600000;
const sample = (h: number, kss: number | null, asleep = false) => ({ t: h * H, kss, asleep, onDuty: !asleep });

describe('duty bar colour along the predicted KSS', () => {
  it('changes band halfway between the samples either side of a crossing', () => {
    const runs = bandRuns([sample(0, 4), sample(1, 5), sample(2, 6), sample(3, 7.4), sample(4, 7)], 0, 4 * H)!;
    expect(runs.map((r) => r.level)).toEqual(['low', 'moderate', 'high']);
    expect(runs[0].from).toBe(0);
    expect(runs[0].to).toBeCloseTo(1.5 / 4);
    expect(runs[1].to).toBeCloseTo(2.5 / 4);
    expect(runs[2].to).toBe(1);
    expect(bandAt(runs, 0.9)).toBe('high');
  });

  it('follows the prediction down as well as up (no band is held after the peak)', () => {
    const runs = bandRuns([sample(0, 7), sample(1, 5)], 0, H)!;
    expect(runs.map((r) => r.level)).toEqual(['high', 'low']);
  });

  it('uses only awake samples inside the span, and returns null without any', () => {
    expect(bandRuns([sample(-1, 8), sample(5, 8)], 0, 4 * H)).toBeNull();
    expect(bandRuns([sample(1, null, true)], 0, 4 * H)).toBeNull();
  });

  it('draws one solid band as a plain colour, several as hard stops', () => {
    expect(bandGradient([{ level: 'high', from: 0, to: 1 }])).toBe(riskCssColor('high'));
    const g = bandGradient([{ level: 'low', from: 0, to: 0.5 }, { level: 'high', from: 0.5, to: 1 }]);
    expect(g).toContain(`${riskCssColor('low')} 0.00% 50.00%`);
    expect(g).toContain(`${riskCssColor('high')} 50.00% 100.00%`);
  });
});
