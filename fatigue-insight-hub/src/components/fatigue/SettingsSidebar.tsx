import { Info, BookOpen, ChevronDown, User, MapPin, Plane, Users, Settings2, Save, Microscope } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PilotSettings, UploadedFile } from '@/types/fatigue';
import { useState } from 'react';
import { SidebarUpload } from './SidebarUpload';
import { ConnectionStatus } from './ConnectionStatus';
import { AdvancedParametersDialog } from './AdvancedParametersDialog';
import { SettingsProfileManager } from './SettingsProfileManager';

interface PilotInfo {
  name?: string;
  id?: string;
  base?: string;
  aircraft?: string;
}

interface SettingsSidebarProps {
  settings: PilotSettings;
  onSettingsChange: (settings: Partial<PilotSettings>) => void;
  uploadedFile: UploadedFile | null;
  onFileUpload: (file: UploadedFile, actualFile: File) => void;
  onRemoveFile: () => void;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  hasResults: boolean;
  pilotInfo?: PilotInfo;
}


const configPresets = [
  { value: 'default', label: 'EASA Default', description: 'Balanced Borbely two-process model, EASA-compliant thresholds' },
  { value: 'conservative', label: 'Conservative', description: 'Faster fatigue buildup, stricter thresholds, 8.5h sleep need' },
  { value: 'liberal', label: 'Liberal', description: 'Relaxed thresholds for experienced crew, 7.5h sleep need' },
  { value: 'research', label: 'Research', description: 'Textbook Borbely (Jewett & Kronauer 1999), 50/50 S/C weighting' },
];

export function SettingsSidebar({ 
  settings, 
  onSettingsChange,
  uploadedFile,
  onFileUpload,
  onRemoveFile,
  onRunAnalysis,
  isAnalyzing,
  hasResults,
  pilotInfo,
}: SettingsSidebarProps) {
  const [paramsOpen, setParamsOpen] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const activePreset = configPresets.find(p => p.value === settings.configPreset);

  return (
    <div className="w-full md:w-80 flex-shrink-0 space-y-3 md:space-y-4 overflow-y-auto p-3 md:p-4 pt-10 md:pt-4">
      {/* Connection Status */}
      <ConnectionStatus />

      {/* Roster Upload - Now at the top */}
      <SidebarUpload
        uploadedFile={uploadedFile}
        onFileUpload={onFileUpload}
        onRemoveFile={onRemoveFile}
        onRunAnalysis={onRunAnalysis}
        isAnalyzing={isAnalyzing}
        hasResults={hasResults}
      />

      {/* Pilot Info Card - shown after analysis */}
      {pilotInfo && (pilotInfo.name || pilotInfo.id || pilotInfo.base) && (
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Pilot Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pilotInfo.name && (
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{pilotInfo.name}</p>
                </div>
              </div>
            )}
            {pilotInfo.id && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">ID</span>
                <div>
                  <p className="text-[10px] text-muted-foreground">Pilot ID</p>
                  <p className="text-sm font-medium">{pilotInfo.id}</p>
                </div>
              </div>
            )}
            {pilotInfo.base && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Base</p>
                  <p className="text-sm font-medium">{pilotInfo.base}</p>
                </div>
              </div>
            )}
            {pilotInfo.aircraft && (
              <div className="flex items-center gap-2">
                <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Aircraft</p>
                  <p className="text-sm font-medium">{pilotInfo.aircraft}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Analysis Period Card */}
      <Card variant="glass">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="text-primary">📅</span>
            Analysis Period
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Select period:</Label>
            <div className="flex gap-2">
              <Button
                variant={settings.analysisType === 'single' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSettingsChange({ analysisType: 'single' })}
                className="flex-1 text-xs"
              >
                Single Month
              </Button>
              <Button
                variant={settings.analysisType === 'range' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSettingsChange({ analysisType: 'range' })}
                className="flex-1 text-xs"
              >
                Date Range
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Select Month</Label>
            <Input
              type="month"
              value={settings.selectedMonth.toISOString().slice(0, 7)}
              onChange={(e) => onSettingsChange({ selectedMonth: new Date(e.target.value) })}
              className="h-9 bg-secondary/50"
            />
          </div>
        </CardContent>
      </Card>


      {/* Crew Configuration Card (ULR) */}
      <Card variant="glass">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Crew Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Analysis Perspective (ULR)
            </Label>
            <Select
              value={settings.crewSet}
              onValueChange={(value) => onSettingsChange({ crewSet: value as 'crew_a' | 'crew_b' })}
            >
              <SelectTrigger className="h-9 bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="crew_a">Crew A (Operating)</SelectItem>
                <SelectItem value="crew_b">Crew B (Relief)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-[10px] text-muted-foreground">
            For augmented crew ULR duties, select which crew set's fatigue profile to analyze.
            Standard 2-pilot duties are unaffected.
          </p>
        </CardContent>
      </Card>

      {/* Model Configuration Card */}
      <Card variant="glass">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Microscope className="h-5 w-5 text-primary" />
            Model Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Configuration Preset</Label>
            <Select
              value={settings.configPreset}
              onValueChange={(value) => onSettingsChange({ configPreset: value })}
            >
              <SelectTrigger className="h-9 bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {configPresets.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
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
            className="w-full justify-start text-xs text-muted-foreground gap-1.5"
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
        onSettingsChange={onSettingsChange}
      />

      {/* How to Use Card */}
      <Collapsible open={howToOpen} onOpenChange={setHowToOpen}>
        <Card variant="glass">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer pb-4 hover:bg-secondary/20">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  How to Use
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${howToOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <ol className="list-inside list-decimal space-y-2 text-xs text-muted-foreground">
                <li>Upload your roster file (PDF or CSV)</li>
                <li>Configure your pilot settings and home base</li>
                <li>Select the analysis period</li>
                <li>Click "Run Analysis" to generate fatigue predictions</li>
                <li>Review results and export reports as needed</li>
              </ol>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
