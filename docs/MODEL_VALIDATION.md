# AeroWake model validity and reproducibility

## Status

Engine version: `aerowake-4.0-kss` (September 2026). Independent operational validation of AeroWake as assembled software has not been established. The scoring core is the open, peer-reviewed Three Process Model as validated on airline crew (Ingre et al. 2014, https://doi.org/10.1371/journal.pone.0108679); AeroWake's roster-based sleep inference, band policy and report rules are our own and still need prospective evaluation (see the pilot study). The index is not a measured percentage of cognitive ability, accident probability or alcohol-equivalent impairment.

## Why 3.x was replaced (audit, September 2026)

The 3.x index `20 + 80·[w_S(1−S) + w_C·C]` (plus workload, resilience, hypoxia, time-on-task and debt multipliers) compressed realistic operations into a narrow band. `C` never exceeded ≈0.8 and rested `S` never fell below 0.1, so a rested pilot could barely reach "low". Meanwhile, repeated short sleep hardly moved the score:

| Scenario (full `simulate_roster` path, LGW base) | 3.2 operational | 4.0 (predicted peak KSS) |
|---|---|---|
| Rested, report 09:00, 2 sectors | 70 — moderate | 4.3 — low |
| Single early, report 05:30, 4 sectors | 60 — high | 5.3 — low |
| 5th consecutive early (5.5 h sleep/night) | 57 — high (−2 vs day 1) | 6.1 — moderate (+0.9 KSS vs day 1) |
| Night duty, report 23:00, rested | 50 — high | 6.8 — high |
| DOH–SIN day return after 2.5-day layover | — | 7.1 — high (body clock +3.0 h of +5 h) |

The audit also found a sign error: an east-adapted body clock was read backwards (`home − shift` instead of `home + shift`).

## Scoring core (4.0)

* Homeostat with brake `S_B`, circadian `C` and ultradian `U`: model 5c, eq. 1.1, 1.3–1.5, 1.7–1.8. Parameters are those in `core/published_tpm.py`, shared with the pilot study.
* `KSS = 9.68 − 0.46·(S + C + U)`. Residual SD is 1.42 KSS; the between-pilot SD of the intercept is 0.84.
* `P(KSS > k) = logistic(−0.599·(S+C+U) − K_k + offset)` (eq. 1.17). The duty summary carries `P(KSS ≥ 7)`. The legacy `microsleep_probability` field now carries `P(KSS = 9)`, "fighting sleep".
* 90th-percentile pilot: KSS + 1.07 (eq. 1.16).
* Acclimatization, process A (eq. 1.10): each day the body clock closes 30% of the remaining gap to local time. This is the empirically optimal rate reported by Ingre et al.
* The 20–100 index is kept for API compatibility and is linear in KSS: `index = 110 − 10·KSS`.
* Bands sit at the midpoints between KSS verbal anchors: low < 5.5 ≤ moderate < 6.5 ≤ high < 7.5 ≤ critical < 8.5 ≤ extreme. On the index these are 55 / 45 / 35 / 25. The conservative preset shifts every band by 0.5 KSS.
* Sleep efficiency is the block's quality factor bounded to 0.6–1.0; bunk rest defaults to 0.70 (Signal et al. 2013).
* Removed from the score because this model family has not validated them: workload acceleration of `S`, the "resilience" boost, cabin hypoxia, time-on-task, and sleep inertia (the paper found the default inertia function worsened fit). The first hour after waking is therefore not modelled.
* Reported separately, never folded into KSS:
  * a 7-day rolling sleep deficit against 8 h/day. Subjective sleepiness plateaus under chronic restriction while performance keeps declining (Van Dongen 2003; Belenky 2003).
  * the Dawson & McCulloch (2005) prior sleep/wake check.

Known limitations: the model underpredicts somewhat at very long wake durations and heavy restriction (paper, Fig. 3). The default phase (16.8 h) was ~1.8 h later than the best fit in the paper's data. There is no chronotype input yet. Roster-inferred sleep adds error: residual SD 1.46 with generated sleep vs 1.42 with observed sleep.

## Accounting and traceability

Debt is updated before scoring, over report-to-report intervals (24 hours for the first report), with overlapping sleep intervals unioned. Prior in-flight rest is credited. The retained debt decay and repayment policy is heuristic and needs independent evaluation. Night-sleep quality affects S recovery; debt counts sleep-window duration and is labelled a ledger estimate.

Results carry engine version, parameter snapshot and risk thresholds. Archived results without these fields are legacy results; recalculate rather than assuming they use the current model. Persist and compare complete result snapshots, not only the final number.

Operating averages exclude bunk-rest samples. The underlying legacy timeline still uses a 100 sentinel during rest for compatibility; the report draws a gap and does not interpret it as alertness. Downstream integrations must check `is_in_rest`.

## Validation protocol before operational claims

1. Freeze a model version, scoring target, parameters, initial-state policy and input schema.
2. Reproduce published model experiments where the equations, input data and outcome definitions are available. A literature citation alone is insufficient.
3. Collect consented sleep diaries and time-stamped pilot sleepiness observations. Store observed and predicted values separately. Do not derive observations from predictions.
4. Validate sleep prediction separately from alertness prediction with prescribed sleep. Validate PVT predictions against measured PVT, not against sleepiness ratings alone.
5. Separate training and evaluation by pilot and roster. Report signed bias, absolute error, calibration and uncertainty by duty type, time of day, sleep history and crew-rest conditions.
6. Predefine tolerances and evaluate both ordinary-duty false alarms and missed high-fatigue episodes. Include nights, naps, time-zone transitions, recovery periods and augmented crews.
7. Publish the dataset provenance, exclusions, uncertainty, comparison method and limitations. BAM comparisons are optional additional evidence when authorized reference outputs become available.

Relevant foundation: Ingre et al. (2014), https://doi.org/10.1371/journal.pone.0108679. Its empirical validation does not transfer automatically to AeroWake's custom index.

## Regression checks

Backend: `python -m pytest tests -q` (engine anchors: `tests/test_alertness_engine.py`; report rules: `tests/test_fatigue_report.py`).
Frontend: `npm test` and `npm run build`.

Regression checks establish implementation consistency, not biological predictive validity. Existing crew-detection tests based on duration-only inference conflict with the current parser policy and remain a separate issue.
