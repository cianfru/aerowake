import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Brain, Moon, Shield, Plane, FlaskConical, Mountain } from 'lucide-react';
import {
  ALL_REFERENCES,
  CATEGORY_CONFIG,
  CATEGORY_ORDER,
  groupByCategory,
} from '@/data/references';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Brain:        <Brain className="h-4 w-4" />,
  Moon:         <Moon className="h-4 w-4" />,
  FlaskConical: <FlaskConical className="h-4 w-4" />,
  Plane:        <Plane className="h-4 w-4" />,
  Shield:       <Shield className="h-4 w-4" />,
  BookOpen:     <BookOpen className="h-4 w-4" />,
  Mountain:     <Mountain className="h-4 w-4" />,
};

export function ResearchReferencesPage() {
  const grouped = groupByCategory(ALL_REFERENCES);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Scientific References
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Peer-reviewed studies and regulatory documents underpinning the Aerowake fatigue model.
            All sleep strategies, circadian calculations, and risk thresholds cite these sources.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap mb-6">
            <Badge variant="outline" className="text-xs">
              {ALL_REFERENCES.length} references
            </Badge>
            {CATEGORY_ORDER.map(cat => {
              const config = CATEGORY_CONFIG[cat];
              const count = grouped[cat]?.length ?? 0;
              if (count === 0) return null;
              return (
                <Badge key={cat} variant="secondary" className="text-xs gap-1">
                  <span className={config.color}>{CATEGORY_ICONS[config.iconName]}</span>
                  {count} {config.label}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {CATEGORY_ORDER.map(cat => {
        const refs = grouped[cat];
        if (!refs || refs.length === 0) return null;
        const config = CATEGORY_CONFIG[cat];

        return (
          <Card key={cat} variant="glass">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className={config.color}>{CATEGORY_ICONS[config.iconName]}</span>
                {config.label}
                <Badge variant="outline" className="text-[10px] ml-1">{refs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {refs.map(ref => (
                  <div
                    key={ref.key}
                    className="rounded-lg bg-secondary/30 p-3 border border-border/50"
                  >
                    <p className="text-sm font-medium text-foreground mb-0.5">
                      {ref.short}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {ref.full}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
