import { useNavigate } from 'react-router-dom';
import { X, User, MapPin, Plane, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectionStatus } from './ConnectionStatus';
import { SidebarUpload } from './SidebarUpload';
import { RosterCard } from './RosterCard';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAnalyzeRoster } from '@/hooks/useAnalyzeRoster';
import { useRosterHistory } from '@/hooks/useRosterHistory';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { getRoster } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import type { RosterSummary } from '@/lib/api-client';
import type { PilotSettings } from '@/types/fatigue';

export function RosterPanel() {
  const navigate = useNavigate();
  const { state, setSettings, uploadFile, removeFile, setExpandedPanel, loadAnalysis, setActiveTab } = useAnalysis();
  const { runAnalysis, isAnalyzing } = useAnalyzeRoster();
  const { setTheme } = useTheme();
  const { isAuthenticated } = useAuth();

  const { settings, uploadedFile, analysisResults } = state;

  const {
    rosters,
    isLoading: rostersLoading,
    deleteRoster,
    isDeleting,
    reanalyze,
    isReanalyzing,
  } = useRosterHistory();

  const pilotInfo = analysisResults ? {
    name: analysisResults.pilotName,
    id: analysisResults.pilotId,
    base: analysisResults.pilotBase || settings.homeBase,
    aircraft: analysisResults.pilotAircraft,
  } : undefined;

  const handleSettingsChange = (newSettings: Partial<PilotSettings>) => {
    if (newSettings.theme) setTheme(newSettings.theme);
    setSettings(newSettings);
  };

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
    <aside className="fixed left-[var(--icon-rail-width)] top-0 bottom-0 z-20 w-[var(--panel-width)] glass-strong border-r border-border/50 overflow-y-auto transition-transform duration-200">
      <div className="space-y-3 p-3 pt-4">
        {/* Panel header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Rosters</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setExpandedPanel(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Connection Status */}
        <ConnectionStatus />

        {/* Upload + Run */}
        <SidebarUpload
          uploadedFile={uploadedFile}
          onFileUpload={uploadFile}
          onRemoveFile={removeFile}
          onRunAnalysis={() => runAnalysis()}
          isAnalyzing={isAnalyzing}
          hasResults={!!analysisResults}
        />

        {/* Active Roster Indicator */}
        {pilotInfo && (pilotInfo.name || pilotInfo.id || pilotInfo.base) && (
          <Card variant="glass">
            <CardContent className="py-2.5 px-3 space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active Roster</p>
              <div className="space-y-1">
                {pilotInfo.name && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{pilotInfo.name}</span>
                  </div>
                )}
                {pilotInfo.id && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground font-mono text-[10px]">{pilotInfo.id}</span>
                  </div>
                )}
                {pilotInfo.base && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span>{pilotInfo.base}</span>
                  </div>
                )}
                {pilotInfo.aircraft && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Plane className="h-3 w-3 text-muted-foreground" />
                    <span>{pilotInfo.aircraft}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis Period */}
        <Card variant="glass">
          <CardContent className="py-2.5 px-3 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-medium">Analysis Period</p>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant={settings.analysisType === 'single' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSettingsChange({ analysisType: 'single' })}
                className="flex-1 text-[10px] h-7"
              >
                Single Month
              </Button>
              <Button
                variant={settings.analysisType === 'range' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSettingsChange({ analysisType: 'range' })}
                className="flex-1 text-[10px] h-7"
              >
                Date Range
              </Button>
            </div>
            <Input
              type="month"
              value={settings.selectedMonth.toISOString().slice(0, 7)}
              onChange={(e) => handleSettingsChange({ selectedMonth: new Date(e.target.value) })}
              className="h-8 bg-secondary/50 text-xs"
            />
          </CardContent>
        </Card>

        {/* Saved Rosters (auth-required) */}
        {isAuthenticated && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Saved Rosters</p>
              {rosters.length > 0 && (
                <Badge variant="outline" className="text-[9px]">{rosters.length}</Badge>
              )}
            </div>

            {rostersLoading && (
              <div className="space-y-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-20 bg-secondary/30 rounded-lg animate-pulse" />
                ))}
              </div>
            )}

            {!rostersLoading && rosters.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-4">
                No saved rosters yet. Upload and analyze a roster to save it.
              </p>
            )}

            {!rostersLoading && rosters.length > 0 && (
              <div className="space-y-2">
                {rosters.map(roster => (
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
        )}
      </div>
    </aside>
  );
}
