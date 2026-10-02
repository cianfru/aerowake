import { useEffect, useState, type ComponentType } from 'react';
import { CalendarDays, Compass, Globe2, Moon, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollReveal } from './ScrollReveal';
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
  { id: 'routes', label: 'Routes', icon: Globe2, blurb: 'Your network on a keyless map, each route coloured by its worst duty peak.', Preview: RoutesPreview },
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

  return <section id="tour" aria-labelledby="tour-title" className="landing-section overflow-hidden bg-[linear-gradient(180deg,#edf3f6,#e6eff4)]">
    <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
      <ScrollReveal className="max-w-2xl space-y-5">
        <p className="landing-eyebrow">Inside the workspace</p>
        <h2 id="tour-title" className="landing-h2">One roster, five views.</h2>
        <p className="text-base leading-7 text-[#425d73]">Upload once and move between the same duties from five angles. Every figure below comes from the model run on an illustrative roster.</p>
      </ScrollReveal>

      <ScrollReveal delay={60}>
        <Tabs value={view} onValueChange={setView} orientation={wide ? 'vertical' : 'horizontal'} className="mt-10 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
          <TabsList aria-label="Workspace views" className="-mx-6 flex h-auto snap-x justify-start gap-2 overflow-x-auto bg-transparent px-6 pb-1 text-[#425d73] [scrollbar-width:none] lg:mx-0 lg:flex-col lg:items-stretch lg:overflow-visible lg:px-0">
            {VIEWS.map(({ id, label, icon: Icon, blurb }) => <TabsTrigger key={id} value={id}
              className="group shrink-0 snap-start justify-start gap-2 whitespace-nowrap rounded-[4px] border border-[#c6dbe6] bg-[#fcfdfe]/70 px-4 py-2 text-sm font-medium text-[#304a5f] shadow-none ring-offset-transparent transition-colors hover:bg-[#fcfdfe] data-[state=active]:border-[#175779] data-[state=active]:bg-[#175779] data-[state=active]:text-[#f8fbfd] lg:whitespace-normal lg:rounded-none lg:border-0 lg:border-l-2 lg:border-[#c6dbe6] lg:bg-transparent lg:px-4 lg:py-3.5 lg:text-left lg:hover:bg-transparent lg:hover:text-[#142e45] lg:data-[state=active]:border-[#175779] lg:data-[state=active]:bg-transparent lg:data-[state=active]:text-[#142e45]">
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 lg:mt-0.5 lg:self-start lg:text-[#087478] lg:group-data-[state=active]:text-[#087478]" />
              <span className="lg:flex lg:flex-col lg:gap-1">
                <span>{label}</span>
                <span className="hidden text-xs font-normal leading-5 text-[#526579] lg:block">{blurb}</span>
              </span>
            </TabsTrigger>)}
          </TabsList>

          <div className="relative self-start">
            <div aria-hidden="true" className="absolute inset-x-6 -bottom-3 top-6 rounded-[1.75rem] border border-[#c9dbe4] bg-[#dfeaf0] lg:-right-4 lg:left-8" />
            <div className="landing-card relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2c566b] bg-[linear-gradient(110deg,#17384f_30%,#235669)] px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs text-[#b9d0db]">Your roster</p>
                  <p className="font-serif text-2xl leading-tight text-[#f4f8fa]">{TOUR_BASE.month}</p>
                  <p className="text-xs text-[#c9dde6]">{TOUR_TOTALS.duties} duties · {TOUR_TOTALS.sectors} sectors · {TOUR_BASE.code}</p>
                </div>
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#c9dde6]">Illustrative data</span>
              </div>
              {VIEWS.map(({ id, label, blurb, Preview }) => <TabsContent key={id} value={id} className="m-0 p-5 focus-visible:ring-inset sm:p-6">
                <p className="mb-4 text-sm text-[#425d73] lg:hidden"><span className="font-semibold text-[#142e45]">{label}.</span> {blurb}</p>
                <Preview />
              </TabsContent>)}
            </div>
          </div>
        </Tabs>
      </ScrollReveal>
    </div>
  </section>;
}
