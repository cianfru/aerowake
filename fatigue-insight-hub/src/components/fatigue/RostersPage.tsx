import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, FileText, MapPin, Plane, Timer, Hash, Eye, RotateCcw, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConnectionStatus } from './ConnectionStatus';
import { SidebarUpload } from './SidebarUpload';
import { AirlineConfirmationDialog } from './AirlineConfirmationDialog';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAnalyzeRoster } from '@/hooks/useAnalyzeRoster';
import { useRosterHistory } from '@/hooks/useRosterHistory';
import { useAuth } from '@/contexts/AuthContext';
import { getRoster } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { toast } from 'sonner';
import type { RosterSummary } from '@/lib/api-client';
import type { CompanyDetection } from '@/types/fatigue';

// ── Helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatMonth(month: string) {
  try {
    const [year, m] = month.split('-');
    return new Date(Number(year), Number(m) - 1).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return month;
  }
}

// ── Main Component ───────────────────────────────────────────

export function RostersPage() {
  const navigate = useNavigate();
  const { state, uploadFile, removeFile, loadAnalysis, setActiveTab } = useAnalysis();
  const { runAnalysis, isAnalyzing } = useAnalyzeRoster();
  const { isAuthenticated, user, confirmCompany } = useAuth();

  const { uploadedFile, analysisResults } = state;

  // ── Airline confirmation dialog state ──
  const [airlineDialogOpen, setAirlineDialogOpen] = useState(false);
  const [pendingDetection, setPendingDetection] = useState<CompanyDetection | null>(null);

  // Watch for company_detection after analysis completes
  useEffect(() => {
    if (!analysisResults?.companyDetection || !isAuthenticated || user?.company_id) return;

    const detection = analysisResults.companyDetection;

    if (!detection.needsConfirmation) {
      // High confidence (>= 0.9) — auto-confirm silently with a toast
      confirmCompany(detection.suggestedName, detection.suggestedIcao)
        .then(() => toast.success(`Added to ${detection.suggestedName}`))
        .catch(() => {
          // Fall back to showing dialog if auto-confirm fails
          setPendingDetection(detection);
          setAirlineDialogOpen(true);
        });
    } else {
      // Lower confidence — ask pilot to confirm
      setPendingDetection(detection);
      setAirlineDialogOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResults?.companyDetection, isAuthenticated, user?.company_id]);

  const {
    rosters,
    isLoading,
    isError,
    deleteRoster,
    isDeleting,
    reanalyze,
    isReanalyzing,
  } = useRosterHistory();

  const handleViewRoster = async (roster: RosterSummary) => {
    if (!roster.analysis_id) return;
    try {
      const detail = await getRoster(roster.id);
      if (detail.analysis) {
        const [year, month] = (roster.month || '2026-01').split('-');
        const fallbackMonth = new Date(Number(year), Number(month) - 1, 1);
        const transformed = transformAnalysisResult(detail.analysis, fallbackMonth);
        loadAnalysis(transformed);
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to load roster:', err);
    }
  };

  const handleDelete = (rosterId: string) => {
    if (window.confirm('Delete this roster and its analysis? This cannot be undone.')) {
      deleteRoster(rosterId);
    }
  };

  const handleReanalyze = (rosterId: string) => {
    reanalyze({ rosterId });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Rosters</h2>
          </div>
          <ConnectionStatus />
        </div>

        {/* Upload Section */}
        <Card variant="glass">
          <CardContent className="p-4 md:p-5">
            <SidebarUpload
              uploadedFile={uploadedFile}
              onFileUpload={uploadFile}
              onRemoveFile={removeFile}
              onRunAnalysis={() => runAnalysis()}
              isAnalyzing={isAnalyzing}
              hasResults={!!analysisResults}
            />
          </CardContent>
        </Card>

        {/* Saved Rosters Section */}
        {!isAuthenticated ? (
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="space-y-4">
              <span className="text-5xl">🔐</span>
              <h3 className="text-lg font-semibold">Sign In Required</h3>
              <p className="text-sm text-muted-foreground">
                Sign in to view your saved rosters and analysis history.
              </p>
              <Button variant="glow" onClick={() => navigate('/login')}>
                Sign In
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Section header */}
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Saved Rosters</h3>
              {rosters.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {rosters.length}
                </Badge>
              )}
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card variant="glass" key={i} className="animate-pulse">
                    <CardContent className="p-4 md:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-5 bg-secondary/50 rounded w-1/3" />
                        <div className="h-5 bg-secondary/30 rounded w-24" />
                      </div>
                      <div className="h-4 bg-secondary/30 rounded w-2/3" />
                      <div className="h-4 bg-secondary/20 rounded w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Error */}
            {isError && (
              <Card variant="glass" className="p-6 text-center">
                <p className="text-sm text-critical">Failed to load rosters. Please try again.</p>
              </Card>
            )}

            {/* Empty state */}
            {!isLoading && !isError && rosters.length === 0 && (
              <Card variant="glass" className="p-8 md:p-12 text-center">
                <div className="space-y-4">
                  <span className="text-5xl">📁</span>
                  <h3 className="text-lg font-semibold">No Rosters Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload and analyze a roster above — it will automatically be saved here.
                  </p>
                </div>
              </Card>
            )}

            {/* Roster list — wide inline rows */}
            {!isLoading && rosters.length > 0 && (
              <div className="space-y-3">
                {rosters.map((roster) => (
                  <RosterRow
                    key={roster.id}
                    roster={roster}
                    onView={handleViewRoster}
                    onDelete={handleDelete}
                    onReanalyze={handleReanalyze}
                    isDeleting={isDeleting}
                    isReanalyzing={isReanalyzing}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Airline confirmation dialog (shown after first upload) */}
        {pendingDetection && (
          <AirlineConfirmationDialog
            detection={pendingDetection}
            open={airlineDialogOpen}
            onOpenChange={setAirlineDialogOpen}
            onConfirmed={() => {
              setPendingDetection(null);
              toast.success('Airline confirmed!');
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Roster Row (wide inline card) ────────────────────────────

interface RosterRowProps {
  roster: RosterSummary;
  onView: (roster: RosterSummary) => void;
  onDelete: (rosterId: string) => void;
  onReanalyze: (rosterId: string) => void;
  isDeleting?: boolean;
  isReanalyzing?: boolean;
}

function RosterRow({ roster, onView, onDelete, onReanalyze, isDeleting, isReanalyzing }: RosterRowProps) {
  return (
    <Card variant="glass" className="group hover:border-primary/30 transition-all duration-200">
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-6">
          {/* Left: details */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Row 1: Filename + month + preset */}
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-semibold truncate">{roster.filename}</span>
              <Badge variant="outline" className="text-[10px]">
                {formatMonth(roster.month)}
              </Badge>
              {roster.config_preset && (
                <Badge variant="info" className="text-[10px] capitalize">
                  {roster.config_preset}
                </Badge>
              )}
            </div>

            {/* Row 2: Pilot info */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {roster.pilot_id && (
                <span className="flex items-center gap-1">
                  <span className="font-mono text-foreground/80">{roster.pilot_id}</span>
                </span>
              )}
              {roster.home_base && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{roster.home_base}</span>
                </span>
              )}
            </div>

            {/* Row 3: Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {roster.total_duties != null && (
                <span className="flex items-center gap-1">
                  <Plane className="h-3 w-3" />
                  <span className="text-foreground/80 font-medium">{roster.total_duties}</span> duties
                </span>
              )}
              {roster.total_sectors != null && (
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  <span className="text-foreground/80 font-medium">{roster.total_sectors}</span> sectors
                </span>
              )}
              {roster.total_duty_hours != null && (
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  <span className="text-foreground/80 font-medium">{roster.total_duty_hours.toFixed(1)}h</span> duty
                </span>
              )}
              {roster.total_block_hours != null && (
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  <span className="text-foreground/80 font-medium">{roster.total_block_hours.toFixed(1)}h</span> block
                </span>
              )}
            </div>

            {/* Row 4: Upload date */}
            <p className="text-[10px] text-muted-foreground">
              Uploaded {formatDate(roster.created_at)}
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 md:pt-1">
            <Button
              variant="glow"
              size="sm"
              className="text-xs"
              onClick={() => onView(roster)}
              disabled={!roster.analysis_id}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              View Analysis
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onReanalyze(roster.id)}
              disabled={isReanalyzing}
              title="Re-analyze"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-critical"
              onClick={() => onDelete(roster.id)}
              disabled={isDeleting}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
