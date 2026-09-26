import { useState } from 'react';
import { Calendar, CalendarPlus, Apple, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadIcsFile, openGoogleCalendarBatch } from '@/lib/calendar-export';
import { DutyAnalysis } from '@/types/fatigue';
import { toast } from 'sonner';

interface ExportOptionsProps {
  duties?: DutyAnalysis[];
}

export function ExportOptions({ duties = [] }: ExportOptionsProps) {
  const [isExportingIcs, setIsExportingIcs] = useState(false);

  const handleIcsExport = async () => {
    if (duties.length === 0) {
      toast.error('No duties to export');
      return;
    }
    
    setIsExportingIcs(true);
    try {
      await downloadIcsFile(duties);
      toast.success('Calendar file downloaded! Import it into Apple Calendar or any iCal-compatible app.');
    } catch (error) {
      toast.error('Failed to generate calendar file');
      console.error(error);
    } finally {
      setIsExportingIcs(false);
    }
  };

  const handleGoogleCalendarExport = () => {
    if (duties.length === 0) {
      toast.error('No duties to export');
      return;
    }
    
    openGoogleCalendarBatch(duties);
    toast.info('Opening Google Calendar... For bulk import, use the iCal file.');
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5" aria-label="Add to calendar">
      <p className="text-[13px] text-muted-foreground">
        Add {duties.length} {duties.length === 1 ? 'duty' : 'duties'} to your calendar
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleIcsExport} disabled={isExportingIcs || duties.length === 0}>
          {isExportingIcs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Apple className="h-3.5 w-3.5" />}
          Apple (.ics)
        </Button>
        <Button variant="outline" size="sm" onClick={handleGoogleCalendarExport} disabled={duties.length === 0}>
          <Calendar className="h-3.5 w-3.5" />
          Google
        </Button>
      </div>
    </section>
  );
}
