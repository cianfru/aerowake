/**
 * A4 print stylesheet for the generated report. Everything outside the report
 * is removed from layout (not just hidden), so pages break cleanly and no
 * blank trailing pages appear. A running footer carries the report id and
 * "Page x of y" where the browser supports @page margin boxes.
 */
import type { FatigueReport } from '@/lib/fatigue-report-api';

const esc = (s: string) => s.replace(/["\\]/g, '');

export function reportPrintCss(r: FatigueReport): string {
  const id = esc((r.report_id ?? '').slice(0, 8));
  const title = esc(`Aerowake fatigue report${r.home_base ? ` · ${r.home_base}` : ''}${id ? ` · ${id}` : ''}`);
  return `
@media print {
  @page {
    size: A4; margin: 15mm 14mm 16mm;
    @bottom-left { content: "${title}"; font: 7.5pt system-ui, sans-serif; color: #555; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt system-ui, sans-serif; color: #555; }
  }
  html, body { background: #fff !important; }
  @supports selector(:has(a)) {
    body *:not(:has(#fatigue-report-print)):not(#fatigue-report-print):not(#fatigue-report-print *) { display: none !important; }
    body *:has(#fatigue-report-print) {
      display: block !important; position: static !important; margin: 0 !important; padding: 0 !important;
      max-width: none !important; width: auto !important; height: auto !important; min-height: 0 !important;
      overflow: visible !important; transform: none !important; background: none !important;
      border: 0 !important; box-shadow: none !important; backdrop-filter: none !important;
    }
  }
  @supports not selector(:has(a)) {
    body * { visibility: hidden !important; }
    #fatigue-report-print, #fatigue-report-print * { visibility: visible !important; }
    #fatigue-report-print { position: absolute; inset: 0 auto auto 0; }
  }
  #fatigue-report-print {
    width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important;
    font-size: 9.5pt; line-height: 1.4;
    --foreground: 215 30% 12%; --muted-foreground: 215 12% 32%; --border: 215 12% 72%; --card: 0 0% 100%;
    --background: 0 0% 100%; --primary: 207 60% 26%;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  #fatigue-report-print *:not([data-print-keep]) { color: #16202b !important; box-shadow: none !important; text-shadow: none !important; }
  #fatigue-report-print .text-muted-foreground:not([data-print-keep]) { color: #3f4854 !important; }
  #fatigue-report-print *:not([data-print-keep]):not(svg *) { background-color: transparent !important; border-color: #b9c0c8 !important; }
  #fatigue-report-print .no-print { display: none !important; }
  #fatigue-report-print > * + * { margin-top: 5mm !important; }
  #fatigue-report-print h1, #fatigue-report-print h2, #fatigue-report-print h3 { break-after: avoid; }
  #fatigue-report-print .report-appendix { break-before: page; }
  #fatigue-report-print figure, #fatigue-report-print li, #fatigue-report-print tr,
  #fatigue-report-print .report-keep { break-inside: avoid; }
  #fatigue-report-print table { width: 100%; font-size: 8.5pt; }
  #fatigue-report-print th { font-size: 7.5pt; white-space: nowrap; }
  #fatigue-report-print td { white-space: normal !important; overflow-wrap: anywhere; }
  #fatigue-report-print thead { display: table-header-group; }
  #fatigue-report-print .overflow-x-auto { overflow: visible !important; }
  #fatigue-report-print a { text-decoration: none; }
}`;
}

/** Default PDF file name via the document title, e.g. 'Fatigue report DOH 2026-09-29'. */
export function printTitle(r: FatigueReport): string {
  return `Fatigue report${r.home_base ? ` ${r.home_base}` : ''} ${r.event.time_utc.slice(0, 10)}`;
}
