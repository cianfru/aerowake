import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminUser } from '@/lib/admin-api';

interface AdminUsersTabProps {
  users: AdminUser[];
  isLoading: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    return format(parseISO(iso), 'MMM d, HH:mm');
  } catch {
    return iso;
  }
}

export function AdminUsersTab({ users, isLoading }: AdminUsersTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground text-sm">Loading users...</div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <Card variant="glass" className="p-8 text-center">
        <p className="text-muted-foreground text-sm">No users registered yet.</p>
      </Card>
    );
  }

  return (
    <Card variant="glass" className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Pilot ID</TableHead>
              <TableHead className="text-xs">Base</TableHead>
              <TableHead className="text-xs">Signed Up</TableHead>
              <TableHead className="text-xs">Last Upload</TableHead>
              <TableHead className="text-xs text-right">Rosters</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="text-xs font-medium">
                  {user.email || '—'}
                  {user.is_admin && (
                    <Badge variant="info" className="ml-1.5 text-[10px]">Admin</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {user.display_name || '—'}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {user.pilot_id || '—'}
                </TableCell>
                <TableCell className="text-xs font-mono">
                  {user.home_base || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(user.created_at)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(user.last_upload)}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {user.roster_count}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.is_active ? 'success' : 'critical'}
                    className="text-[10px]"
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="px-4 py-2.5 border-t border-border/50 text-xs text-muted-foreground">
        {users.length} user{users.length !== 1 ? 's' : ''} total
      </div>
    </Card>
  );
}
