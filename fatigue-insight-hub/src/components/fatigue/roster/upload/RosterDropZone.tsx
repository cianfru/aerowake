import { useId, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { checkRosterFile, TEMPLATE_HREF, TEMPLATE_FILENAME, type RosterFileKind } from './import-format';

/**
 * File picker and drop target. Rejects the wrong type or size before any
 * upload, and explains which rosters Aerowake reads.
 */
export function RosterDropZone({ onFile }: { onFile: (file: File, kind: RosterFileKind) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const hintId = useId();
  const errorId = useId();

  const accept = (file: File | undefined) => {
    if (!file) return;
    const result = checkRosterFile(file);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setError('');
    onFile(file, result.kind);
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  return (
    <div className="space-y-3">
      <div
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={(e) => { onDrag(e); setIsDragging(false); accept(e.dataTransfer.files?.[0]); }}
        className={cn(
          'relative rounded-xl border-2 border-dashed px-5 py-9 text-center transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
          isDragging ? 'border-primary bg-primary/10' : 'border-primary/30 bg-primary/5 hover:border-primary/60 hover:bg-primary/10',
          error && !isDragging && 'border-destructive/60',
        )}
      >
        <input
          type="file"
          accept=".pdf,.csv,application/pdf,text/csv"
          aria-label="Choose roster file (PDF or CSV)"
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; accept(file); }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Upload className="mx-auto mb-3 h-8 w-8 text-primary" aria-hidden="true" />
        <p className="text-sm font-medium">
          Drop your roster here or <span className="text-primary underline underline-offset-4">choose a file</span>
        </p>
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">PDF or CSV, up to 10 MB</p>
      </div>
      {error && <p id={errorId} role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          Reads CrewLink and easyJet roster PDFs. Other airlines: fill in the CSV template.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={TEMPLATE_HREF}
            download={TEMPLATE_FILENAME}
            className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download CSV template
          </a>
          <details className="group">
            <summary className="cursor-pointer rounded-sm font-medium text-foreground/80 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              CSV columns
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
              <dt className="font-mono text-foreground/80">Date</dt><dd>Duty date in home-base time, YYYY-MM-DD</dd>
              <dt className="font-mono text-foreground/80">Flight</dt><dd>Flight number</dd>
              <dt className="font-mono text-foreground/80">Departure, Arrival</dt><dd>3-letter IATA airport codes</dd>
              <dt className="font-mono text-foreground/80">STD, STA</dt><dd>Local time at each airport, HH:MM</dd>
              <dt className="font-mono text-foreground/80">Report, Release</dt><dd>Home-base time, HH:MM. Rows with the same Date and Report form one duty.</dd>
            </dl>
          </details>
        </div>
      </div>
    </div>
  );
}
