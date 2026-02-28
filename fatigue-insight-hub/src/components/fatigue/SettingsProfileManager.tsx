import { useState, useEffect } from 'react';
import { Save, Trash2, FolderOpen, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PilotSettings } from '@/types/fatigue';

const PROFILES_KEY = 'aerowake-profiles';
const MAX_PROFILES = 5;

interface SettingsProfile {
  name: string;
  settings: Partial<PilotSettings>;
  createdAt: string;
}

interface SettingsProfileManagerProps {
  settings: PilotSettings;
  onSettingsChange: (settings: Partial<PilotSettings>) => void;
}

function loadProfiles(): SettingsProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistProfiles(profiles: SettingsProfile[]): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // Silently ignore storage errors
  }
}

export function SettingsProfileManager({ settings, onSettingsChange }: SettingsProfileManagerProps) {
  const [profiles, setProfiles] = useState<SettingsProfile[]>(() => loadProfiles());
  const [newName, setNewName] = useState('');
  const [showSave, setShowSave] = useState(false);

  // Persist whenever profiles change
  useEffect(() => {
    persistProfiles(profiles);
  }, [profiles]);

  const handleSave = () => {
    const name = newName.trim();
    if (!name) return;

    // Exclude theme and selectedMonth (Date) — store serializable fields
    const { theme, selectedMonth, ...rest } = settings;
    const profile: SettingsProfile = {
      name,
      settings: { ...rest, selectedMonth: new Date(selectedMonth.toISOString()) },
      createdAt: new Date().toISOString(),
    };

    setProfiles(prev => {
      // Replace existing profile with same name, or add new
      const filtered = prev.filter(p => p.name !== name);
      const updated = [...filtered, profile].slice(-MAX_PROFILES);
      return updated;
    });
    setNewName('');
    setShowSave(false);
  };

  const handleLoad = (profileName: string) => {
    const profile = profiles.find(p => p.name === profileName);
    if (!profile) return;

    const loaded: Partial<PilotSettings> = { ...profile.settings };
    // Reconstruct Date from ISO string if needed
    if (loaded.selectedMonth && typeof loaded.selectedMonth === 'string') {
      loaded.selectedMonth = new Date(loaded.selectedMonth as unknown as string);
    }
    onSettingsChange(loaded);
  };

  const handleDelete = (name: string) => {
    setProfiles(prev => prev.filter(p => p.name !== name));
  };

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="h-4 w-4 text-primary" />
          Settings Profiles
          {profiles.length > 0 && (
            <Badge variant="outline" className="text-[10px]">{profiles.length}/{MAX_PROFILES}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Load existing profile */}
        {profiles.length > 0 && (
          <div className="space-y-2">
            <Select onValueChange={handleLoad}>
              <SelectTrigger className="h-9 bg-secondary/50 text-xs">
                <SelectValue placeholder="Load a saved profile..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {profiles.map(p => (
                  <SelectItem key={p.name} value={p.name} className="text-xs">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>{p.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.settings.configPreset || 'operational'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Delete buttons */}
            <div className="flex flex-wrap gap-1">
              {profiles.map(p => (
                <Button
                  key={p.name}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-critical gap-1"
                  onClick={() => handleDelete(p.name)}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                  {p.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Save current settings */}
        {showSave ? (
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Profile name..."
              className="h-8 text-xs bg-secondary/50"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <Button size="sm" className="h-8 px-3 text-xs" onClick={handleSave} disabled={!newName.trim()}>
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setShowSave(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-muted-foreground gap-1.5"
            onClick={() => setShowSave(true)}
            disabled={profiles.length >= MAX_PROFILES}
          >
            <Plus className="h-3 w-3" />
            {profiles.length >= MAX_PROFILES ? 'Max profiles reached' : 'Save current settings as profile'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
