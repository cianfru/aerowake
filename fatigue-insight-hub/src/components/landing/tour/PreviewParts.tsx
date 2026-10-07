import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Labelled figure, as in the workspace's outlook facts. */
export function PreviewFact({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="min-w-0">
    <p className="text-xs text-[color:var(--lp-526579)]">{label}</p>
    <p className="mt-1 text-2xl font-semibold leading-tight text-[color:var(--lp-142e45)]">{value}</p>
    {sub && <p className="mt-1 text-xs text-[color:var(--lp-425d73)]">{sub}</p>}
  </div>;
}

/** Legend entry: a swatch (any element) beside ink text. */
export function LegendKey({ swatch, children, className }: { swatch: ReactNode; children: ReactNode; className?: string }) {
  return <li className={cn('flex items-center gap-2', className)}>{swatch}<span>{children}</span></li>;
}
