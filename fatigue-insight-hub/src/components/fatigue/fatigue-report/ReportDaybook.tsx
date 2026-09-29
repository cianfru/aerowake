import { BedDouble, CalendarDays, Plane } from 'lucide-react';
import { formatHours, type DiaryDay } from '@/lib/report-diary';
import { cn } from '@/lib/utils';

export function ReportDaybook({ days, selected, onSelect, mode, timezone }: {
  days: DiaryDay[]; selected: string; onSelect: (date: string) => void; mode: 'duties' | 'sleep'; timezone: string;
}) {
  return <section aria-label="Recent days" className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 text-primary" /> Reconstruct your recent days</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose a day to {mode === 'duties' ? 'review or add duties' : 'record sleep and naps'}. Overnight entries appear on both days. Times use {timezone}.</p></div>
      <button type="button" onClick={() => onSelect('all')} aria-pressed={selected === 'all'} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">Show all entries</button>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {days.map(day => <button type="button" key={day.date} onClick={() => onSelect(day.date)} aria-pressed={selected === day.date}
        aria-label={`Review ${day.label}${day.event ? ', event day' : ''}`}
        className={cn('min-w-0 space-y-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected === day.date ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-card hover:bg-muted')}>
        <span className="block text-sm font-semibold">{day.label}</span>
        {day.event && <span className="block text-xs font-medium text-primary">Event day</span>}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Plane className="h-3.5 w-3.5 shrink-0" />{day.dutyHours > 0 ? `${formatHours(day.dutyHours)} operated` : day.plannedHours > 0 ? `${formatHours(day.plannedHours)} planned` : day.duties.length ? 'Not operated' : 'No duty entered'}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><BedDouble className="h-3.5 w-3.5 shrink-0" />{day.reportedSleep > 0 ? `${formatHours(day.reportedSleep)} reported` : day.estimatedSleep > 0 ? `${formatHours(day.estimatedSleep)} estimated` : 'Sleep not entered'}</span>
        {day.reportedSleep > 0 && day.estimatedSleep > 0 && <span className="block text-xs text-muted-foreground">+ {formatHours(day.estimatedSleep)} estimated</span>}
      </button>)}
    </div>
    <p className="text-xs leading-5 text-muted-foreground">These are hours within each calendar day, not complete duty lengths. Empty days are missing information until you confirm your diary. Gaps between duties are time off, not hours slept or a legal rest assessment.</p>
  </section>;
}
