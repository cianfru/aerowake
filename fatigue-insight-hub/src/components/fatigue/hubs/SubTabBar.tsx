import { cn } from '@/lib/utils';

interface SubTabBarProps<T extends string> {
  label: string;
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
}

/** Compact, horizontally scrollable sub-navigation for a hub page. */
export function SubTabBar<T extends string>({ label, tabs, active, onChange }: SubTabBarProps<T>) {
  return (
    <div className="px-4 pt-4 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div
          role="tablist"
          aria-label={label}
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary/40 p-1 border border-border/40"
        >
          {tabs.map((t) => {
            const selected = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onChange(t.id)}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  selected
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
