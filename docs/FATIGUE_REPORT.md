# Automatic fatigue report

**Report fatigue** in the app (`POST /api/fatigue-report`) turns what a pilot knows into a structured fatigue report for their operator's fatigue risk management (FRM). A fatigue report is a normal safety report within the operator's FRM (EASA ORO.FTL.120; crew duty to plan and use rest, ORO.FTL.115), handled under a just culture (Regulation (EU) 376/2014). Planning comes first; reporting is the safety net.

## Flow

1. **Event.** "What happened?" comes first: a concern about a planned roster, or fatigue before, during or after a duty. The home base is next (pre-filled from the roster or settings; three-letter IATA). Every time field stays locked until the base resolves, so no time is captured in an implicit zone. Each field is labelled with its zone ("DOH local, UTC+3") and echoes the other reference (Z, or local when entering in UTC). Times use a date plus a 24-hour HH:MM entry. The days included (up to 31) sit in a collapsed "Days included" line.
2. **Duties.** Duties are pre-filled as planned from the roster, or entered manually. Imported times are labelled "Scheduled" until the pilot confirms them. One action, "Operated as rostered", marks the planned duties that finished before the event as operated. Individual statuses stay editable.
3. **Sleep.** Roster sleep estimates are pre-filled and marked *estimated*. The location comes from the block's environment when the API supplies it. Otherwise it is inferred from where the pilot was: home at base, hotel on a layover. It is never silently "other". One action, "These times are what happened", confirms past estimates. Future sleep stays an estimate, and the page says so. The completeness confirmation is still required for sleep-dependent findings.
4. **Your account.** The pilot enters KSS and Samn-Perelli, with the rating time defaulting to the event time. They then add contributing factors and, for experienced events, the operational context (crew position, pilot flying or monitoring, phase of flight for fatigue during a duty, mitigations taken, effect on the operation). A free account and an optional suggested action follow. Name, staff number and fleet are pre-filled from the roster when available and stay editable. The review summary comes last.
5. **Report.** The pilot can copy a summary, copy the full text, download a PDF (the print dialog), download a text file or JSON, and copy or download each chart as PNG or SVG.

The backend is stateless and stores nothing. The pilot decides where the report goes.

### Future duties

"Report fatigue" on a duty that has not started opens as a **roster concern** anchored to the duty's report time, with a one-line explanation. If the pilot has already called fatigue for it, they choose "I called fatigue before a duty". The event time then moves to now, never into the future. Both the wizard and the API enforce these rules:

- Retrospective event types (`fatigue_call_before_duty`, `fatigue_during_duty`, `fatigue_after_duty`) must be at or before now (5-minute tolerance).
- A duty that has not started cannot be `operated`. It can be `cancelled_fatigue` only after a fatigue call.
- `fatigue_during_duty` needs the affected duty, with the event between its report and release. `phase_of_flight` applies only to this type.

### Validation

Problems are shown inline next to the field and echoed in the sticky action bar. Pressing Next or Generate scrolls to the first problem and focuses it. The action bar is opaque and full width. While the wizard is mounted the page reserves `scroll-padding-bottom`, so focused fields are never hidden behind the bar. A generation error is scrolled into view and focused.

## Report contents (1.3)

- **Header:** event in local time with the year, UTC offset and Z; period; labelled reporter fields (name, staff number, rank, fleet, operator, base, crew position); generation time; report id and version.
- **Key facts:** sleep in the 24/48/72 h before the event, time awake at the event with the last wake time, and the self-rating.
- **Figure 1, actogram (always shown, model-independent):** 72 h before the event to the end of the affected duty, one row per home-base calendar day (00–24). Sleep sits on the upper lane: reported sleep is solid and estimated sleep is hatched. Duties sit on the lower lane: operated duties are solid, planned duties dashed and dotted, and duties not operated cross-hatched. Flight sectors show as block-time bars, labelled with flight numbers and route. The WOCL (02:00–05:59) is shaded, and the event (▲) and self-rating (◆) are marked. Daily sleep and duty totals are listed on the right.
- **Figure 2, predicted KSS:** the average-pilot and 90th-percentile curves up to the assessed point, with the canonical band thresholds 5.5 / 6.5 / 7.5 / 8.5. Sleep and duty strips sit under the axis. The event line, the self-rating ◆ with the model value ○ at that time, and the labelled peak (the assessment's peak) are marked. Major ticks fall on local midnight, with 6-hour minor ticks. When the diary is not confirmed, a **provisional** curve (`provisional_timeline`) is drawn dashed and labelled. No finding or assessment is ever derived from it.
- Both charts are fixed-viewBox SVG. The screen copy follows the container width. A separate print copy is laid out for the A4 content width, so a report printed from a phone keeps full-width charts. Patterns carry every distinction, so the charts survive black-and-white printing. Each figure has a caption that states its key values in words.
- **Pilot statement, narrative, operational context, assessment and findings.** The headline level is the canonical band of the predicted peak KSS. `summary.highest_severity` carries the worst finding separately.
- **Optional reporter confirmation block** (name, date, signature), which can be toggled on screen.
- **Supporting detail (from page 2 in print):** duties (with flight numbers) and sleep, shown as tables from `sm` and in print and as stacked cards on phones. Then the FTL checks performed (coverage per rule from `easa_summary`), sleep screening with the 7-day shortfall, the scientific basis, and one de-duplicated list of data-quality notes and limitations.

Print uses A4 with a running footer ("Aerowake fatigue report · base · id", "Page x of y" where the browser supports `@page` margin boxes). The document title becomes the default PDF file name ("Fatigue report DOH 2026-09-29"). Everything outside the report is removed from layout, so no blank pages are printed.

## Severity and bands

- The predicted-peak finding follows the canonical bands, applied to the value rounded to one decimal: moderate → note, high (≥ 6.5) → caution, critical (≥ 7.5) → warning, extreme (≥ 8.5) → critical. The Ingre P(KSS ≥ 7) sentence remains as explanation.
- Estimated sleep alone never produces a critical finding. The multi-criteria prior sleep/wake check, extended wakefulness, cumulative restriction and the prediction finding are capped at warning when the sleep in the preceding 72 h is not all pilot-reported. Their text begins "Based on estimated sleep (not confirmed by the pilot)".
- Wording is neutral and operations-aligned. For example: "The recorded sleep and duty history includes factors consistent with the reported fatigue."

## Exports

- **Copy summary:** at most 1,200 characters, in a fixed order. It gives the event (local with year, offset and Z), the duty with flight numbers, the reporter and self-rating, sleep in 24/48/72 h with its basis, the last wake time and time awake, then contributing factors, mitigations, effect and suggested action. The statement is shortened to fit. The model estimate is labelled "not a measurement", and the report id closes the summary.
- **Copy full text / Text file:** every section appears once, keys are in title case, the generation time reads "30 Sep 2026 12:14Z", and "Record coverage" is used.
- **JSON:** the full report, including `watch_reference`. The personal KSS watch reference is a private roster setting. It is not shown in the wizard and never appears in the printed, copied or text outputs.

## API contract additions (report 1.3, additive)

Request (all optional): `crew_position` (`captain|first_officer|second_officer|other`), `pilot_role` (`pilot_flying|pilot_monitoring`), `phase_of_flight` (`pre_flight|taxi|takeoff_climb|cruise|descent_approach|landing|post_flight`), `mitigations[]` (`strategic_nap|controlled_rest|caffeine|informed_crew|informed_operator|removed_from_duty|none`), `effect_on_operation` (`none_noticed|reduced_performance|error_or_lapse|microsleep|duty_not_operated`), `suggested_action` (≤ 1,000 characters).

Response additions:

- `event.time_local_long`, `event.utc_offset`; `period.start_local_long`, `period.end_local_long`.
- `duties[].flights`, `duties[].flights_label` (e.g. `QR460/461`) and `duties[].sector_times[]`. Duty labels include flight numbers. A manual duty without sectors is named by its type.
- `sleep_summary`: 24/48/72 h totals, reported and estimated 72 h, last wake time, hours awake at the event, basis and diary flag. It is anchored to the event.
- `operational`: codes and labels, echoed in the narrative as "Operational context (pilot)".
- `summary.overall_level` is now the peak-KSS band (`low … extreme`, or `unknown` without a prediction). `summary.highest_severity` is added.
- `provisional_timeline`: present only when the diary is not confirmed.
- `self_assessment.rated_at_z`.

Existing fields are retained. Input provenance schema remains 2.

## Honesty rules (tested in `tests/test_fatigue_report.py` and `tests/test_fatigue_report_guards.py`)

- With fewer than two sleep periods there is no model output. Rule-based checks still run.
- Estimated sleep lowers record coverage, is labelled wherever it appears, and cannot on its own raise a finding to critical.
- Unknown airport codes are rejected rather than assigned invented time zones.
- When a pilot reports fatigue and the data shows no objective risk factor, the headline says the pilot's assessment stands.
- A report about fatigue that has occurred cannot be dated in the future, and a future duty cannot be marked operated.
- When the diary is confirmed, days without sleep read "No sleep recorded on … (the pilot confirmed the diary is complete)".

## Earlier contract notes (1.2)

`event_type=roster_concern` includes planned sector arrivals in the projected location and acclimatisation history. Retrospective reports use only operated sectors for the actual location history. Both modes can identify patterns in planned schedules. In a prospective scenario, sleep cannot overlap an active planned duty unless it is specified crew rest or home standby. Ratings describe actual past observations, and no future rating is inferred. The historical `objective_support` field means supporting non-self-rating findings, including estimates. It must not be read as an objective measurement or as proof of a report. Report predictions are recalculated from the selected sleep history, so they may differ from a full-roster forecast. Model calibration against real crew observations is a separate activity; see `MODEL_VALIDATION.md`.

The duty and sleep steps share a calendar daybook in the pilot's selected input zone. Overnight entries appear on both days. Calendar-day totals clip intervals at local midnight and use elapsed time across DST. Missing entries never mean confirmed zero sleep, and gaps between duties are not legal rest assessments.
