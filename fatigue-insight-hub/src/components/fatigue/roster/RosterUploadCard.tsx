import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, FileText, Loader2, X } from 'lucide-react';
import { previewRoster, RosterRequestError, type RosterPreview } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyzeRoster } from '@/hooks/useAnalyzeRoster';
import { RosterDropZone } from './upload/RosterDropZone';
import { HomeBaseField } from './upload/HomeBaseField';
import { RosterImportSummary } from './upload/RosterImportSummary';
import { formatFileSize, monthInWords, TEMPLATE_HREF, TEMPLATE_FILENAME } from './upload/import-format';

type Phase =
  | { name: 'idle' }
  | { name: 'reading' }
  | { name: 'needsBase'; message: string; error?: string }
  | { name: 'failed'; message: string; code: string; retryable: boolean }
  | { name: 'ready'; preview: RosterPreview; version: number };

/** Errors about the base the pilot typed, shown next to the field rather than replacing the view. */
const BASE_ERRORS = new Set(['unknown_airport', 'invalid_home_base', 'base_mismatch']);
const RETRYABLE = new Set(['service_unavailable', 'unreadable_response', 'network', 'http_429']);

function describe(error: unknown) {
  if (error instanceof RosterRequestError) return { message: error.message, code: error.code };
  return { message: error instanceof Error ? error.message : 'The roster could not be read.', code: 'unknown' };
}

/**
 * Upload a roster, confirm what was read, analyse.
 *
 * The home base comes from the roster header (PDF) or a duty pattern the
 * pilot confirms (CSV). Typing a base is the fallback, and replacing a header
 * base is an explicit, warned override. The analysis uses exactly the base
 * shown in the summary.
 */
export function RosterUploadCard() {
  const { state, uploadFile, removeFile, setSettings } = useAnalysis();
  const { user } = useAuth();
  const { runAnalysis, isAnalyzing, error: analyseError, reset: resetAnalysis } = useAnalyzeRoster({ inlineErrors: true });
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
  const [baseError, setBaseError] = useState<string>();
  const generation = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const file = state.actualFileObject;
  const { uploadedFile } = state;

  const readRoster = useCallback(async (target: File, base: string | null, override: boolean, origin: 'auto' | 'needsBase' | 'change') => {
    const current = ++generation.current;
    setBaseError(undefined);
    if (origin === 'auto') setPhase({ name: 'reading' });
    else setRefreshing(true);
    try {
      const preview = await previewRoster(target, base, { override });
      if (current !== generation.current) return;
      setPhase({ name: 'ready', preview, version: current });
    } catch (error) {
      if (current !== generation.current) return;
      const { message, code } = describe(error);
      if (code === 'home_base_required') {
        setPhase({ name: 'needsBase', message });
      } else if (BASE_ERRORS.has(code) && origin === 'needsBase') {
        setPhase(p => ({ name: 'needsBase', message: p.name === 'needsBase' ? p.message : message, error: message }));
      } else if (BASE_ERRORS.has(code) && origin === 'change') {
        setBaseError(message);
      } else {
        setPhase({ name: 'failed', message, code, retryable: RETRYABLE.has(code) });
      }
    } finally {
      if (current === generation.current) setRefreshing(false);
    }
  }, []);

  // Read every newly chosen file straight away; nothing to type first.
  useEffect(() => {
    resetAnalysis?.(); // optional: lightweight test doubles omit it
    if (!file) {
      generation.current++;
      setPhase({ name: 'idle' });
      setRefreshing(false);
      return;
    }
    readRoster(file, null, false, 'auto');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, readRoster]);

  // Move focus to what changed: the summary heading, the base field or the error.
  const focusKey = phase.name === 'ready' ? `ready-${phase.version}` : phase.name;
  useEffect(() => {
    if (phase.name === 'ready') headingRef.current?.focus({ preventScroll: false });
    if (phase.name === 'failed') alertRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const analyse = (preview: RosterPreview) => {
    // Remember the base actually used (per browser), never the raw input.
    setSettings({ homeBase: preview.home_base });
    runAnalysis({ homeBase: preview.home_base, override: !!preview.base_override });
  };

  const status = phase.name === 'reading' ? 'Reading your roster…'
    : refreshing ? 'Updating the roster summary…'
      : phase.name === 'needsBase' ? 'Enter your home base to continue.'
        : phase.name === 'ready' && isAnalyzing ? 'Analysing your roster…'
          : phase.name === 'ready' ? `Roster read: ${monthInWords(phase.preview.month)}, ${phase.preview.total_duties} duties, home base ${phase.preview.home_base}.`
            : '';

  return (
    <Card variant="elevated" className="overflow-hidden rounded-2xl">
      <CardContent className="space-y-6 p-5 sm:p-6 md:p-9">
        <div className="space-y-3">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><FileText className="h-6 w-6" aria-hidden="true" /></div>
          <h1 className="text-3xl font-semibold tracking-tight">Check your roster</h1>
          <p className="text-sm text-muted-foreground">
            Upload your monthly roster to plan rest around the duties that need it. Aerowake reads your home base
            and duties from the file, shows you what it found, then estimates sleepiness for each duty and runs
            scoped EASA FTL checks.
          </p>
        </div>

        <p role="status" aria-live="polite" className="sr-only">{status}</p>

        {!uploadedFile || !file ? (
          <RosterDropZone onFile={(chosen, kind) => uploadFile({ name: chosen.name, size: chosen.size, type: kind }, chosen)} />
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 p-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { if (!isAnalyzing) removeFile(); }}
              aria-disabled={isAnalyzing || undefined}
              className="h-8 w-8 flex-shrink-0"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {file && phase.name === 'reading' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            Reading your roster…
          </p>
        )}

        {file && phase.name === 'needsBase' && (
          <HomeBaseField
            label="Home base"
            help={<>{phase.message} Report times, home or hotel sleep and home-base rest rules depend on it.</>}
            initial={user?.home_base || state.settings.homeBase || ''}
            submitLabel="Continue"
            busy={refreshing}
            error={phase.error}
            autoFocus
            onSubmit={(base) => readRoster(file, base, false, 'needsBase')}
          />
        )}

        {file && phase.name === 'failed' && (
          <div ref={alertRef} tabIndex={-1} role="alert" className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm focus:outline-none">
            <p className="flex gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <span>{phase.message}</span>
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {phase.retryable && <Button type="button" size="sm" onClick={() => readRoster(file, null, false, 'auto')}>Try again</Button>}
              <Button type="button" size="sm" variant="outline" onClick={removeFile}>Choose another file</Button>
              {!phase.retryable && (
                <a href={TEMPLATE_HREF} download={TEMPLATE_FILENAME} className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />CSV template
                </a>
              )}
            </div>
          </div>
        )}

        {file && phase.name === 'ready' && (
          <RosterImportSummary
            key={phase.version}
            ref={headingRef}
            preview={phase.preview}
            refreshing={refreshing}
            analysing={isAnalyzing}
            baseError={baseError}
            analyseError={analyseError?.message}
            onChangeBase={(base, override) => readRoster(file, base, override, 'change')}
            onUseRosterBase={() => readRoster(file, null, false, 'change')}
            onAnalyse={() => { resetAnalysis?.(); analyse(phase.preview); }}
            onChooseAnother={removeFile}
          />
        )}
      </CardContent>
    </Card>
  );
}
