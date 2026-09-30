import { useMemo, useState } from 'react';
import { Check, ClipboardCopy, FileDown, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportToText, type FatigueReport } from '@/lib/fatigue-report-api';
import { reportSummaryText } from '@/lib/report-export';
import { downloadBlob } from './charts/chart-export';
import { printTitle } from './report-print';

type Copied = 'summary' | 'full' | null;

/**
 * Export actions. The short summary is for the operator's safety report form;
 * the PDF carries the full report with charts. Nothing is sent automatically.
 */
export function ReportExportBar({ report, fileStem }: { report: FatigueReport; fileStem: string }) {
  const summary = useMemo(() => reportSummaryText(report), [report]);
  const full = useMemo(() => reportToText(report), [report]);
  const [copied, setCopied] = useState<Copied>(null);
  const [fallback, setFallback] = useState<Copied>(null);
  const [preview, setPreview] = useState(false);

  const copy = async (which: Exclude<Copied, null>) => {
    try {
      await navigator.clipboard.writeText(which === 'summary' ? summary : full);
      setFallback(null);
      setCopied(which);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied(null);
      setFallback(which);
    }
  };

  const pdf = () => {
    const original = document.title;
    document.title = printTitle(report);
    window.print();
    // Most browsers block until the dialog closes; afterprint also restores it.
    setTimeout(() => { document.title = original; }, 1000);
  };

  const fallbackText = fallback === 'summary' ? summary : fallback === 'full' ? full : '';

  return (
    <section aria-labelledby="export-title" className="no-print space-y-3 rounded-xl border border-border bg-muted/40 p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="export-title" className="font-semibold">Send to your operator</h2>
        <p className="text-xs text-muted-foreground">Nothing is sent automatically. Review before you submit.</p>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Paste the summary into your company safety report form and attach the PDF, which includes both charts. Charts can also be copied or downloaded individually below.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => copy('summary')}>
          {copied === 'summary' ? <Check className="mr-1.5 h-4 w-4" /> : <ClipboardCopy className="mr-1.5 h-4 w-4" />}
          {copied === 'summary' ? 'Summary copied' : 'Copy summary'}
        </Button>
        <Button type="button" variant="outline" onClick={pdf}><Printer className="mr-1.5 h-4 w-4" />Download PDF</Button>
        <Button type="button" variant="outline" onClick={() => copy('full')}>
          {copied === 'full' ? <Check className="mr-1.5 h-4 w-4" /> : <FileText className="mr-1.5 h-4 w-4" />}
          {copied === 'full' ? 'Full text copied' : 'Copy full text'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => downloadBlob(new Blob([full], { type: 'text/plain;charset=utf-8' }), `${fileStem}.txt`)}>
          <FileDown className="mr-1.5 h-4 w-4" />Text file
        </Button>
        <Button type="button" variant="ghost" onClick={() => downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `${fileStem}.json`)}>
          <FileDown className="mr-1.5 h-4 w-4" />JSON
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        “Download PDF” opens the print dialog: choose “Save as PDF”. The JSON file keeps every input, including your personal KSS watch reference, which is not printed.
      </p>
      <button type="button" className="text-sm font-medium underline underline-offset-4" aria-expanded={preview} onClick={() => setPreview(!preview)}>
        {preview ? 'Hide summary' : `Preview summary (${summary.length} characters)`}
      </button>
      {preview && <pre className="whitespace-pre-wrap rounded-lg border bg-background p-3 text-[13px] leading-6">{summary}</pre>}
      {copied && <p role="status" className="text-sm">Copied. Paste it into your safety report form and check it before submitting.</p>}
      {fallback && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">This browser blocked copying. Select the text below and copy it manually.</p>
          <textarea aria-label="Report text" readOnly rows={10} value={fallbackText} onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border bg-background p-3 text-sm leading-6" />
        </div>
      )}
    </section>
  );
}
