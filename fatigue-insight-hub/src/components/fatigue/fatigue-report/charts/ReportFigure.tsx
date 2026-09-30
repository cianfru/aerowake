import { useEffect, useId, useRef, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FatigueReport } from '@/lib/fatigue-report-api';
import { SCREEN_PALETTE, PRINT_PALETTE } from './chart-palette';
import { chartPngBlob, chartSvgMarkup, copyChartImage, downloadBlob, type ChartComponent } from './chart-export';

/** Width used for print: the A4 content width in CSS px, so text keeps its size on paper. */
export const PRINT_WIDTH = 700;

function useContainerWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(Math.min(960, Math.max(320, w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/**
 * A numbered report figure: a screen rendering sized to its container, a
 * separate fixed-width rendering for print (so a phone prints at full A4
 * width), a caption that states the key values in words, and image export.
 */
export function ReportFigure({ number, title, caption, chart: Chart, report, fileStem }: {
  number: number; title: string; caption: string; chart: ChartComponent; report: FatigueReport; fileStem: string;
}) {
  const id = useId().replace(/:/g, '');
  const { ref, width } = useContainerWidth<HTMLDivElement>(PRINT_WIDTH);
  const [status, setStatus] = useState('');

  const copy = async () => {
    const ok = await copyChartImage(Chart, report);
    setStatus(ok ? 'Chart image copied.' : 'This browser does not allow copying images. Download the PNG instead.');
    setTimeout(() => setStatus(''), 4000);
  };
  const png = async () => {
    try { downloadBlob(await chartPngBlob(Chart, report), `${fileStem}.png`); } catch { setStatus('The PNG could not be created. Try SVG.'); }
  };
  const svg = async () => downloadBlob(new Blob([await chartSvgMarkup(Chart, report)], { type: 'image/svg+xml' }), `${fileStem}.svg`);

  return (
    <figure className="report-figure report-chart space-y-2" aria-label={`Figure ${number}: ${title}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <h3 className="text-[13px] font-semibold">Figure {number}. {title}</h3>
        <div className="no-print flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={copy}>
            {status === 'Chart image copied.' ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}Copy image
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={png}><Download className="mr-1 h-3.5 w-3.5" />PNG</Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={svg}><Download className="mr-1 h-3.5 w-3.5" />SVG</Button>
        </div>
      </div>
      <div ref={ref} className="report-figure-screen w-full min-w-0 print:hidden">
        <Chart report={report} width={width} palette={SCREEN_PALETTE} idPrefix={`s${id}`} />
      </div>
      <div className="report-figure-print hidden print:block">
        <Chart report={report} width={PRINT_WIDTH} palette={PRINT_PALETTE} idPrefix={`p${id}`} />
      </div>
      <figcaption className="text-xs leading-5 text-muted-foreground">{caption}</figcaption>
      {status && <p role="status" className="no-print text-xs text-muted-foreground">{status}</p>}
    </figure>
  );
}
