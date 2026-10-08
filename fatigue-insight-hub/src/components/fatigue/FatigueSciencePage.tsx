import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, Globe2, Moon, Sunrise } from 'lucide-react';
import { evidenceHref, getReferenceByKey } from '@/data/references';

const PATTERNS = [
  {
    id: 'early', label: 'Early reports', icon: Sunrise,
    title: 'An early alarm can shorten the night before.',
    explanation: 'Bringing bedtime forward does not guarantee that sleep starts earlier. The evening wake-maintenance zone can make an early bedtime difficult, even when the next report is early.',
    check: 'Review the estimated bedtime, wake time and commute allowance. A long rest interval can still leave a short sleep opportunity.',
    refs: ['roach_2012', 'dijk_czeisler_1994'],
  },
  {
    id: 'night', label: 'Night duties', icon: Moon,
    title: 'Time awake and body-clock timing meet overnight.',
    explanation: 'Sleep pressure rises while you are awake. When a duty also reaches the biological night, the circadian contribution can increase predicted sleepiness. A pre-duty nap changes the prediction only if the model includes that sleep.',
    check: 'Check the body-clock window, the time of peak KSS and any assumed nap. Set your usual nap habit and remove sleep you do not expect to obtain.',
    refs: ['akerstedt_2014', 'signal_2014', 'dinges_1987'],
  },
  {
    id: 'timezone', label: 'Time-zone changes', icon: Globe2,
    title: 'The destination clock and your body clock can disagree.',
    explanation: 'The model moves body-clock phase gradually towards local time. It does not measure your circadian phase or know your light exposure. Layover timing also changes when sleep is feasible.',
    check: 'Compare local, home-base and body-clock time. Confirm sleep at the destination, particularly before an early return departure.',
    refs: ['akerstedt_2014', 'rempe_2025'],
  },
  {
    id: 'recovery', label: 'Repeated short sleep', icon: Clock3,
    title: 'Feeling less sleepy does not prove full recovery.',
    explanation: 'Studies of repeated sleep restriction show that subjective sleepiness and measured performance can diverge. Aerowake therefore displays sleep deficit separately from the predicted sleepiness score.',
    check: 'Look across the sequence of duties and recovery days. Check missing sleep history before interpreting the deficit ledger.',
    refs: ['van_dongen_2003', 'belenky_2003', 'banks_2010'],
  },
] as const;

export function FatigueSciencePage() {
  const [selected, setSelected] = useState<(typeof PATTERNS)[number]['id']>('early');
  const pattern = PATTERNS.find(item => item.id === selected)!;

  return (
    <article className="mx-auto max-w-4xl space-y-8 py-4 text-sm leading-7 sm:py-6">
      <header className="max-w-2xl space-y-3">
        <p className="eyebrow">Read the pattern behind the prediction</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your roster, through the lens of sleep.</h1>
        <p className="text-base text-muted-foreground">Start with when you can sleep, then consider when your body expects to be awake. Those two patterns explain much of a roster’s predicted sleepiness.</p>
      </header>

      <section aria-labelledby="prediction-inputs" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 id="prediction-inputs" className="text-lg font-semibold">How a roster becomes a forecast</h2>
        <ol className="mt-5 grid gap-5 sm:grid-cols-3">
          {[
            ['01', 'Sleep opportunities', 'The schedule, your usual night and nap habit, and selected crew rest create an editable sleep plan.'],
            ['02', 'Sleep pressure + body clock', 'Sleep and wake change the homeostatic process. Circadian and 12-hour rhythms change its timing.'],
            ['03', 'Predicted sleepiness', 'The Three Process Model estimates KSS on a 1–9 scale. A duty’s headline shows its peak within the assessed window.'],
          ].map(([step, title, body]) => <li key={step} className="space-y-2">
            <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-mono text-primary">{step}</span>
            <h3 className="font-semibold">{title}</h3><p className="text-muted-foreground">{body}</p>
          </li>)}
        </ol>
        <Link className="mt-5 inline-flex min-h-11 items-center gap-2 font-medium text-primary underline underline-offset-4" to={evidenceHref('akerstedt_2014')}>Read the model’s source study <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </section>

      <section aria-labelledby="roster-patterns" className="space-y-4">
        <div><h2 id="roster-patterns" className="text-xl font-semibold">Four patterns worth looking for</h2><p className="text-muted-foreground">Choose a pattern to see the mechanism and what to check in your roster.</p></div>
        <div role="group" aria-label="Roster patterns" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PATTERNS.map(item => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === item.id ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}><item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />{item.label}</button>)}
        </div>
        <div aria-live="polite" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="text-lg font-semibold leading-snug">{pattern.title}</h3>
          <p className="mt-3 text-muted-foreground">{pattern.explanation}</p>
          <p className="mt-4 border-l-2 border-primary/40 pl-4"><strong className="block font-medium">In your roster</strong>{pattern.check}</p>
          <ul aria-label="Evidence for this pattern" className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {pattern.refs.map(key => <li key={key}><Link className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" to={evidenceHref(key)}>{getReferenceByKey(key)?.short}</Link></li>)}
          </ul>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border p-5"><h2 className="text-lg font-semibold">The sleep plan needs your input</h2><p className="text-muted-foreground">A roster cannot observe sleep. Estimated blocks include assumptions about timing, environment and rest facilities. Their quality factors and confidence labels are modelling choices; they are not measured sleep efficiency or validated probabilities for you.</p><p className="text-muted-foreground">Open a sleep block to see its reason and sources. Retiming, adding or removing a block changes the planned sleep. Only explicit confirmation in a diary makes it reported sleep.</p></div>
        <div className="space-y-3 rounded-2xl border border-border p-5"><h2 className="text-lg font-semibold">Know what the score leaves out</h2><p className="text-muted-foreground">Workload, cabin hypoxia and sleep inertia are not added to the current KSS score. It does not model the transient impairment immediately after waking. Allow for that limitation when considering a rest period.</p><p className="text-muted-foreground">The forecast is a group-average estimate. Your actual sleep, health and experience can differ. A low predicted score does not establish fitness for duty.</p></div>
      </section>
      <p className="rounded-xl bg-muted/40 p-4 text-muted-foreground">Published research supports the underlying mechanisms. Aerowake’s complete roster forecast, inferred sleep and band policy still require independent evaluation. <Link className="text-primary underline underline-offset-4" to="/learn?section=model">Read the methods and limitations</Link>.</p>
    </article>
  );
}
