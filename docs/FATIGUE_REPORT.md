# Automatic fatigue report

**Report fatigue** in the app (`POST /api/fatigue-report`) turns what a pilot knows into a structured fatigue report for their operator's FRMS.

## Flow

1. **Event.** The pilot sets their home base, the purpose (a prospective roster concern, or fatigue before, during or after a duty), when it happened, and the days to include (up to 31).
2. **Duties.** Duties come pre-filled as planned from the loaded roster, or the pilot enters them manually. Importing a roster never asserts that a duty was flown or cancelled. They mark the duty that was affected and set each duty's status: operated, planned, not operated because of fatigue, or not operated for another reason.
3. **Sleep.** Estimated sleep from the roster analysis is pre-filled and marked *estimated*. For a roster concern the pilot reviews a complete expected sleep scenario; for an experienced event they enter actual sleep, including naps and bunk rest. Only an explicit “Mark as actual sleep” action changes an estimate into a reported observation. Future sleep cannot be reported as actual. The completeness confirmation is required before sleep-dependent predictions appear.
4. **How you feel.** The pilot records KSS and Samn-Perelli ratings, ticks contributing factors, writes their own account, and can add their details (these are printed on the report only).
5. **Report.** The pilot gets the report on screen and can print or save it as PDF, download it as JSON, or copy it as plain text.

The backend is stateless and stores nothing. The pilot decides where the report goes.

## What the report contains

- **Headline and record coverage.** High/medium/low describe the supplied records, not scientific accuracy. Model availability requires two sleep episodes, a complete-history/scenario confirmation and an awake prediction at the assessed point. Estimated sleep in the preceding 72 hours yields medium coverage; unavailable prediction yields low coverage. Missing days remain visible for pilot review.
- **Predicted KSS across the period**, computed from the sleep the pilot supplied (Ingre et al. 2014). It covers the affected duty: KSS at start, at peak, at the last landing, and for the 90th-percentile pilot.
- **Prior sleep/wake check** (Dawson & McCulloch 2005). Screening references compare 5 h sleep in 24 h, 12 h in 48 h, and end-of-duty wakefulness against prior 48 h sleep. These are screening references, not regulatory or individual fitness limits.
- **Cumulative restriction** over the preceding 7 days.
- **EASA cumulative checks** on the duties entered (same code as roster analysis, `core/easa_checks.py`): ORO.FTL.210 duty and flight-time limits, ORO.FTL.235(d) recovery rest, FDP above the table maximum.
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
- Unknown airport codes are rejected rather than assigned invented time zones.
- When a pilot reports fatigue and the data shows no objective risk factor, the headline says the pilot's assessment stands.

## Pilot outlook and report contract (1.2)

The roster page compares chronological duty peaks, estimated prior sleep, maximum wakefulness, gaps between listed duties and the seven-day sleep-shortfall ledger. It uses the existing `aerowake-4.0-kss` results without additional biological multipliers. The personal KSS watch reference defaults to 6.5 and changes review prompts only; canonical model bands and legal checks remain unchanged. Recovery comparisons describe numerical differences between duties, not proof of complete recovery. Standby within a gap prevents that interval being presented as free recovery time.

`event_type=roster_concern` includes planned sector arrivals in the projected location/acclimatization history. Retrospective reports only use operated sectors for actual location history. Both modes can identify patterns in planned schedules. Sleep cannot overlap active planned duties in a prospective scenario except for appropriately specified crew rest or home standby. Ratings describe actual past observations; no future rating is inferred.

Report version `aerowake-fatigue-report-1.2` adds `watch_reference`, `scientific_basis` and `data_quality.prediction_basis`; request `watch_reference_kss` is optional and defaults to 6.5. Input provenance schema is 2. Existing fields are retained. The historical `objective_support` field means supporting non-self-rating findings, including estimates; it must not be interpreted as objective measurement or proof of a declaration.

The on-screen, print and copied-text outputs retain scientific references and the personal reference. Original roster records, scientific estimates and the pilot account are displayed separately. Report predictions are recalculated from the selected sleep history and may differ from a full-roster forecast. Model calibration against real crew observations remains a separate activity; see `MODEL_VALIDATION.md`.
