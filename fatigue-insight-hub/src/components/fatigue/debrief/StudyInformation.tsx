import { STUDY_CONTACT, STUDY_CONTROLLER, STUDY_PURPOSE, STUDY_RETENTION, STUDY_SUPPORT_URL } from '@/lib/study-config';
import { cn } from '@/lib/utils';

/**
 * The study information sheet: shown before joining and on the Privacy page.
 * Governance values come only from src/lib/study-config.ts.
 */
export function StudyInformation({ className, headingLevel = 3 }: { className?: string; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const heading = headingLevel === 2 ? 'text-base font-semibold' : 'text-sm font-semibold';
  const contact = <a className="text-primary underline underline-offset-2" href={STUDY_SUPPORT_URL} target="_blank" rel="noreferrer">{STUDY_CONTACT}</a>;
  return (
    <div className={cn('space-y-4 text-sm leading-relaxed text-foreground', className)}>
      <section className="space-y-1">
        <H className={heading}>What it is</H>
        <p>The pilot study checks how well Aerowake's sleepiness forecasts match what pilots actually feel. Taking part is voluntary, and Aerowake works fully without it.</p>
      </section>
      <section className="space-y-1">
        <H className={heading}>Not a report to your operator</H>
        <p>Your entries are not a fatigue report and are not sent to your operator. They are not shared with any airline, employer or other company, and Aerowake is independent of your operator. If fatigue affected or may affect safety, report it through your operator's fatigue or safety reporting system. Aerowake's Report fatigue tool can help you prepare that report.</p>
      </section>
      <section className="space-y-1">
        <H className={heading}>Who is responsible</H>
        <p>The data controller is {STUDY_CONTROLLER}. For questions, or to exercise your data rights, use {contact}.</p>
      </section>
      <section className="space-y-1">
        <H className={heading}>Why</H>
        <p>Purpose: {STUDY_PURPOSE}. The data is not used to judge or monitor you.</p>
      </section>
      <section className="space-y-1">
        <H className={heading}>What is stored</H>
        <p>The duty dates, times and routes from the roster you analysed; your sleepiness ratings (Karolinska Sleepiness Scale and, if you choose, Samn-Perelli) and when you gave them; sleep you confirm; what you did to manage fatigue; an optional private note; and the model forecast for that duty. Sleep and sleepiness are health-related information, so they are collected only with your explicit consent.</p>
      </section>
      <section className="space-y-1">
        <H className={heading}>Your choices</H>
        <p>You can skip any optional question. You can export your entries, delete a single entry or all of them, and withdraw at any time from History or Account. When you withdraw you choose whether to delete what you have already given.</p>
      </section>
      <section className="space-y-1">
        <H className={heading}>Who can see it</H>
        <p>You. The database administrator and hosting provider can technically access stored data and must keep it confidential. Company dashboards and peer comparisons never include study data.</p>
      </section>
      <section className="space-y-1">
        <H className={heading}>How long it is kept</H>
        <p>Retention: {STUDY_RETENTION}. Deleting removes the live records straight away; backups expire on the hosting provider's schedule. Exports you have already shared cannot be recalled.</p>
      </section>
      <section className="space-y-1">
        <H className={heading}>Exports</H>
        <p>Study exports leave out your name, email, airline, flight numbers, routes and notes, and use a pseudonym. They still contain times, ratings and sleep histories, so they are pseudonymised, not anonymous. Share them only if you choose to.</p>
      </section>
      <section className="space-y-1">
        <H className={heading}>Safety first</H>
        <p>Never use Aerowake during critical phases of flight or against your operator's portable electronic device policy; rate top of descent from memory after the duty. Use controlled rest only as your operator's procedures permit. A debrief is not a fitness-for-duty assessment: your own judgement and your operator's procedures come first.</p>
      </section>
    </div>
  );
}
