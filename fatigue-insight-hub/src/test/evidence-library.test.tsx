import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LearnPage } from '@/components/fatigue/LearnPage';
import { ResearchReferencesPage } from '@/components/fatigue/ResearchReferencesPage';
import { generateMitigations } from '@/lib/report-narrative';
import { mockAnalysisResults } from '@/data/mockAnalysisData';
import { FatigueSciencePage } from '@/components/fatigue/FatigueSciencePage';
import { ALL_REFERENCES, evidenceHref, getReferenceByKey } from '@/data/references';

const library = (route = '/learn?section=references') => render(<MemoryRouter initialEntries={[route]}><ResearchReferencesPage /></MemoryRouter>);

describe('evidence library', () => {
  it('opens the cited study directly from a contextual evidence link', () => {
    render(<MemoryRouter initialEntries={[evidenceHref('akerstedt_2014')]}><LearnPage /></MemoryRouter>);
    expect(screen.getByRole('tab', { name: 'Evidence library' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Ingre et al. (2014)' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 source shown');
    expect(screen.getByRole('link', { name: /Read source: Ingre/ })).toHaveAttribute('href', 'https://doi.org/10.1371/journal.pone.0108679');
    expect(screen.getByText(/does not automatically validate Aerowake/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View all sources' }));
    expect(screen.getByRole('status')).toHaveTextContent(`${ALL_REFERENCES.length} sources shown`);
  });

  it('searches accented authors and DOI, combines filters, and recovers from no matches', () => {
    library();
    const search = screen.getByRole('searchbox', { name: 'Search evidence' });
    fireEvent.change(search, { target: { value: 'Borbely 1982' } });
    expect(screen.getByRole('status')).toHaveTextContent('1 source shown');
    expect(screen.getByRole('heading', { name: 'Borbély (1982)' })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: '10.1093/sleepadvances/zpaf002' } });
    expect(screen.getByRole('heading', { name: 'Rempe et al. (2025)' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Source type' }), { target: { value: 'regulation' } });
    expect(screen.getByText('No sources match these filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent(`${ALL_REFERENCES.length} sources shown`);
  });

  it('separates unresolved records from identified publications and makes them searchable', () => {
    library();
    fireEvent.change(screen.getByRole('combobox', { name: 'Source type' }), { target: { value: 'unresolved' } });
    const unresolved = ALL_REFERENCES.filter(ref => ref.verification === 'unresolved');
    expect(screen.getByRole('status')).toHaveTextContent(`${unresolved.length} sources shown`);
    expect(screen.getByText(/excluded from the identified evidence count/)).toBeVisible();
    expect(screen.queryByRole('link', { name: /Read source:/ })).not.toBeInTheDocument();
  });

  it('resolves old citation aliases and handles unknown sources without a blank page', () => {
    expect(evidenceHref('roach_2025')).toBe('/learn?section=references&source=rempe_2025');
    library('/learn?section=references&source=not-in-catalogue');
    expect(screen.getByText(/This citation is not in the catalogue/)).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('uses corrected publications without claiming the old quantitative coefficients', () => {
    expect(getReferenceByKey('signal_2013')?.doi).toBe('10.5665/sleep.2312');
    expect(getReferenceByKey('dijk_czeisler_1994')?.full).toContain('Neurosci Lett');
    expect(getReferenceByKey('mccauley_2013')?.short).toBe('McCauley et al. (2009)');
    for (const ref of ALL_REFERENCES.filter(ref => ref.verification === 'identified')) {
      expect(ref.url, ref.key).toMatch(/^https:\/\/(doi.org|pubmed.ncbi.nlm.nih.gov|www.easa.europa.eu|eur-lex.europa.eu|www.icao.int)/);
      expect(ref.limitation, ref.key).toBeTruthy();
    }
    expect(new Set(ALL_REFERENCES.map(ref => ref.key)).size).toBe(ALL_REFERENCES.length);
  });
});

describe('sleep science', () => {
  it('changes the explanation and linked evidence with the selected roster pattern', () => {
    render(<MemoryRouter><FatigueSciencePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Time-zone changes' }));
    expect(screen.getByRole('button', { name: 'Time-zone changes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'The destination clock and your body clock can disagree.' })).toBeInTheDocument();
    const evidence = screen.getByRole('list', { name: 'Evidence for this pattern' });
    expect(within(evidence).getByRole('link', { name: 'Rempe et al. (2025)' })).toHaveAttribute('href', evidenceHref('rempe_2025'));
    expect(screen.getByText(/quality factors and confidence labels are modelling choices/)).toBeInTheDocument();
    expect(screen.getByText(/does not model the transient impairment immediately after waking/)).toBeInTheDocument();
  });
});


describe('report evidence', () => {
  it('links each generated recommendation to an identified catalogue source', () => {
    const duty = { ...mockAnalysisResults.duties[0], priorSleep: 5, sleepDebt: 7,
      crewComposition: 'augmented_4' as const, woclExposure: 3, preDutyAwakeHours: 12,
      dutyHours: 12, landingPerformance: 30, landingKss: 8, minPerformance: 30, maxKss: 8,
      riskAdvisory: 'report_recommended' as const, inflightRestBlocks: [] };
    const advice = generateMitigations(duty, []);
    expect(advice.length).toBeGreaterThan(5);
    for (const item of advice) {
      expect(item.sourceKeys?.length).toBeGreaterThan(0);
      for (const key of item.sourceKeys ?? []) expect(getReferenceByKey(key)?.verification).toBe('identified');
    }
    expect(advice.find(item => item.category === 'NAPPING')?.text).toContain('explicitly permitted');
    expect(advice.find(item => item.category === 'CAFFEINE')?.text).toContain('does not model a caffeine dose');
    expect(advice.find(item => item.category === 'SCHEDULING')?.text).toContain('Without intervening sleep');
  });
});
