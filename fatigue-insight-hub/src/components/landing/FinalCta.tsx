import { ArrowRight } from 'lucide-react';

export function FinalCta({ onEnter }: { onEnter: () => void }) {
  return <section className="aw-final" aria-labelledby="final-cta-title">
    <div className="aw-container aw-final-grid">
      <div><p className="aw-eyebrow">Your next roster is a good place to start.</p><h2 id="final-cta-title" className="aw-heading">A clearer picture.<br /><em>Before you fly.</em></h2></div>
      <div><button type="button" onClick={onEnter} className="aw-button aw-button-light">Analyse a roster <ArrowRight size={16} aria-hidden="true" /></button><p>No account needed.<br />PDF, CSV or duties entered by hand.</p></div>
    </div>
  </section>;
}
