import { useState } from 'react';
import { X, Microscope, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdvancedParametersDialog } from './AdvancedParametersDialog';
import { SettingsProfileManager } from './SettingsProfileManager';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useTheme } from '@/hooks/useTheme';
import type { PilotSettings } from '@/types/fatigue';

const configPresets = [
  { value: 'default', label: 'EASA Default', description: 'Balanced Borbely two-process model, EASA-compliant thresholds' },
  { value: 'conservative', label: 'Conservative', description: 'Faster fatigue buildup, stricter thresholds, 8.5h sleep need' },
  { value: 'liberal', label: 'Liberal', description: 'Relaxed thresholds for experienced crew, 7.5h sleep need' },
  { value: 'research', label: 'Research', description: 'Textbook Borbely (Jewett & Kronauer 1999), 50/50 S/C weighting' },
];

export function SettingsPanel() {
  const { state, setSettings, setExpandedPanel } = useAnalysis();
  const { setTheme } = useTheme();
  const [paramsOpen, setParamsOpen] = useState(false);

  const { settings } = state;
  const activePreset = configPresets.find(p => p.value === settings.configPreset);

  const handleSettingsChange = (newSettings: Partial<PilotSettings>) => {
    if (newSettings.theme) setTheme(newSettings.theme);
    setSettings(newSettings);
  };

  return (
    <aside className="fixed left-[var(--icon-rail-width)] top-0 bottom-0 z-20 w-[var(--panel-width)] glass-strong border-r border-border/50 overflow-y-auto transition-transform duration-200">
      <div className="space-y-3 p-3 pt-4">
        {/* Panel header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Settings</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setExpandedPanel(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Model Configuration */}
        <Card variant="glass">
          <CardHeader className="pb-2 px-3 pt-2.5">
            <CardTitle className="flex items-center gap-2 text-xs">
              <Microscope className="h-3.5 w-3.5 text-primary" />
              Model Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2.5">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Configuration Preset</Label>
              <Select
                value={settings.configPreset}
                onValueChange={(value) => handleSettingsChange({ configPreset: value })}
              >
                <SelectTrigger className="h-8 bg-secondary/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {configPresets.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value} className="text-xs">
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activePreset && (
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {activePreset.description}
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-[10px] text-muted-foreground gap-1.5 h-7"
              onClick={() => setParamsOpen(true)}
            >
              <Settings2 className="h-3 w-3" />
              View Model Parameters
            </Button>

            <AdvancedParametersDialog
              preset={settings.configPreset}
              open={paramsOpen}
              onOpenChange={setParamsOpen}
            />
          </CardContent>
        </Card>

        {/* Settings Profiles */}
        <SettingsProfileManager
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />
      </div>
    </aside>
  );
}
