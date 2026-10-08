import { describe, expect, it } from 'vitest';
import { isKssEngine, resolveKss } from '@/lib/risk-scale';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { rosterFixture } from './fixtures/roster-analysis';

describe('KSS engine versions', () => {
  it('recognises all retained KSS engine versions', () => {
    expect(isKssEngine('aerowake-4.0-kss')).toBe(true);
    expect(isKssEngine('aerowake-4.1-kss')).toBe(true);
    expect(isKssEngine('aerowake-4.2-kss')).toBe(true);
    expect(isKssEngine('aerowake-3')).toBe(false);
    expect(isKssEngine(undefined)).toBe(false);
    expect(resolveKss(undefined, 70, 'aerowake-4.1-kss')).toBe(4);
    expect(resolveKss(undefined, 70, 'aerowake-4.2-kss')).toBe(4);
  });

  it('does not mark a 4.1 analysis as a legacy model', () => {
    const result = {
      ...rosterFixture,
      duties: rosterFixture.duties.map((duty) => ({ ...duty, model_version: 'aerowake-4.1-kss' })),
    };
    expect(transformAnalysisResult(result, new Date(2026, 8, 1)).legacyModel).toBe(false);
  });
});
