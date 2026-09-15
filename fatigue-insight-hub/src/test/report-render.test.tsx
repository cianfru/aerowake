import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FatigueReport } from '@/components/fatigue/report/FatigueReport';
import { mockAnalysisResults } from '@/data/mockAnalysisData';
vi.mock('@/components/fatigue/report/ReportWhatIfEditor', () => ({ReportWhatIfEditor: () => null}));
describe('report document', () => {
  it('renders a compact prediction with an optional technical appendix', () => {
    render(<FatigueReport duty={mockAnalysisResults.duties[0]} analysisId="baseline" onBack={() => {}} />);
    expect(screen.getByRole('button', {name:'Print / Save PDF'})).toBeInTheDocument();
    expect(screen.getByText('Technical appendix and supporting details').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Roster-based prediction')).toBeInTheDocument();
    expect(screen.queryByText(/comparable to.*BAC/i)).not.toBeInTheDocument();
  });
});
