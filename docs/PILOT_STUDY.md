# Pilot study v1

## Evidence and scope

The Pilot study page implements the observed-sleep **Ingre et al. (2014) model 5c**:
https://doi.org/10.1371/journal.pone.0108679. It uses the published brake sleep
recovery, exponential waking decline, 24-hour and 12-hour rhythms, and transfer
`KSS = 9.68 − 0.46 × (SB + C + U)`. Parameters and provenance are saved with
every observation. No workload multiplier or mapping from the dashboard index.

The paper validated its model in its own sample. AeroWake tests verify mathematical
implementation and data handling, **not operational validation**, BAM equivalence,
individual accuracy, or fitness to fly. The existing roster dashboard and report
retain the previously corrected experimental engine. This separate baseline
establishes actual-sleep accuracy before we introduce roster-inferred sleep.

`core/published_tpm.py` implements equations 1.1, 1.3–1.5, 1.7–1.9 and Table 1,
model 5c. Elapsed time is independent of timezone representation; circadian time
uses a fixed home UTC offset. Initialization assumes `S+C+U=8.38` at first sleep
onset, with at least two completed sleeps. Above the brake, sleep recovery
continues exponentially from the starting state. KSS is bounded to 1–9 for display
and evaluation; raw KSS is preserved. Bounding is an explicit presentation choice,
not a fitted coefficient. No jet-lag adaptation or personal chronotype calibration.

## Collection protocol

1. Recruit volunteers across early, daytime, late and night duties. A small first
   cohort tests feasibility; its size alone does not establish validity.
2. Open **Pilot study** before inspecting predictions. Enter actual sleep onset,
   wake times and all naps over at least the preceding 48 hours, in UTC. Planned
   rest and time in bed are not actual sleep. At least two sleeps are required.
3. Record KSS before duty, on a safe break when appropriate, and after duty;
   include off-duty observations. Never interrupt operational duties. Submit
   within 15 minutes of the rating time, not an assumed duty end time.
4. Record before this page reveals its prediction. Declare prior exposure to
   predictions elsewhere. This is not a fully blinded study.
5. Collect routinely, not just on difficult days. KSS measures sleepiness;
   physical exhaustion is a different outcome.
6. Pilots export their own JSON and choose whether to share it. Agree purpose,
   retention and access for shared files before recruitment.

Authenticated study records are owner-scoped and excluded from company dashboards.
No researcher or company export endpoint is provided. Exports omit name, email and
company but contain a stable pseudonym and sensitive dates/sleep histories:
they are **not anonymous**. Database administrators retain infrastructure access.
Deleting study records cannot delete shared exports or existing backups. The new
table uses the existing startup `Base.metadata.create_all`; old tables are unchanged.

## Evaluation

From `fatigue-tool`:

```sh
python scripts/evaluate_pilot_study.py /private/path/pilot1.json /private/path/pilot2.json
```

The script deduplicates exports and reports participant count, observations,
MAE, RMSE, signed bias and participant-balanced MAE in KSS units. Positive bias
means overprediction. A development-set mean KSS is the simple comparator.
A fixed hash assigns participants entirely to development (~80%) or holdout
(~20%). Small cohorts may lack either partition; missing results stay null.
Different model versions and observations with collection exclusions are counted
and excluded. User-controlled exports are not tamper-proof research records.

Primary comparison requires reported actual/complete sleep, home acclimatization,
no prior prediction exposure, timely submission and 1–16 hours since waking.
Other records are exploratory, including the first waking hour because sleep
inertia is omitted. Declarations cannot verify completeness or acclimatization.
Report selection bias and exclusions rather than silently discarding them.

Before formal validation, preregister recruitment, outcomes, model version,
acceptance criteria and the evaluation split. The script reports descriptive
errors, not confidence intervals or certification. Include participant-clustered
uncertainty and checks by time of day and high observed KSS in subsequent analysis.

Refine only on development pilots. Freeze each new version and evaluate on unseen
pilots; repeated tuning against the holdout makes it development data. First
establish actual-sleep baseline error, then test a small calibration, and only then
add roster-inferred sleep, jet lag or personalization. Keep previous snapshots.
