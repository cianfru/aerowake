import { format, parseISO } from 'date-fns';
import { Users, FolderOpen, UserPlus, Upload, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PlatformStats, ActivityEvent } from '@/lib/admin-api';

interface AdminOverviewTabProps {
  stats: PlatformStats | undefined;
  activity: ActivityEvent[];
  isLoading: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subValue?: string;
  color: string;
}) {
  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          {subValue && (
            <p className="text-xs text-muted-foreground">{subValue}</p>
          )}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
      </div>
    </Card>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, HH:mm');
  } catch {
    return iso;
  }
}

export function AdminOverviewTab({ stats, activity, isLoading }: AdminOverviewTabProps) {
  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground text-sm">Loading platform data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.total_users}
          color="text-foreground"
        />
        <StatCard
          icon={FolderOpen}
          label="Total Rosters"
          value={stats.total_rosters}
          subValue={`${stats.avg_rosters_per_user} avg per user`}
          color="text-foreground"
        />
        <StatCard
          icon={UserPlus}
          label="New Users (7d)"
          value={stats.users_last_7_days}
          color={stats.users_last_7_days > 0 ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'}
        />
        <StatCard
          icon={Upload}
          label="Uploads (7d)"
          value={stats.rosters_last_7_days}
          color={stats.rosters_last_7_days > 0 ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Active Users */}
        <Card variant="glass" className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-primary" />
            Most Active Users
          </h3>
          {stats.most_active_users.length === 0 ? (
            <p className="text-xs text-muted-foreground">No users yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs text-right">Rosters</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.most_active_users.map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">
                      <span className="font-medium">{u.display_name || 'Anonymous'}</span>
                      {u.email && (
                        <span className="text-muted-foreground ml-1.5">
                          {u.email}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {u.roster_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Recent Activity Feed */}
        <Card variant="glass" className="p-5">
          <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity yet</p>
          ) : (
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {activity.slice(0, 20).map((event, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 text-xs"
                >
                  <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                    event.event_type === 'user_signup'
                      ? 'bg-[hsl(var(--success))]/15'
                      : 'bg-primary/15'
                  }`}>
                    {event.event_type === 'user_signup' ? (
                      <UserPlus className="h-3 w-3 text-[hsl(var(--success))]" />
                    ) : (
                      <Upload className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">
                      <span className="font-medium">
                        {event.user_display_name || event.user_email?.split('@')[0] || 'User'}
                      </span>
                      {event.event_type === 'user_signup'
                        ? ' signed up'
                        : ` uploaded ${(event.details as { filename?: string }).filename || 'a roster'}`}
                    </p>
                    <p className="text-muted-foreground">
                      {formatTimestamp(event.timestamp)}
                      {event.event_type === 'roster_upload' && (event.details as { month?: string }).month && (
                        <> · {(event.details as { month?: string }).month}</>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
