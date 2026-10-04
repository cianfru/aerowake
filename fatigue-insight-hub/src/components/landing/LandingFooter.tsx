import { Link } from 'react-router-dom';
import { NON_AFFILIATION_NOTE } from './landingData';

export function LandingFooter() {
  return <footer className="aw-footer">
    <div className="aw-container">
      <div className="aw-footer-top"><a href="#top" aria-label="Aerowake home"><img src="/aerowake-wordmark.png" alt="" width={148} height={32} className="logo-themed aw-logo" /></a><p>Built by a line pilot, for line pilots.</p><nav aria-label="Footer"><Link to="/privacy">Privacy</Link><Link to="/learn">Methods</Link><a href="https://github.com/cianfru/aerowake/issues">Support</a></nav></div>
      <div className="aw-footer-bottom"><p>{NON_AFFILIATION_NOTE}</p><span className="aw-mono">© {new Date().getFullYear()} Aerowake</span></div>
    </div>
  </footer>;
}
