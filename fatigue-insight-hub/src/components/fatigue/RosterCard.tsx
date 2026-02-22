import { Calendar, Plane, Timer, MapPin, Trash2, RotateCcw, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RosterSummary } from '@/lib/api-client';

interface RosterCardProps {
  roster: RosterSummary;
  onView: (roster: RosterSummary) => void;
  onDelete: (rosterId: string) => void;
  onReanalyze: (rosterId: string) => void;
  isDeleting?: boolean;
  isReanalyzing?: boolean;
}

export function RosterCard({
  roster,
  onView,
  onDelete,
  onReanalyze,
  isDeleting,
  isReanalyzing,
}: RosterCardProps) {
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatMonth = (month: string) => {
    try {
      const [year, m] = month.split('-');
      const d = new Date(Number(year), Number(m) - 1);
      return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    } catch {
      return month;
    }
  };

  return (
    <Card variant="glass" className="group hover:border-primary/30 transition-all duration-200">
      <CardContent className="p-4 space-y-3">
        {/* Header: filename + month */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold truncate">{roster.filename}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">
                <Calendar className="h-3 w-3 mr-1" />
                {formatMonth(roster.month)}
              </Badge>
              {roster.config_preset && (
                <Badge variant="info" className="text-[10px] capitalize">
                  {roster.config_preset}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {roster.pilot_id && (
            <span className="flex items-center gap-1">
              <span className="font-mono">{roster.pilot_id}</span>
            </span>
          )}
          {roster.home_base && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {roster.home_base}
            </span>
          )}
          {roster.total_duties != null && (
            <span className="flex items-center gap-1">
              <Plane className="h-3 w-3" />
              {roster.total_duties} duties
            </span>
          )}
          {roster.total_duty_hours != null && (
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {roster.total_duty_hours.toFixed(1)}h
            </span>
          )}
        </div>

        {/* Upload date */}
        <div className="text-[10px] text-muted-foreground/60">
          Uploaded {formatDate(roster.created_at)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="glow"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onView(roster)}
            disabled={!roster.analysis_id}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View Analysis
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onReanalyze(roster.id)}
            disabled={isReanalyzing}
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-critical"
            onClick={() => onDelete(roster.id)}
            disabled={isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
