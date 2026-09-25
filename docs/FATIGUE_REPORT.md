# Automatic fatigue report

**Report fatigue** in the app (`POST /api/fatigue-report`) turns what a pilot knows into a structured fatigue report for their operator's FRMS.

## Flow

1. **Event.** The pilot sets their home base, what happened (fatigue call before a duty, during a duty or after it), when it happened, and the days to include (up to 31).
2. **Duties.** Duties come pre-filled from the loaded roster, or the pilot enters them manually. They mark the duty that was affected and set each duty's status: operated, planned, not operated because of fatigue, or not operated for another reason.
3. **Sleep.** Estimated sleep from the roster analysis is pre-filled and marked *estimated*. The pilot corrects or confirms it and adds naps and bunk rest. Sleep has to be actual sleep, not time in bed.
4. **How you feel.** The pilot records KSS and Samn-Perelli ratings, ticks contributing factors, writes their own account, and can add their details (these are printed on the report only).
5. **Report.** The pilot gets the report on screen and can print or save it as PDF, download it as JSON, or copy it as plain text.

The backend is stateless and stores nothing. The pilot decides where the report goes.

## What the report contains

- **Headline and data confidence.**
  - High: at least two sleeps, with all sleep in the last 72 h reported by the pilot and no missing days.
  - Medium: some sleep is estimated, or some days have no sleep entered.
  - Low: no model prediction was possible.
- **Predicted KSS across the period**, computed from the sleep the pilot supplied (Ingre et al. 2014). It covers the affected duty: KSS at start, at peak, at the last landing, and for the 90th-percentile pilot.
- **Prior sleep/wake check** (Dawson & McCulloch 2005). Sleep in the prior 24 h must be at least 5 h, and in the prior 48 h at least 12 h. Hours awake at the end of the duty must not exceed the sleep obtained in the prior 48 h.
- **Cumulative restriction** over the preceding 7 days.
- **Roster findings**, each with a reference:
  - rest shorter than the ORO.FTL.235 minimum;
  - a late finish followed by an early start;
  - disruptive elements under ORO.FTL.105(8), all on home-base time: early start (05:00–05:59), very early start (02:00–04:59), late finish (23:00–01:59), and night duty touching 02:00–04:59;
  - three or more consecutive disruptive duties;
  - duty through the WOCL, long duties, four or more sectors (Powell et al. 2007), and time-zone transitions.
- **Pilot self-rating versus the model.** The pilot's assessment is never contradicted. When the pilot reports more sleepiness than predicted, the report explains what the model cannot see. When the model predicts more, it notes that people under sleep restriction tend to underestimate their own impairment.
- **Narrative.** Deterministic paragraphs that state only what the data supports. Missing items are called "not provided", never invented.
- **Limitations.**

## Honesty rules (tested in `tests/test_fatigue_report.py`)

- With fewer than two sleep periods there is no model output. Rule-based checks still run.
- Estimated sleep lowers confidence, and the report says so.
- Unknown airport codes are disclosed.
- When a pilot reports fatigue and the data shows no objective risk factor, the headline says the pilot's assessment stands.
