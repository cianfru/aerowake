import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminRoster } from '@/lib/admin-api';

interface AdminRostersTabProps {
  rosters: AdminRoster[];
  isLoading: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMM d, yyyy HH:mm');
  } catch {
    return iso;
  }
}

function formatMonth(month: string): string {
  try {
    return format(parseISO(`${month}-01`), 'MMMM yyyy');
  } catch {
    return month;
  }
}

export function AdminRostersTab({ rosters, isLoading }: AdminRostersTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground text-sm">Loading rosters...</div>
      </div>
    );
  }

  if (rosters.length === 0) {
    return (
      <Card variant="glass" className="p-8 text-center">
        <p className="text-muted-foreground text-sm">No rosters uploaded yet.</p>
      </Card>
    );
  }

  return (
    <Card variant="glass" className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Month</TableHead>
              <TableHead className="text-xs">Uploaded By</TableHead>
              <TableHead className="text-xs">Pilot ID</TableHead>
              <TableHead className="text-xs">Base</TableHead>
              <TableHead className="text-xs text-right">Duties</TableHead>
              <TableHead className="text-xs text-right">Sectors</TableHead>
              <TableHead className="text-xs text-right">Duty Hrs</TableHead>
              <TableHead className="text-xs text-right">Block Hrs</TableHead>
              <TableHead className="text-xs text-center">Analysis</TableHead>
              <TableHead className="text-xs">Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rosters.map((roster) => (
              <TableRow key={roster.id}>
                <TableCell className="text-xs font-medium">
                  {formatMonth(roster.month)}
                </TableCell>
                <TableCell className="text-xs">
                  <span className="font-medium">{roster.user_display_name || 'Unknown'}</span>
                  {roster.user_email && (
                    <span className="text-muted-foreground ml-1 text-[11px]">
                      ({roster.user_email})
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {roster.pilot_id || '—'}
                </TableCell>
                <TableCell className="text-xs font-mono">
                  {roster.home_base || '—'}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {roster.total_duties ?? '—'}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {roster.total_sectors ?? '—'}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {roster.total_duty_hours != null
                    ? roster.total_duty_hours.toFixed(1)
                    : '—'}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {roster.total_block_hours != null
                    ? roster.total_block_hours.toFixed(1)
                    : '—'}
                </TableCell>
                <TableCell className="text-center">
                  {roster.has_analysis ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))] mx-auto" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(roster.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="px-4 py-2.5 border-t border-border/30 text-xs text-muted-foreground">
        {rosters.length} roster{rosters.length !== 1 ? 's' : ''} total
      </div>
    </Card>
  );
}
