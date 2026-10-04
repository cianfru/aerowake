import { ArrowDown, ArrowRight } from 'lucide-react';
import { HERO_COPY } from './landingData';
import { RosterExample } from './RosterExample';
import { HeroGlobe } from './HeroGlobe';

export function HeroSection({ onEnter }: { onEnter: () => void }) {
  return <section id="top" aria-labelledby="hero-title" className="aw-hero">
    <HeroGlobe />
    <div className="aw-container">
      <div className="aw-hero-topline">
        <span>Built by a line pilot. For line pilots.</span>
        <div className="aw-hero-tools"><span className="aw-mono">Roster / Rest / Reflection</span></div>
      </div>
      <div className="aw-hero-grid">
        <div className="aw-hero-copy">
          <p className="aw-eyebrow">A little clarity before report time</p>
          <h1 id="hero-title">{HERO_COPY.headline}</h1>
          <p className="aw-hero-description">{HERO_COPY.subline}</p>
          <div className="aw-hero-actions">
            <button type="button" onClick={onEnter} className="aw-button">Analyse my roster <ArrowRight aria-hidden="true" size={16} /></button>
            <a href="#tour" className="aw-text-link">Explore a sample roster <ArrowDown aria-hidden="true" size={15} /></a>
          </div>
          <p className="aw-small aw-hero-note">No account needed. Upload a roster or enter your duties.</p>
        </div>
        <RosterExample />
      </div>
      <div className="aw-hero-footnote">
        <p>For the early starts. The overnight returns.<br /><span>And the rest in between.</span></p>
        <p className="aw-small">Published sleep science.<br />Predictions to inform your planning; your judgement comes first.</p>
      </div>
    </div>
  </section>;
}
