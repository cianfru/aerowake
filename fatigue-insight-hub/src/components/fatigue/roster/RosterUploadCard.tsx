import { useCallback, useId, useState } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [homeBase, setHomeBase] = useState(
    (state.settings.homeBase || user?.home_base || '').toUpperCase(),
  );
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

  const onRun = () => {
    if (!baseValid) return;
    setSettings({ homeBase });
    runAnalysis({ homeBase });
  };

  return (
    <Card variant="glass">
      <CardContent className="p-4 md:p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-lg md:text-xl font-semibold">Check your roster</h1>
          <p className="text-sm text-muted-foreground">
            Upload your monthly roster (PDF or CSV). You will see which duties need attention and whether
            the EASA cumulative duty and rest limits are met.
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
              'relative rounded-xl border-2 border-dashed p-6 text-center transition-colors',
              isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-secondary/30',
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
            <Upload className={cn('h-7 w-7 mx-auto mb-2', isDragging ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
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

        {/* Step 3: run */}
        <Button
          variant="glow"
          className="w-full sm:w-auto"
          onClick={onRun}
          disabled={!uploadedFile || !baseValid || isAnalyzing}
        >
          {isAnalyzing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analysing…</>
          ) : (
            <><Play className="mr-2 h-4 w-4" />Run analysis</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
