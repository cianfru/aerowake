import { useEffect, useState, type ComponentType } from 'react';
import { CalendarDays, Compass, Globe2, Moon, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TOUR_BASE, TOUR_TOTALS } from './tourData';
import { OutlookPreview } from './tour/OutlookPreview';
import { CalendarPreview } from './tour/CalendarPreview';
import { SleepPreview } from './tour/SleepPreview';
import { FtlPreview } from './tour/FtlPreview';
import { RoutesPreview } from './tour/RoutesPreview';

interface TourView {
  id: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
  Preview: ComponentType;
}

const VIEWS: TourView[] = [
  { id: 'outlook', label: 'Outlook', icon: Compass, blurb: 'The duties worth planning around, in date order, against your own watch level.', Preview: OutlookPreview },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, blurb: 'Duties, estimated sleep and the body-clock low on one home-base clock.', Preview: CalendarPreview },
  { id: 'recovery', label: 'Sleep & recovery', icon: Moon, blurb: 'Predicted sleepiness hour by hour, and the sleep behind it.', Preview: SleepPreview },
  { id: 'limits', label: 'FTL checks', icon: ShieldCheck, blurb: 'Rolling duty and block totals against EASA limits, scoped to what you supplied.', Preview: FtlPreview },
  { id: 'routes', label: 'Routes', icon: Globe2, blurb: 'Your network, each route coloured by its worst duty peak.', Preview: RoutesPreview },
];

function useWideLayout() {
  const query = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setWide(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return wide;
}

/** 'One roster, five views': each tab renders the workspace pattern with illustrative engine output. */
export function ProductTourSection() {
  const [view, setView] = useState(VIEWS[0].id);
  const wide = useWideLayout();

  return <section id="tour" aria-labelledby="tour-title" className="aw-tour aw-section">
    <div className="aw-container">
      <div className="aw-section-marker"><span className="aw-mono">02 / Inside the workspace</span><span className="aw-mono">One illustrative roster</span></div>
      <div className="aw-tour-intro">
        <h2 id="tour-title" className="aw-heading">Your month,<br /><em>from five useful angles.</em></h2>
        <p className="aw-body">The same duties, wherever you look. Explore the outlook, the sleep behind it, and the details worth bringing to your next report time.</p>
      </div>
      <Tabs value={view} onValueChange={setView} orientation={wide ? 'vertical' : 'horizontal'} className="aw-tour-grid">
        <TabsList aria-label="Workspace views" className="aw-tour-tabs">
          {VIEWS.map(({ id, label, icon: Icon, blurb }, index) => <TabsTrigger key={id} value={id} className="aw-tour-tab">
            <span className="aw-mono aw-tour-index">0{index + 1}</span>
            <span className="aw-tour-tab-copy"><span className="aw-tour-tab-label"><Icon aria-hidden="true" size={16} />{label}</span><span className="aw-tour-tab-blurb">{blurb}</span></span>
          </TabsTrigger>)}
        </TabsList>
        <div className="aw-tour-screen">
          <div className="aw-tour-screen-header">
            <div><p className="aw-mono">Your roster / {TOUR_BASE.code}</p><h3>{TOUR_BASE.month}</h3></div>
            <div><span className="aw-example-label">Illustrative data</span><p>{TOUR_TOTALS.duties} duties · {TOUR_TOTALS.sectors} sectors</p></div>
          </div>
          {VIEWS.map(({ id, label, blurb, Preview }) => <TabsContent key={id} value={id} className="aw-tour-panel">
            <p className="aw-tour-mobile-blurb"><strong>{label}.</strong> {blurb}</p>
            <Preview />
          </TabsContent>)}
        </div>
      </Tabs>
      <p className="aw-small aw-tour-caption">Every figure comes from a synthetic roster run through the current model. Estimates stay labelled until you confirm your actual sleep.</p>
    </div>
  </section>;
}
