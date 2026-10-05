/**
 * The pilot's changes to the estimated sleep: remove, change times or add.
 *
 * The analysis stores the full list (backend core/sleep_edits.py); the app sends
 * the whole list each time. Pilot blocks are planned sleep the pilot stated,
 * never sleep they reported having had.
 */
import type { SleepEditPayload } from '@/lib/api-client';
import type { SleepEditItem } from '@/types/fatigue';

export interface EditableBlock {
  sleepStartUtc?: string;
  sleepEndUtc?: string;
  sleepType?: string;
  source?: 'estimated' | 'pilot';
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `edit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const same = (a?: string | null, b?: string | null) =>
  !!a && !!b && Date.parse(a) === Date.parse(b);

export function toPayload(edits: SleepEditItem[]): SleepEditPayload[] {
  return edits.map((e) => ({
    id: e.id,
    action: e.action,
    kind: e.kind ?? null,
    environment: e.environment ?? null,
    target_start_utc: e.targetStartUtc ?? null,
    target_end_utc: e.targetEndUtc ?? null,
    start_utc: e.startUtc ?? null,
    end_utc: e.endUtc ?? null,
  }));
}

/** The stored change that produced a pilot block (matched by its times). */
export function editForBlock(edits: SleepEditItem[], block: EditableBlock): SleepEditItem | undefined {
  if (block.source !== 'pilot') return undefined;
  return edits.find((e) => e.action !== 'remove' && same(e.startUtc, block.sleepStartUtc));
}

/** Remove a block: an estimated one gets a 'remove' change; a pilot one drops its change. */
export function removeBlock(edits: SleepEditItem[], block: EditableBlock): SleepEditItem[] {
  const own = editForBlock(edits, block);
  if (own) {
    // A replaced estimate goes away entirely; an added block simply disappears.
    if (own.action === 'replace') {
      return edits.map((e) => (e.id === own.id
        ? { ...e, action: 'remove' as const, startUtc: null, endUtc: null }
        : e));
    }
    return edits.filter((e) => e.id !== own.id);
  }
  return [...edits, {
    id: newId(),
    action: 'remove',
    kind: block.sleepType === 'nap' ? 'nap' : 'main',
    targetStartUtc: block.sleepStartUtc ?? null,
    targetEndUtc: block.sleepEndUtc ?? null,
    applied: true,
  }];
}

/** Change a block's times. An already-changed block keeps its original target. */
export function retimeBlock(edits: SleepEditItem[], block: EditableBlock, startUtc: string, endUtc: string): SleepEditItem[] {
  const own = editForBlock(edits, block);
  if (own) return edits.map((e) => (e.id === own.id ? { ...e, startUtc, endUtc } : e));
  return [...edits, {
    id: newId(),
    action: 'replace',
    kind: block.sleepType === 'nap' ? 'nap' : 'main',
    targetStartUtc: block.sleepStartUtc ?? null,
    targetEndUtc: block.sleepEndUtc ?? null,
    startUtc,
    endUtc,
    applied: true,
  }];
}

/** Put the model's estimate back for a block the pilot changed. */
export function restoreBlock(edits: SleepEditItem[], block: EditableBlock): SleepEditItem[] {
  const own = editForBlock(edits, block);
  return own ? edits.filter((e) => e.id !== own.id) : edits;
}

export function addBlock(edits: SleepEditItem[], kind: 'main' | 'nap', startUtc: string, endUtc: string): SleepEditItem[] {
  return [...edits, { id: newId(), action: 'add', kind, startUtc, endUtc, applied: true }];
}

/** Estimated blocks the pilot removed whose original time falls in [from, to). */
export function removedIn(edits: SleepEditItem[], from: string | undefined, to: string): SleepEditItem[] {
  const lo = from ? Date.parse(from) : -Infinity;
  const hi = Date.parse(to);
  return edits.filter((e) => e.action === 'remove' && e.applied && e.targetStartUtc
    && Date.parse(e.targetStartUtc) >= lo && Date.parse(e.targetStartUtc) < hi);
}

export function undoEdit(edits: SleepEditItem[], id: string): SleepEditItem[] {
  return edits.filter((e) => e.id !== id);
}
