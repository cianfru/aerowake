import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const SECTIONS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#tour', label: 'The workspace' },
  { href: '#science', label: 'Science & privacy' },
];

export function LandingHeader({ onEnter }: { onEnter: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  return <header className="aw-header" onKeyDown={event => {
    if (event.key === 'Escape' && menuOpen) {
      setMenuOpen(false);
      menuButton.current?.focus();
    }
  }}>
    <nav aria-label="Main navigation" className="aw-container aw-nav">
      <a href="#top" aria-label="Aerowake home"><img src="/aerowake-wordmark.png" alt="" width={148} height={32} className="logo-themed aw-logo" /></a>
      <div className="aw-nav-links">{SECTIONS.map(section => <a key={section.href} href={section.href}>{section.label}</a>)}</div>
      <div className="aw-nav-actions">
        <Link to="/login" className="aw-sign-in">Sign in</Link>
        <button type="button" onClick={onEnter} className="aw-button aw-nav-cta">Analyse roster</button>
        <button ref={menuButton} type="button" className="aw-menu-toggle" aria-expanded={menuOpen} aria-controls="landing-mobile-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </nav>
    {menuOpen && <nav id="landing-mobile-navigation" aria-label="Mobile navigation" className="aw-mobile-nav">{SECTIONS.map(section => <a key={section.href} href={section.href} onClick={() => setMenuOpen(false)}>{section.label}</a>)}<Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link></nav>}
  </header>;
}
