import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '@/components/landing/LandingPage';
import { HERO_COPY, NON_AFFILIATION_NOTE } from '@/components/landing/landingData';
import { RISK_LEVEL_LABELS, classifyKss } from '@/lib/risk-scale';
import { LANDING_CANONICAL_URL, LANDING_THEME_COLOR } from '@/components/landing/useLandingHead';

function renderLanding(onEnter = vi.fn()) {
  render(<MemoryRouter><LandingPage onEnter={onEnter} /></MemoryRouter>);
  return onEnter;
}

describe('landing page', () => {
  it('leads with the planning promise from HERO_COPY', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HERO_COPY.headline);
    expect(screen.getByText(HERO_COPY.subline)).toBeInTheDocument();
  });

  it('offers analysis and a sample roster, with reporting reachable in British English', () => {
    const onEnter = renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Analyse my roster' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyse roster' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyse a roster' }));
    expect(onEnter).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('link', { name: /Explore a sample roster/ })).toHaveAttribute('href', '#tour');
    const logLinks = screen.getAllByRole('link', { name: 'Log how a duty went' });
    expect(logLinks.length).toBeGreaterThan(0);
    logLinks.forEach((link) => expect(link).toHaveAttribute('href', '/report'));
    expect(document.body.textContent).not.toMatch(/Analyz|analyz|judgment\b|\bcolor|labeled|AeroWake/);
  });

  it('states independence, authorship role and evaluation status', () => {
    renderLanding();
    expect(screen.getAllByText(NON_AFFILIATION_NOTE, { exact: false }).length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('Built by a line pilot');
    expect(document.body.textContent).toContain('Independent scientific and FTL evaluation required');
    expect(screen.getByRole('link', { name: /PLoS ONE 9\(10\): e108679/ })).toHaveAttribute('href', 'https://doi.org/10.1371/journal.pone.0108679');
  });

  it('shows each illustrative duty with the band of its displayed peak and home-base times', () => {
    renderLanding();
    const card = screen.getByText('Your roster at a glance').closest('figure') as HTMLElement;
    expect(within(card).getByText(/home-base time, DOH \(UTC\+3\)/)).toBeInTheDocument();
    const rows = within(card).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const shown = row.textContent?.match(/Peak (\d\.\d)KSS/)?.[1];
      expect(shown).toBeDefined();
      expect(row.textContent).toContain(RISK_LEVEL_LABELS[classifyKss(Number(shown))]);
    }
  });

  it('switches product tour views by pointer and keyboard', async () => {
    renderLanding();
    const outlook = screen.getByRole('tab', { name: /Outlook/ });
    expect(outlook).toHaveAttribute('aria-selected', 'true');
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Routes/ }), { button: 0 });
    expect(screen.getByRole('tab', { name: /Routes/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('table', { name: /Routes flown this month/ })).toBeInTheDocument();
    fireEvent.mouseDown(outlook, { button: 0 });
    outlook.focus();
    fireEvent.keyDown(outlook, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByRole('tab', { name: /Calendar/ })).toHaveAttribute('aria-selected', 'true'));
  });

  it('updates the duty explanation when a visitor selects a different duty', () => {
    renderLanding();
    const roster = screen.getByRole('figure', { name: 'Interactive illustrative roster' });
    const daytime = within(roster).getByRole('button', { name: /Sat 3 Oct/ });
    const overnight = within(roster).getByRole('button', { name: /Mon 5 Oct/ });
    expect(within(roster).getByRole('button', { name: /Wed 7 Oct/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(overnight);
    expect(overnight).toHaveAttribute('aria-pressed', 'true');
    expect(within(roster).getByText(/04:47 body clock/)).toBeInTheDocument();
    fireEvent.click(daytime);
    expect(daytime).toHaveAttribute('aria-pressed', 'true');
    expect(overnight).toHaveAttribute('aria-pressed', 'false');
    expect(within(roster).getByText(/stays outside the 02:00–05:59/)).toBeInTheDocument();
  });

  it('opens the compact navigation and closes it by link or Escape', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' });
    fireEvent.click(within(navigation).getByRole('link', { name: 'The workspace' }));
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(toggle);
    fireEvent.keyDown(screen.getByRole('navigation', { name: 'Mobile navigation' }), { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('keeps every section reachable from the header links', () => {
    renderLanding();
    for (const id of ['how-it-works', 'science', 'privacy', 'operations', 'tour']) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('declares the canonical link and daylight browser colour only while mounted', () => {
    const { unmount } = render(<MemoryRouter><LandingPage onEnter={vi.fn()} /></MemoryRouter>);
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', LANDING_CANONICAL_URL);
    expect(document.head.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', LANDING_THEME_COLOR);
    unmount();
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelector('meta[name="theme-color"]')).toBeNull();
  });
});
