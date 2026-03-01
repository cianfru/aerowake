import { Lightbulb, Moon, Coffee, Users, Radio, Calendar, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ReportData, Mitigation } from '@/lib/report-narrative';

interface Props {
  data: ReportData;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  SLEEP: { icon: Moon, color: 'text-blue-400' },
  NAPPING: { icon: Moon, color: 'text-indigo-400' },
  MONITORING: { icon: Radio, color: 'text-amber-400' },
  CAFFEINE: { icon: Coffee, color: 'text-orange-400' },
  SCHEDULING: { icon: Calendar, color: 'text-purple-400' },
  CREW_REST: { icon: Users, color: 'text-teal-400' },
  GENERAL: { icon: Shield, color: 'text-primary' },
};

export function ReportMitigations({ data }: Props) {
  const { mitigations } = data;

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
        7. Mitigations & Recommendations
      </h2>
      <Card variant="glass" className="print:bg-white print:border-gray-300">
        <CardContent className="py-4 px-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground print:text-gray-600">
              Recommended countermeasures based on the identified risk factors.
              Each recommendation is supported by peer-reviewed fatigue science literature.
            </p>
          </div>

          <div className="space-y-3">
            {mitigations.map((m, i) => (
              <MitigationItem key={i} mitigation={m} index={i + 1} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function MitigationItem({ mitigation, index }: { mitigation: Mitigation; index: number }) {
  const config = CATEGORY_CONFIG[mitigation.category] ?? CATEGORY_CONFIG.GENERAL;
  const Icon = config.icon;

  return (
    <div className="rounded-lg bg-secondary/15 border border-border/20 px-4 py-3 print:bg-gray-50 print:border-gray-200">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary/40 flex-shrink-0 mt-0.5 print:bg-gray-200">
          <span className="text-[10px] font-bold text-muted-foreground">{index}</span>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className={`h-3.5 w-3.5 ${config.color} print:text-gray-700`} />
            <span className="text-sm font-medium print:text-black">{mitigation.title}</span>
            <Badge variant="secondary" className="text-[9px]">
              {mitigation.category.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground print:text-gray-700">
            {mitigation.text}
          </p>
          <p className="text-[10px] text-muted-foreground/70 italic print:text-gray-500">
            Reference: {mitigation.reference}
          </p>
        </div>
      </div>
    </div>
  );
}
