import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2 } from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6 pb-12">
      <Card variant="glass" className="text-center">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold">About Aerowake</CardTitle>
          <p className="text-muted-foreground mt-2">
            Evidence-based aviation fatigue analysis
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-2 flex-wrap">
            <Badge variant="info">v{APP_VERSION}</Badge>
            <Badge variant="success">EASA ORO.FTL</Badge>
            <Badge variant="outline">Professional Grade</Badge>
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            Privacy & Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Your data stays under your control. We follow industry-standard security practices 
            and never share your roster data with third parties.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span><strong>Secure processing</strong> — Industry-standard security</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span><strong>No third-party sharing</strong> — Your data is yours</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span><strong>Transparent methodology</strong> — All calculations documented</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          <p>
            Built on the Borbély Two-Process Model. Scientific references: 
            Borbély & Achermann (1999), Van Dongen et al. (2003), Dinges et al. (1997).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
