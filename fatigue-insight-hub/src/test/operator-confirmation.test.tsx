import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AirlineDetectionPrompt } from '@/components/fatigue/roster/AirlineDetectionPrompt';
import { operatorLabel } from '@/lib/operator-label';

const confirmCompany = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({
  isAuthenticated: true, user: { company_id: null }, confirmCompany,
}) }));
vi.mock('@/contexts/AnalysisContext', () => ({ useAnalysis: () => ({ state: { analysisResults: {
  analysisId: 'suggestion-test', companyDetection: {
    suggestedName: 'Qatar Airways', suggestedIcao: 'QTR', confidence: 1, needsConfirmation: false,
  },
} } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

beforeEach(() => confirmCompany.mockClear());

describe('operator identity and consent', () => {
  it('uses neutral presentation while retaining other operator identities', () => {
    expect(operatorLabel('Qatar Airways')).toBe('Operator QTR');
    expect(operatorLabel('legacy name', 'QTR')).toBe('Operator QTR');
    expect(operatorLabel('easyJet', 'EZY')).toBe('easyJet');
  });

  it('requires a pilot action even for a high-confidence cached suggestion', async () => {
    render(<AirlineDetectionPrompt />);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Operator QTR');
    expect(screen.queryByText('Qatar Airways')).not.toBeInTheDocument();
    expect(confirmCompany).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Confirm$/ }));
    await waitFor(() => expect(confirmCompany).toHaveBeenCalledTimes(1));
  });

  it('lets the pilot dismiss a suggestion without assigning membership', async () => {
    render(<AirlineDetectionPrompt />);
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(confirmCompany).not.toHaveBeenCalled();
  });
});
