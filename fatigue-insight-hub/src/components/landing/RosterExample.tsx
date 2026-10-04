import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { TOUR_BASE, TOUR_DUTIES } from './tourData';
import { formatDay, formatRoute } from './landingFormat';
import { formatKssValue } from './landingKss';
import { BandTag } from './BandTag';
import { KssScale } from './KssScale';

const TRIP_DATES = ['2026-10-03', '2026-10-05', '2026-10-07'];
const DUTIES = TOUR_DUTIES.filter(duty => TRIP_DATES.includes(duty.date));
const DETAILS = [
  { title: 'A daytime departure.', body: 'This duty stays outside the 02:00–05:59 home-base low. Its predicted peak is lower than the two duties that follow.' },
  { title: 'An overnight return.', body: `${DUTIES[1].reason}.` },
  { title: 'An early start after the return.', body: `${DUTIES[2].reason}.` },
];

/** Uses the same engine-generated synthetic duties as the full product tour. */
export function RosterExample() {
  const [selected, setSelected] = useState(2);
  const duty = DUTIES[selected];
  return <figure id="sample-duties" className="aw-roster" aria-label="Interactive illustrative roster">
    <div className="aw-roster-heading">
      <div><p className="aw-mono">Your roster at a glance</p><h2>Three duties. One body clock.</h2></div>
      <span className="aw-example-label">Illustrative data</span>
    </div>
    <div className="aw-roster-meta"><span>October 2026</span><span className="aw-mono">{TOUR_BASE.code} / {TOUR_BASE.offset}</span></div>
    <div className="aw-roster-columns aw-mono" aria-hidden="true"><span>Duty / home-base time</span><span>Peak sleepiness</span></div>
    <ul className="aw-duty-list">
      {DUTIES.map((item, index) => <li key={item.date}>
        <button type="button" className="aw-duty" aria-pressed={selected === index} aria-controls="roster-duty-detail" onClick={() => setSelected(index)}>
          <div className="aw-duty-route"><span className="aw-mono aw-duty-date">{formatDay(item.date)}</span><span className="aw-route-name">{formatRoute(item.route)}</span><span className="aw-mono aw-duty-time"><time>{item.report}</time>–<time>{item.release}</time>{item.release < item.report && <span> +1 day</span>}</span></div>
          <div className="aw-duty-score"><span className="aw-peak"><span className="sr-only">Peak </span>{formatKssValue(item.peakKss)}<span className="aw-mono">KSS</span></span><BandTag kss={item.peakKss} /></div>
          <ArrowUpRight aria-hidden="true" size={15} className="aw-duty-arrow" />
        </button>
      </li>)}
    </ul>
    <div id="roster-duty-detail" className="aw-duty-detail" aria-live="polite" aria-atomic="true">
      <p className="aw-eyebrow">A closer look / {formatDay(duty.date)}</p>
      <h3>{DETAILS[selected].title}</h3>
      <p>{DETAILS[selected].body}</p>
      <KssScale kss={duty.peakKss} className="aw-roster-scale" />
      <div className="aw-scale-labels aw-mono"><span>1 / Alert</span><span>9 / Fighting sleep</span></div>
    </div>
    <figcaption>Choose a duty to look closer. Times in home-base time, DOH (UTC+3). Synthetic roster; group-average predictions.</figcaption>
  </figure>;
}
