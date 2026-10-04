import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FDPUtilizationBar } from '@/components/fatigue/FDPUtilizationBar';
import { hhmm } from '@/lib/hhmm';

describe('FDP limits from Qatar OM-A 7.6', () => {
  it('formats hours as h:mm', () => {
    expect(hhmm(11.25)).toBe('11:15');
    expect(hhmm(13)).toBe('13:00');
  });

  it('shows the maximum, the planned extension and discretion with their tables', () => {
    render(<FDPUtilizationBar actualFdpHours={13.5} maxFdpHours={13} extendedFdpHours={15}
      plannedExtensionFdpHours={14} fdpLimitReference="OM-A 7.6.3 Table 7-6" usedDiscretion />);
    expect(screen.getByText('OM-A 7.6.3 Table 7-6')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText(/Uses a planned extension/)).toBeInTheDocument();
  });

  it('says when no extension is allowed and the FDP needs discretion', () => {
    render(<FDPUtilizationBar actualFdpHours={11.5} maxFdpHours={11} extendedFdpHours={13}
      plannedExtensionFdpHours={null} fdpLimitReference="OM-A 7.6.3 Table 7-6" usedDiscretion />);
    expect(screen.getByText('Not allowed')).toBeInTheDocument();
    expect(screen.getByText(/Above the planned maximum/)).toBeInTheDocument();
  });

  it('has no extension row for an augmented crew', () => {
    render(<FDPUtilizationBar actualFdpHours={15} maxFdpHours={17} extendedFdpHours={20}
      fdpLimitReference="OM-A 7.6.6 Table 7-10" />);
    expect(screen.queryByText('Planned extension')).not.toBeInTheDocument();
    expect(screen.getByText('OM-A 7.6.6 Table 7-10')).toBeInTheDocument();
  });
});
