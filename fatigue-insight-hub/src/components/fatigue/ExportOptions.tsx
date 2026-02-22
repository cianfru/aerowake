import { useState } from 'react';
import { Calendar, FileText, Table, Download, Apple, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card variant="glass">
      <CardHeader className="pb-2 md:pb-4">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Download className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          Step 4: Download Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-6">
        {/* Export Grid */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Apple Calendar / iCal Export */}
          <Button
            variant="outline"
            className="h-auto flex-col gap-1.5 md:gap-2 p-4 md:p-6"
            onClick={handleIcsExport}
            disabled={isExportingIcs || duties.length === 0}
          >
            {isExportingIcs ? (
              <Loader2 className="h-6 w-6 md:h-8 md:w-8 text-primary animate-spin" />
            ) : (
              <Apple className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            )}
            <div className="text-center">
              <p className="font-medium text-xs md:text-sm">Apple Calendar</p>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Download .ics file</p>
            </div>
          </Button>

          {/* Google Calendar Export */}
          <Button
            variant="outline"
            className="h-auto flex-col gap-1.5 md:gap-2 p-4 md:p-6"
            onClick={handleGoogleCalendarExport}
            disabled={duties.length === 0}
          >
            <Calendar className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <div className="text-center">
              <p className="font-medium text-xs md:text-sm">Google Calendar</p>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Add to Google</p>
            </div>
          </Button>

          {/* PDF Report (Coming Soon) */}
          <Button
            variant="outline"
            className="h-auto flex-col gap-1.5 md:gap-2 p-4 md:p-6"
            disabled
          >
            <FileText className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium text-xs md:text-sm">PDF Report</p>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Coming soon</p>
            </div>
          </Button>

          {/* Excel Export (Coming Soon) */}
          <Button
            variant="outline"
            className="h-auto flex-col gap-1.5 md:gap-2 p-4 md:p-6"
            disabled
          >
            <Table className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium text-xs md:text-sm">Excel Export</p>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Coming soon</p>
            </div>
          </Button>
        </div>

        {duties.length > 0 && (
          <p className="text-[10px] md:text-xs text-muted-foreground text-center">
            {duties.length} duties available for export
          </p>
        )}
      </CardContent>
    </Card>
  );
}
