import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FDPUtilizationBar } from '@/components/fatigue/FDPUtilizationBar';
import { hhmm } from '@/lib/hhmm';

describe('FDP limits (QCAA / EASA ORO.FTL.205)', () => {
  it('formats hours as h:mm', () => {
    expect(hhmm(11.25)).toBe('11:15');
    expect(hhmm(13)).toBe('13:00');
  });

  it('shows the maximum, the planned extension and discretion with their tables', () => {
    render(<FDPUtilizationBar actualFdpHours={13.5} maxFdpHours={13} extendedFdpHours={15}
      plannedExtensionFdpHours={14} fdpLimitReference="ORO.FTL.205(b) Table 2" usedDiscretion />);
    expect(screen.getByText('ORO.FTL.205(b) Table 2')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText(/Uses a planned extension/)).toBeInTheDocument();
  });

  it('says when no extension is allowed and the FDP needs discretion', () => {
    render(<FDPUtilizationBar actualFdpHours={11.5} maxFdpHours={11} extendedFdpHours={13}
      plannedExtensionFdpHours={null} fdpLimitReference="ORO.FTL.205(b) Table 2" usedDiscretion />);
    expect(screen.getByText('Not allowed')).toBeInTheDocument();
    expect(screen.getByText(/Above the planned maximum/)).toBeInTheDocument();
  });

  it('has no extension row for an augmented crew', () => {
    render(<FDPUtilizationBar actualFdpHours={15} maxFdpHours={17} extendedFdpHours={20}
      fdpLimitReference="CS FTL.1.205(c), in-flight rest, long sector" />);
    expect(screen.queryByText('Planned extension')).not.toBeInTheDocument();
    expect(screen.getByText('CS FTL.1.205(c), in-flight rest, long sector')).toBeInTheDocument();
  });
});
