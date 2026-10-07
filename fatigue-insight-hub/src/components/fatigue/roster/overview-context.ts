import type { AnalysisResults } from '@/types/fatigue';

/** Surface recorded context, without adding another risk score or assuming missing checks passed. */
export function rosterContext(results: AnalysisResults) {
  const woclDuties = results.duties.filter(d => Number.isFinite(d.woclExposure) && d.woclExposure > 0);
  const inferredCrew = results.duties.filter(d => d.crewSource === 'fdp' || d.augmentationSuggested);
  const shortfalls = results.duties.filter(d => Number.isFinite(d.sleepDeficit7d?.deficitHours));
  const highestShortfall = shortfalls.reduce<typeof shortfalls[number] | undefined>((best, d) =>
    !best || d.sleepDeficit7d!.deficitHours > best.sleepDeficit7d!.deficitHours ? d : best, undefined);
  const warnings = (results.easaFindings ?? []).filter(f => f.severity === 'warning');
  const coverage = Object.values(results.easaSummary?.coverage ?? {});
  const unavailable = !results.easaSummary || results.easaSummary.status === 'unavailable';
  const incompleteChecks = coverage.filter(c => c.status !== 'passed' && c.status !== 'failed').length;
  return { woclDuties, inferredCrew, highestShortfall, warnings, incompleteChecks,
    coverageKnown: !unavailable && coverage.length > 0, unavailable };
}
