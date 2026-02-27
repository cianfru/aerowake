import { useState } from 'react';
import { FolderOpen, BarChart3, Activity, MoreHorizontal, CalendarRange, BookOpen, Info, Settings2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAnalyzeRoster } from '@/hooks/useAnalyzeRoster';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

import { ConnectionStatus } from './ConnectionStatus';
import { SidebarUpload } from './SidebarUpload';

export function MobileBottomBar() {
  const { state, setActiveTab, uploadFile, removeFile, setSettings } = useAnalysis();
  const { runAnalysis, isAnalyzing } = useAnalyzeRoster();
  const { isAuthenticated } = useAuth();
  const { setTheme } = useTheme();
  const [rosterSheetOpen, setRosterSheetOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  const { settings, uploadedFile, analysisResults } = state;

  const primaryTabs = [
    { id: 'rosters-mobile', icon: FolderOpen, label: 'Rosters', action: () => setRosterSheetOpen(true) },
    { id: 'analysis', icon: BarChart3, label: 'Analysis', action: () => setActiveTab('analysis') },
    { id: 'insights', icon: Activity, label: 'Insights', action: () => setActiveTab('insights') },
    { id: 'more', icon: MoreHorizontal, label: 'More', action: () => setMoreSheetOpen(true) },
  ];

  const moreItems = [
    ...(isAuthenticated ? [{ id: 'yearly', icon: CalendarRange, label: '12-Month' }] : []),
    { id: 'learn', icon: BookOpen, label: 'Learn' },
    { id: 'about', icon: Info, label: 'About' },
  ];

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass-strong border-t border-border/50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around py-1.5 px-2">
          {primaryTabs.map(tab => {
            const Icon = tab.icon;
            const isActive =
              (tab.id === 'rosters-mobile' && rosterSheetOpen) ||
              (tab.id === 'more' && moreSheetOpen) ||
              (tab.id !== 'rosters-mobile' && tab.id !== 'more' && state.activeTab === tab.id);

            return (
              <button
                key={tab.id}
                onClick={tab.action}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-[56px]',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Roster Sheet (mobile) */}
      <Sheet open={rosterSheetOpen} onOpenChange={setRosterSheetOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 glass-strong">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle className="text-sm">Rosters</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-20 space-y-3">
            <ConnectionStatus />
            <SidebarUpload
              uploadedFile={uploadedFile}
              onFileUpload={uploadFile}
              onRemoveFile={removeFile}
              onRunAnalysis={() => { runAnalysis(); setRosterSheetOpen(false); }}
              isAnalyzing={isAnalyzing}
              hasResults={!!analysisResults}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* More Sheet (mobile) */}
      <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="bottom" className="glass-strong rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-sm">More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 pb-6">
            {moreItems.map(item => {
              const Icon = item.icon;
              const isActive = state.activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMoreSheetOpen(false);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
