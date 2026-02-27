import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { useAdminData } from '@/hooks/useAdminData';
import { AdminOverviewTab } from '@/components/admin/AdminOverviewTab';
import { AdminUsersTab } from '@/components/admin/AdminUsersTab';
import { AdminRostersTab } from '@/components/admin/AdminRostersTab';

export default function AdminDashboard() {
  // Apply saved theme
  useEffect(() => {
    const stored = localStorage.getItem('fatigue-theme') as 'dark' | 'light' | null;
    const theme = stored || 'dark';
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
  }, []);

  const { stats, users, rosters, activity, isLoading, refetchAll } = useAdminData();

  return (
    <>
      <AuroraBackground />
      <div className="relative z-10 min-h-screen w-full">
        {/* Header */}
        <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back to App</span>
              </Link>
              <div className="h-4 w-px bg-border/40" />
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h1 className="text-sm font-semibold">Admin Dashboard</h1>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refetchAll}
              className="text-xs gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-card/40 backdrop-blur-sm border border-border/50">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="users" className="text-xs">
                Users {!isLoading && users.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">({users.length})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="rosters" className="text-xs">
                Rosters {!isLoading && rosters.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">({rosters.length})</span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <AdminOverviewTab
                stats={stats}
                activity={activity}
                isLoading={isLoading}
              />
            </TabsContent>

            <TabsContent value="users">
              <AdminUsersTab users={users} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="rosters">
              <AdminRostersTab rosters={rosters} isLoading={isLoading} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
