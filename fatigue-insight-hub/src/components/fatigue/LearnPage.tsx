import { Brain, BookOpen } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FatigueSciencePage } from './FatigueSciencePage';
import { ResearchReferencesPage } from './ResearchReferencesPage';

/** Evidence deep links open the exact citation, including from a roster tooltip. */
export function LearnPage() {
  const [params, setParams] = useSearchParams();
  const active = params.get('section') === 'references' ? 'references' : 'science';
  const onTabChange = (value: string) => { const next = new URLSearchParams(params); next.set('section', value); next.delete('source'); setParams(next, { replace: true }); };
  return <div className="mx-auto max-w-5xl px-4 py-4 md:p-6">
    <Tabs value={active} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-2">
        <TabsTrigger value="science" className="min-h-11 gap-2 text-sm"><Brain className="h-4 w-4" aria-hidden="true" />Sleep science</TabsTrigger>
        <TabsTrigger value="references" className="min-h-11 gap-2 text-sm"><BookOpen className="h-4 w-4" aria-hidden="true" />Evidence library</TabsTrigger>
      </TabsList>
      <TabsContent value="science" className="mt-4"><FatigueSciencePage /></TabsContent>
      <TabsContent value="references" className="mt-4"><ResearchReferencesPage /></TabsContent>
    </Tabs>
  </div>;
}
