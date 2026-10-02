import { ScrollReveal } from './ScrollReveal';

const STEPS = [
  { title: 'Start with your roster', body: 'Upload a PDF or CSV roster, or enter your duties by hand. Confirm the dates, airports and times before anything is analysed.' },
  { title: 'Add what actually happened', body: 'Confirm the sleep you got and how alert you felt. Estimates and missing history stay clearly labelled.' },
  { title: 'Keep a clear, factual record', body: 'Save, print or share a summary that fits your operator’s fatigue risk management process, when you choose to.' },
];

export function StepsSection() {
  return <section id="how-it-works" aria-labelledby="steps-title" className="landing-section bg-[#f8fbfd]">
    <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
      <ScrollReveal className="max-w-xl space-y-5">
        <p className="landing-eyebrow">How it works</p>
        <h2 id="steps-title" className="landing-h2">Three steps, all in your hands.</h2>
      </ScrollReveal>
      <ScrollReveal delay={60}>
        <ol className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          <span aria-hidden="true" className="absolute left-0 right-5 top-5 hidden h-px bg-[linear-gradient(90deg,#b6cfd6,#b6cfd6_60%,transparent)] md:block" />
          {STEPS.map((step, i) => <li key={step.title} className="relative space-y-4">
            <span className="relative inline-flex h-10 items-center bg-[#f8fbfd] pr-3 font-mono text-sm font-semibold text-[#176b74]">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="text-xl font-medium text-[#142e45]">{step.title}</h3>
            <p className="text-base leading-7 text-[#425d73]">{step.body}</p>
          </li>)}
        </ol>
      </ScrollReveal>
    </div>
  </section>;
}
