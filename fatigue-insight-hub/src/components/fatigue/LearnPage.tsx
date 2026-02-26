import { Calculator, Brain, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MathematicalModelPage } from './MathematicalModelPage';
import { FatigueSciencePage } from './FatigueSciencePage';
import { ResearchReferencesPage } from './ResearchReferencesPage';

export function LearnPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <Tabs defaultValue="model" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="model" className="text-xs">
            <Calculator className="h-3 w-3 mr-1" />
            Mathematical Model
          </TabsTrigger>
          <TabsTrigger value="science" className="text-xs">
            <Brain className="h-3 w-3 mr-1" />
            Sleep Science
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs">
            <BookOpen className="h-3 w-3 mr-1" />
            References
          </TabsTrigger>
        </TabsList>
        <TabsContent value="model" className="mt-4">
          <MathematicalModelPage />
        </TabsContent>
        <TabsContent value="science" className="mt-4">
          <FatigueSciencePage />
        </TabsContent>
        <TabsContent value="references" className="mt-4">
          <ResearchReferencesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
