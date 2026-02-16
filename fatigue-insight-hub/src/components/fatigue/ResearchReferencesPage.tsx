import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ResearchReferencesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Card variant="glass">
        <CardHeader>
          <CardTitle>References</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-xl font-semibold mb-2">Documentation Coming Soon</h3>
            <p className="text-muted-foreground max-w-md">
              This section will include academic references, research papers, 
              regulatory guidelines, and further reading on fatigue risk management.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
