# AeroWake model validity and reproducibility

## Status

Engine version: `aerowake-3.2-stateful`. Independent operational validation and BAM agreement have not been established. Citations support model concepts, not the assembled software's predictive accuracy. The 20–100 alertness index is not a measured percentage of cognitive ability, accident probability, or alcohol-equivalent impairment.

## Reproducible research core

The research preset disables workload scaling, resilience boosts, second harmonic, sleep inertia, time-on-task, debt-score and hypoxia adjustments. Its core uses configured exponential sleep-pressure buildup and recovery and a single circadian harmonic. The output transformation and risk thresholds remain experimental. This is not a claimed replication of BAM or the published Three Process Model's fitted sleepiness scale.

Wake: S(t+h) = Smax − (Smax − S(t)) exp(−h/tau_i).
Sleep: S(t+h) = Smin + (S(t) − Smin) exp(−h*q/tau_d).

q is an estimated sleep-quality multiplier, not a measured biological parameter. On the first duty, initial pressure is anchored to the earliest included sleep start (or eight hours before report if no sleep exists). Later duties inherit pressure and its timestamp at prior release. Every intervening sleep block, including naps, updates that state. Initial conditions require sensitivity analysis; they are not evidence that a user was rested.

The operational preset remains an experimental alternative with aviation adjustments. Changing its settings changes the model, not merely presentation. Circadian amplitude and phase now use the configured values without hidden offsets.

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

Backend: `python -m pytest tests/test_model_integrity.py tests/test_sleep_regressions.py -q`.
Frontend: `npm test` and `npm run build`.

Regression checks establish implementation consistency, not biological predictive validity. Existing crew-detection tests based on duration-only inference conflict with the current parser policy and remain a separate issue.
