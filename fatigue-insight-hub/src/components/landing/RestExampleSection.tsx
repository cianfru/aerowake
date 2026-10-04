import { ScienceChart } from './ScienceChart';
import { SCIENCE_PEAKS, sciencePeakSummary } from './scienceData';
import { formatKssValue } from './landingKss';

export function RestExampleSection() {
  return <section id="how-it-works" className="aw-rest aw-section" aria-labelledby="rest-title">
    <div className="aw-container">
      <div className="aw-section-marker"><span className="aw-mono">01 / From roster to rest</span><span className="aw-mono">A worked example</span></div>
      <div className="aw-rest-grid">
        <div>
          <h2 id="rest-title" className="aw-heading">The same duty.<br /><em>A different way to prepare.</em></h2>
          <p className="aw-body">Report at 01:00. Release at 09:00. What changes if you get two hours of sleep in the afternoon before?</p>
          <div className="aw-rest-peaks" aria-label="Predicted peak sleepiness comparison">
            <div><p className="aw-small">Without a nap</p><p className="aw-rest-number">{formatKssValue(SCIENCE_PEAKS[0].kss)}<span>KSS</span></p></div>
            <span aria-hidden="true" className="aw-rest-arrow">→</span>
            <div><p className="aw-small">With a two-hour nap</p><p className="aw-rest-number aw-teal">{formatKssValue(SCIENCE_PEAKS[1].kss)}<span>KSS</span></p></div>
          </div>
          <p className="aw-small">A modelled comparison, not a guarantee. KSS runs from 1 (extremely alert) to 9 (very sleepy, fighting sleep).</p>
        </div>
        <figure className="aw-science-figure">
          <div className="aw-chart-heading"><h3>One overnight duty, two ways to prepare</h3><span className="aw-mono">Predicted KSS</span></div>
          <ScienceChart />
          <figcaption>{sciencePeakSummary()}<span>Home-base time. Usual sleep 23:00–07:00 on preceding nights. Lines pause during sleep and for the first hour after waking. WOCL marks the 02:00–05:59 body-clock low.</span></figcaption>
        </figure>
      </div>
      <ol className="aw-workflow">
        <li><span className="aw-mono">01</span><div><h3>Bring your roster.</h3><p>Upload a PDF or CSV, or enter duties. Review the times before analysis.</p></div></li>
        <li><span className="aw-mono">02</span><div><h3>Make room for rest.</h3><p>Look closer at demanding duties. Confirm the sleep you actually got.</p></div></li>
        <li><span className="aw-mono">03</span><div><h3>Record how it went.</h3><p>Keep a factual duty record to share through your operator’s FRM process.</p></div></li>
      </ol>
    </div>
  </section>;
}
