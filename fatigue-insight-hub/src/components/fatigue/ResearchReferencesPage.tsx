import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Search, X } from 'lucide-react';
import {
  ALL_REFERENCES, CATEGORY_CONFIG, CATEGORY_ORDER, EVIDENCE_AUDIT_DATE,
  REFERENCE_STATS, SOURCE_TYPE_LABELS, matchesReference,
  type Reference, type ReferenceCategory, type SourceType,
} from '@/data/references';

function SourceCard({ reference: ref }: { reference: Reference }) {
  return <article id={`source-${ref.key}`} aria-labelledby={`title-${ref.key}`} className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
      <span className={ref.verification === 'unresolved' ? 'text-warning' : 'text-primary'}>{SOURCE_TYPE_LABELS[ref.sourceType]}</span><span>{ref.application}</span>
    </div>
    <h3 id={`title-${ref.key}`} className="mt-2 text-base font-semibold">{ref.short}</h3>
    <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{ref.full}</p>
    <div className="mt-4 space-y-2 text-sm leading-6">
      <p><span className="font-medium">Why it is here. </span>{ref.relevance}</p>
      <p className="text-muted-foreground"><span className="font-medium text-foreground">Scope. </span>{ref.limitation}</p>
    </div>
    {ref.url && <a href={ref.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 max-w-full items-center gap-2 text-sm font-medium text-primary underline underline-offset-4" aria-label={`Read source: ${ref.short} (opens in a new tab)`}>Read publication <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" /></a>}
    {ref.doi && <p className="break-all text-xs leading-5 text-muted-foreground">DOI: {ref.doi}</p>}
  </article>;
}

export function ResearchReferencesPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ReferenceCategory | 'all'>('all');
  const [kind, setKind] = useState<SourceType | 'all'>('all');
  const sourceKey = params.get('source') === 'roach_2025' ? 'rempe_2025' : params.get('source');
  const selected = ALL_REFERENCES.find(ref => ref.key === sourceKey);
  const filtered = useMemo(() => ALL_REFERENCES.filter(ref =>
    (!selected || ref.key === selected.key) &&
    (category === 'all' || ref.category === category) &&
    (kind === 'all' || ref.sourceType === kind) && matchesReference(ref, query),
  ), [selected, category, kind, query]);
  const identified = filtered.filter(ref => ref.verification === 'identified');
  const unresolved = filtered.filter(ref => ref.verification === 'unresolved');
  const clearSelected = () => { const next = new URLSearchParams(params); next.delete('source'); setParams(next, { replace: true }); };
  const clearFilters = () => { setQuery(''); setCategory('all'); setKind('all'); clearSelected(); };

  return <section className="mx-auto max-w-4xl space-y-6 py-4 sm:py-6" aria-labelledby="evidence-title">
    <header className="space-y-3">
      <p className="eyebrow">Research, methods and regulatory context</p>
      <h1 id="evidence-title" className="text-3xl font-semibold tracking-tight">The evidence library</h1>
      <p className="max-w-2xl text-base leading-7 text-muted-foreground">Explore the publications behind the model and the wider science. Each source explains its relevance and where the evidence stops.</p>
      <dl className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-4 sm:gap-6 sm:p-5">
        <div><dd className="text-2xl font-semibold tabular-nums">{REFERENCE_STATS.journal}</dd><dt className="text-xs leading-5 text-muted-foreground sm:text-sm">Identified journal articles</dt></div>
        <div><dd className="text-2xl font-semibold tabular-nums">{REFERENCE_STATS.guidance}</dd><dt className="text-xs leading-5 text-muted-foreground sm:text-sm">Reports & regulatory sources</dt></div>
        <div><dd className="text-2xl font-semibold tabular-nums">{REFERENCE_STATS.unresolved}</dd><dt className="text-xs leading-5 text-muted-foreground sm:text-sm">Legacy citations to resolve</dt></div>
      </dl>
      <p className="text-xs leading-5 text-muted-foreground">Bibliography reviewed {EVIDENCE_AUDIT_DATE}. {REFERENCE_STATS.total} catalogue entries, including unresolved records. These counts are not a measure of model validity. Publication metadata was checked; a full systematic evidence review and independent product validation remain outstanding.</p>
    </header>

    <div className="space-y-3">
      {selected && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/5 px-4 py-2 text-sm"><p>Source cited in context: <strong>{selected.short}</strong></p><button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center gap-2 font-medium text-primary">View all sources <X className="h-4 w-4" aria-hidden="true" /></button></div>}
      {sourceKey && !selected && <p role="status" className="rounded-xl bg-muted p-4 text-sm">This citation is not in the catalogue. Search the library by author or title.</p>}
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /><label htmlFor="evidence-search" className="sr-only">Search evidence</label><input id="evidence-search" type="search" value={query} onChange={event => { setQuery(event.target.value); if (selected) clearSelected(); }} placeholder="Search title, author, topic or DOI" className="min-h-11 w-full rounded-xl border border-input bg-background py-2 pl-10 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground">Topic<select value={category} onChange={event => { setCategory(event.target.value as ReferenceCategory | 'all'); if (selected) clearSelected(); }} className="block min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"><option value="all">All topics</option>{CATEGORY_ORDER.map(cat => <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>)}</select></label>
        <label className="space-y-1 text-xs text-muted-foreground">Source type<select value={kind} onChange={event => { setKind(event.target.value as SourceType | 'all'); if (selected) clearSelected(); }} className="block min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"><option value="all">All source types</option>{Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <p role="status" className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'source' : 'sources'} shown</p>
    </div>

    {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center"><BookOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" /><p>No sources match these filters.</p><button type="button" onClick={clearFilters} className="mt-2 min-h-11 text-primary underline underline-offset-4">Clear filters</button></div>}
    <div className="space-y-4">{identified.map(ref => <SourceCard key={ref.key} reference={ref} />)}</div>
    {unresolved.length > 0 && <details className="rounded-2xl border border-border p-4 sm:p-5" open={kind === 'unresolved' || Boolean(selected) || Boolean(query.trim())}><summary className="min-h-11 cursor-pointer text-sm font-medium">Unresolved legacy citations ({unresolved.length})</summary><p className="mb-4 text-sm leading-6 text-muted-foreground">These records appeared in earlier documentation, but the cited publication could not be established. They are retained for transparency and excluded from the identified evidence count. They must not support a quantitative claim.</p><div className="space-y-4">{unresolved.map(ref => <SourceCard key={ref.key} reference={ref} />)}</div></details>}
  </section>;
}
