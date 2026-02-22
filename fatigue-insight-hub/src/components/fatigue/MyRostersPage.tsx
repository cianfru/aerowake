import { useNavigate } from 'react-router-dom';
import { FolderOpen, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RosterCard } from '@/components/fatigue/RosterCard';
import { useRosterHistory } from '@/hooks/useRosterHistory';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { getRoster } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import type { RosterSummary } from '@/lib/api-client';

export function MyRostersPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { loadAnalysis, setActiveTab } = useAnalysis();
  const {
    rosters,
    isLoading,
    isError,
    deleteRoster,
    isDeleting,
    reanalyze,
    isReanalyzing,
  } = useRosterHistory();

  if (!isAuthenticated) {
    return (
      <div className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
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
        </div>
      </div>
    );
  }

  const handleViewRoster = async (roster: RosterSummary) => {
    if (!roster.analysis_id) return;

    try {
      const detail = await getRoster(roster.id);
      if (detail.analysis) {
        // Parse the month from roster for fallback
        const [year, month] = (roster.month || '2026-01').split('-');
        const fallbackMonth = new Date(Number(year), Number(month) - 1, 1);

        // Transform raw API response into frontend AnalysisResults format
        const transformed = transformAnalysisResult(detail.analysis, fallbackMonth);

        // Load into context — this sets analysisResults, switches to analysis tab, hides landing
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
      <div className="mx-auto max-w-4xl space-y-4 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">My Rosters</h2>
            {rosters.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({rosters.length} roster{rosters.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab('analysis');
              navigate('/');
            }}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Upload New
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card variant="glass" key={i} className="animate-pulse">
                <CardContent className="p-4 space-y-3">
                  <div className="h-4 bg-secondary/50 rounded w-3/4" />
                  <div className="h-3 bg-secondary/30 rounded w-1/2" />
                  <div className="h-3 bg-secondary/30 rounded w-full" />
                  <div className="h-8 bg-secondary/20 rounded" />
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
                Upload a roster from the Analysis tab — it will automatically be saved here.
              </p>
              <Button
                variant="glow"
                onClick={() => {
                  setActiveTab('analysis');
                  navigate('/');
                }}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Upload Roster
              </Button>
            </div>
          </Card>
        )}

        {/* Roster Grid */}
        {!isLoading && rosters.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rosters.map((roster) => (
              <RosterCard
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
    </div>
  );
}
