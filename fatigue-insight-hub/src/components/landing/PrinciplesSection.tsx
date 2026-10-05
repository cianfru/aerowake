import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { SCIENCE_CITATIONS } from './scienceData';

export function PrinciplesSection() {
  const study = SCIENCE_CITATIONS[3];
  return <section className="aw-principles aw-section" aria-labelledby="principles-title">
    <div className="aw-container">
      <div className="aw-section-marker"><span className="aw-mono">03 / The foundations</span></div>
      <h2 id="principles-title" className="aw-heading">Useful science. Clear boundaries.</h2>
      <div className="aw-principles-grid">
        <article id="science"><span className="aw-mono aw-principle-number">I.</span><h3>Built on published science.</h3><p>The Three Process Model combines sleep pressure and body-clock rhythms. The model was tested on airline crew; Aerowake’s assembled software still needs independent operational validation.</p><p className="aw-evaluation">Independent scientific and FTL evaluation in progress.</p><Link to="/learn" className="aw-text-link">Methods & limitations <ArrowUpRight aria-hidden="true" size={15} /></Link></article>
        <article id="operations"><span className="aw-mono aw-principle-number">II.</span><h3>Your judgement comes first.</h3><p>Predictions describe a group-average pilot. Sleep, illness, caffeine and individual differences can change your experience. Scoped flight-time limitation checks (QCAA / EASA FTL) support review; your operator’s approved scheme and procedures take precedence.</p><p>Planning support, never a fitness-for-duty decision.</p><Link to="/report" className="aw-text-link">Log how a duty went <ArrowUpRight aria-hidden="true" size={15} /></Link></article>
        <article id="privacy"><span className="aw-mono aw-principle-number">III.</span><h3>Your roster stays yours.</h3><p>No account needed. Guest analyses are held in server memory for up to one hour, then discarded. With an account, you choose what to save or delete.</p><p>Nothing goes to your operator unless you send it.</p><Link to="/privacy" className="aw-text-link">Privacy & data <ArrowUpRight aria-hidden="true" size={15} /></Link></article>
      </div>
      <div className="aw-reference"><span className="aw-mono">Model reference</span><a href={study.href} target="_blank" rel="noreferrer">{study.text}</a></div>
    </div>
  </section>;
}
