import { FolderOpen, BarChart3, Activity, CalendarRange, BookOpen, Info, Settings2, Plane } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAnalysis, type ExpandedPanel } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  icon: React.ElementType;
  label: string;
  /** If true, clicking toggles a panel instead of switching content. */
  panel?: 'rosters' | 'settings';
  requiresAuth?: boolean;
  section: 'top' | 'bottom';
}

const navItems: NavItem[] = [
  { id: 'rosters',  icon: FolderOpen,     label: 'Rosters',   panel: 'rosters',  section: 'top' },
  { id: 'analysis', icon: BarChart3,      label: 'Analysis',  section: 'top' },
  { id: 'insights', icon: Activity,       label: 'Insights',  section: 'top' },
  { id: 'yearly',   icon: CalendarRange,  label: '12-Month',  requiresAuth: true, section: 'top' },
  { id: 'learn',    icon: BookOpen,       label: 'Learn',     section: 'bottom' },
  { id: 'about',    icon: Info,           label: 'About',     section: 'bottom' },
  { id: 'settings', icon: Settings2,      label: 'Settings',  panel: 'settings', section: 'bottom' },
];

export function IconRail() {
  const { state, setActiveTab, togglePanel } = useAnalysis();
  const { isAuthenticated } = useAuth();

  const topItems = navItems.filter(i => i.section === 'top');
  const bottomItems = navItems.filter(i => i.section === 'bottom');

  const isActive = (item: NavItem) => {
    if (item.panel) return state.expandedPanel === item.panel;
    return state.activeTab === item.id;
  };

  const handleClick = (item: NavItem) => {
    if (item.panel) {
      togglePanel(item.panel);
    } else {
      setActiveTab(item.id);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 z-30 w-[var(--icon-rail-width)] flex-col items-center glass-strong border-r border-border/50">
        {/* Logo mark */}
        <div className="flex h-12 w-full items-center justify-center border-b border-border/30">
          <Plane className="h-5 w-5 text-primary" />
        </div>

        {/* Top nav items */}
        <nav className="flex flex-col items-center gap-1 pt-2 w-full px-1.5">
          {topItems.map(item => {
            if (item.requiresAuth && !isAuthenticated) return null;
            const active = isActive(item);
            return (
              <RailButton
                key={item.id}
                item={item}
                active={active}
                onClick={() => handleClick(item)}
              />
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom nav items */}
        <nav className="flex flex-col items-center gap-1 pb-3 w-full px-1.5">
          {bottomItems.map(item => {
            if (item.requiresAuth && !isAuthenticated) return null;
            const active = isActive(item);
            return (
              <RailButton
                key={item.id}
                item={item}
                active={active}
                onClick={() => handleClick(item)}
              />
            );
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}

function RailButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200',
            active
              ? 'bg-secondary/60 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30',
          )}
          aria-label={item.label}
        >
          {/* Active accent bar */}
          {active && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
          )}
          <Icon className="h-[18px] w-[18px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}
