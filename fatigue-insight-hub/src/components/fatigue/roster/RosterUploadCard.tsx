import { previewRoster, type RosterPreview } from '@/lib/api-client';
import { useCallback, useEffect, useId, useState, useRef } from 'react';
import { Upload, FileText, X, Play, Loader2, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyzeRoster } from '@/hooks/useAnalyzeRoster';

const IATA_RE = /^[A-Z]{3}$/;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Upload a roster, confirm the home base, run the analysis.
 * The home base is always visible and must be a 3-letter IATA code —
 * the app never analyses with an assumed base.
 */
export function RosterUploadCard() {
  const { state, uploadFile, removeFile, setSettings } = useAnalysis();
  const { user } = useAuth();
  const { runAnalysis, isAnalyzing } = useAnalyzeRoster();
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [homeBase, setHomeBase] = useState(
    (state.settings.homeBase || user?.home_base || '').toUpperCase(),
  );
  const previewGeneration = useRef(0);
  useEffect(() => { previewGeneration.current++; setPreview(null); setConfirmed(false); setPreviewBusy(false); setPreviewError(''); }, [state.actualFileObject, homeBase]);
  const baseId = useId();
  const fileId = useId();

  const { uploadedFile } = state;
  const baseValid = IATA_RE.test(homeBase);

  const accept = useCallback((file: File | undefined) => {
    if (!file) return;
    uploadFile(
      { name: file.name, size: file.size, type: file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'CSV' },
      file,
    );
  }, [uploadFile]);

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const onRun = async () => {
    if (!baseValid || !state.actualFileObject) return;
    if (!preview) {
      setPreviewBusy(true); setPreviewError('');
      const generation = ++previewGeneration.current;
      try { const value = await previewRoster(state.actualFileObject, homeBase); if (generation === previewGeneration.current) setPreview(value); }
      catch (e) { if (generation === previewGeneration.current) setPreviewError(e instanceof Error ? e.message : 'Preview failed.'); }
      finally { if (generation === previewGeneration.current) setPreviewBusy(false); }
      return;
    }
    if (!confirmed) return;
    setSettings({ homeBase });
    runAnalysis({ homeBase });
  };

  return (
    <Card variant="elevated" className="overflow-hidden rounded-2xl">
      <CardContent className="p-6 md:p-9 space-y-6">
        <div className="space-y-3">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><FileText className="h-6 w-6" aria-hidden="true" /></div>
          <h1 className="text-3xl font-semibold tracking-tight">Check your roster</h1>
          <p className="text-sm text-muted-foreground">
            Upload your monthly roster (PDF or CSV). You will see which duties need attention and which scoped duty and rest checks need review.
          </p>
        </div>

        {/* Step 1: file */}
        {!uploadedFile ? (
          <div
            onDragEnter={onDrag}
            onDragLeave={onDrag}
            onDragOver={onDrag}
            onDrop={(e) => { onDrag(e); setIsDragging(false); accept(e.dataTransfer.files?.[0]); }}
            className={cn(
              'relative rounded-xl border-2 border-dashed px-5 py-9 text-center transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
              isDragging ? 'border-primary bg-primary/10' : 'border-primary/30 bg-primary/5 hover:border-primary/60 hover:bg-primary/10',
            )}
          >
            <input
              id={fileId}
              type="file"
              accept=".pdf,.csv"
              aria-label="Choose roster file (PDF or CSV)"
              onChange={(e) => accept(e.target.files?.[0])}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <Upload className="h-8 w-8 mx-auto mb-3 text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">Drop your roster here or tap to choose</p>
            <p className="text-xs text-muted-foreground">PDF or CSV</p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 p-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={removeFile} className="h-8 w-8 flex-shrink-0" aria-label="Remove file">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: home base (always visible) */}
        <div className="space-y-1.5">
          <label htmlFor={baseId} className="flex items-center gap-1.5 text-sm font-medium">
            <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Home base (IATA)
          </label>
          <Input
            id={baseId}
            value={homeBase}
            onChange={(e) => setHomeBase(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3))}
            placeholder="e.g. LGW"
            autoComplete="off"
            inputMode="text"
            className="max-w-[10rem] font-mono uppercase tracking-wider"
            aria-invalid={homeBase.length > 0 && !baseValid}
            aria-describedby={`${baseId}-help`}
          />
          <p id={`${baseId}-help`} className="text-xs text-muted-foreground">
            {homeBase.length > 0 && !baseValid
              ? 'Enter a 3-letter airport code.'
              : 'Body-clock and night-time (WOCL) checks use this base. Make sure it matches the roster.'}
          </p>
        </div>

        {previewError && <p role="alert" className="text-sm text-destructive">{previewError}</p>}
        {preview && <section className="space-y-4 rounded-lg border border-border p-4" aria-label="Review parsed roster">
          <h2 className="text-lg font-medium">Review the import</h2>
          <p className="text-sm">{preview.month} · {preview.home_base} · {preview.home_timezone} · {preview.time_convention}</p>
          <p className="font-mono text-sm">{preview.total_duties} duties · {preview.total_sectors} sectors · {preview.standby_periods} standby periods</p>
          <p className="text-sm">Block hours: {preview.whole_duty_block_hours.toFixed(2)} for whole duties; {preview.calendar_month_block_hours.toFixed(2)} within the UTC month{preview.source_block_hours != null ? `; source total ${preview.source_block_hours.toFixed(2)}` : ''}.</p>
          <ul className="space-y-2 text-sm text-muted-foreground">{preview.warnings.map(w => <li key={w}>{w}</li>)}</ul>
          <details><summary className="cursor-pointer text-sm text-primary">Check parsed duty times (UTC)</summary><ul className="mt-3 max-h-64 space-y-3 overflow-auto text-sm">{preview.duties.map(d => <li key={d.id}><span className="font-medium">{d.route}</span><br /><span className="font-mono text-xs">{d.report_utc.slice(0,16).replace('T',' ')} → {d.release_utc.slice(0,16).replace('T',' ')} UTC</span></li>)}</ul></details>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I have reviewed the dates, time zones, and assumptions. Continue with these inputs.</span></label>
        </section>}
        {/* Step 3: run */}
        <Button
          variant="glow"
          className="h-12 w-full sm:w-auto sm:px-7"
          onClick={onRun}
          disabled={!uploadedFile || !baseValid || isAnalyzing || previewBusy || (!!preview && !confirmed)}
        >
          {isAnalyzing || previewBusy ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{previewBusy ? "Reading roster…" : "Analysing…"}</>
          ) : (
            <><Play className="mr-2 h-4 w-4" />{preview ? "Run analysis" : "Review roster"}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
