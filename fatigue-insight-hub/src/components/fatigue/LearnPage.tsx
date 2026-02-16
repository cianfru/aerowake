import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MathematicalModelPage } from './MathematicalModelPage';
import { FatigueSciencePage } from './FatigueSciencePage';
import { ResearchReferencesPage } from './ResearchReferencesPage';

export function LearnPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <Tabs defaultValue="model" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-auto mb-6">
          <TabsTrigger value="model" className="text-xs md:text-sm py-2">
            Mathematical Model
          </TabsTrigger>
          <TabsTrigger value="science" className="text-xs md:text-sm py-2">
            Sleep Science
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs md:text-sm py-2">
            References
          </TabsTrigger>
        </TabsList>
        <TabsContent value="model" className="mt-0">
          <MathematicalModelPage />
        </TabsContent>
        <TabsContent value="science" className="mt-0">
          <FatigueSciencePage />
        </TabsContent>
        <TabsContent value="references" className="mt-0">
          <ResearchReferencesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
