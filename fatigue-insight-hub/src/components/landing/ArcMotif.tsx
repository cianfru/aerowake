import { cn } from '@/lib/utils';

const MERIDIANS = [0.18, 0.42, 0.66, 0.88];
const PARALLELS = [-0.62, -0.3, 0, 0.3, 0.62];

/** Faint wireframe globe that echoes the hero in section backgrounds. Purely decorative. */
export function ArcMotif({ className }: { className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="-110 -110 220 220" className={cn('pointer-events-none absolute text-[#8fdce6]', className)} fill="none" stroke="currentColor" strokeWidth={0.6}>
    <circle r={100} />
    {MERIDIANS.map((k) => <ellipse key={k} rx={100 * k} ry={100} />)}
    {PARALLELS.map((y) => <ellipse key={y} cy={y * 100} rx={100 * Math.sqrt(1 - y * y)} ry={100 * Math.sqrt(1 - y * y) * 0.16} />)}
    <path d="M-92 38 Q -10 -120 88 -30" strokeWidth={1.2} strokeDasharray="3 5" />
  </svg>;
}
