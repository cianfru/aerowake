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
2. Join the study once (versioned enrolment, below). Open **Pilot study** and rate
   KSS first: the rating time is stamped when the rating is selected, not when the
   page opened. Then enter actual sleep onset, wake times and all naps over at
   least the preceding 48 hours in home-base local time (UTC is shown alongside).
   The client sends the IANA home zone; the server derives the UTC offset at the
   rating time. Planned rest and time in bed are not actual sleep. At least two
   sleeps are required. Version 1 clients that typed an offset remain accepted.
3. Record KSS before duty, on a safe break when appropriate, and after duty;
   include off-duty observations. Never interrupt operational duties or use a
   device against your operator's portable electronic device policy. Submit
   within 15 minutes of the rating time; the page warns before saving when the
   rating is older.
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
Deleting study records cannot delete shared exports or existing backups.

Study tables are created only by Alembic migrations run before the API starts
(`alembic upgrade head`, Railway `preDeployCommand`): `pilot_observations` in
`003`, `duty_debriefs` and the `users.study_*` enrolment columns in `004`. The API
refuses to start unless the database is at `db.session.EXPECTED_SCHEMA_REVISION`;
never add startup `create_all` or ad-hoc DDL. Rehearse fresh and `003 → 004`
upgrades as described in [launch hardening](LAUNCH_HARDENING.md).

## Enrolment, consent and data protection

Enrolment is one-time and versioned (`duty-debrief-v1`), stored on the account
(`study_enrolled_at`, `study_consent_version`, `study_withdrawn_at`). It covers
both the diary and duty debriefs; a changed consent text needs a new version and
re-enrolment. The information sheet shown before joining reads its governance
values from one place on each side (`fatigue-insight-hub/src/lib/study-config.ts`,
`fatigue-tool/study/config.py`). Current values, pending owner confirmation:

| Item | Value |
|------|-------|
| Data controller | the Aerowake project owner (a private individual) |
| Contact | the in-app Support link |
| Purpose | checking and calibrating the Aerowake sleepiness model only; results will not be published |
| Retention | until you withdraw, or 24 months after your last activity |

The sheet states that joining is voluntary; that the diary is not a fatigue report
to the operator and is not shared with any company; that sleep and sleepiness
are health-related data collected only with explicit consent; how to export,
delete single records or everything, and withdraw; and that pseudonymised
exports are not anonymous. Controlled rest is listed only "where your operator
permits it". A debrief is not a fitness-for-duty assessment. If results were ever
to be published, seek research ethics review and preregister first (see below).
Legal review of local data-protection rules (for example GDPR Art. 9 and the
pilot's home-country law) remains a launch gate.

Withdrawal (`DELETE /api/study/enrolment?delete_data=true|false`) records the
date and optionally deletes all debriefs and diary observations. Per-user limits:
30 study writes and 60 reads per minute, 100 new study rows per rolling 24 hours
and 3,000 stored debriefs.

## Duty debrief protocol v1

A debrief is one blinded rating of a **flown** duty (planned release in the past),
linked to the pilot's saved analysis. The flow is:

1. Operation: as rostered, times changed, or did not operate.
2. Moment: sleepiest point (default), top of descent on the last sector (last
   arrival − 30 min), or end of duty.
3. KSS (required unless not operated) and optionally Samn-Perelli. The forecast
   KSS and band are hidden until the rating is saved. The rating time is stamped
   when the pilot selects the rating.
4. Optional: countermeasures (nap, strategic sleep, caffeine, controlled rest where
   the operator permits it, in-flight rest, other, none), actual sleep in the 72 h
   before report (estimates must be explicitly confirmed before they are sent as
   reported), a short private note, and whether the pilot had seen the forecast.
5. After saving, the forecast is revealed and the pilot may answer "compared with
   this forecast the duty felt worse / about right / better" (the only editable field).

The server validates the duty against the saved analysis (owner authorisation
first), freezes a forecast snapshot (engine version, peak, landing and 90th
percentile KSS, band of the peak rounded to 0.1, flag at peak ≥ 6.5, the nearest
30-minute model sample to the rated moment, per-sector peaks when present,
estimated sleep including naps), and, with at least two confirmed sleeps and a
complete diary, the published model 5c prediction. It classifies recall delay
(rated time minus the moment, or release for the sleepiest point) as momentary
≤ 1 h, same day ≤ 12 h, recalled ≤ 48 h, or late. `roster_id` and `analysis_id`
become NULL when the roster is deleted; the snapshot remains. Account deletion
removes debriefs.

Every roster-linked debrief is exposed to the forecast (the pilot may have seen
the outlook), so debriefs never enter the `ingre2014-5c-v1` primary comparison.
Exports (`GET /api/debriefs/export`, `kind: duty_debriefs`) drop duty ids,
routes, flight numbers, free text and calendar dates (days are relative to the
first debrief) but remain pseudonymous, not anonymous.

## Evaluation

From `fatigue-tool`:

```sh
python scripts/evaluate_pilot_study.py /private/path/pilot1.json /private/path/pilot2.json
```

The script accepts diary and debrief exports in any mix and evaluates each kind
separately. For diary exports it deduplicates and reports participant count,
observations, MAE, RMSE, signed bias and participant-balanced MAE in KSS units. Positive bias
means overprediction. A development-set mean KSS is the simple comparator.
A fixed hash assigns participants entirely to development (~80%) or holdout
(~20%). Small cohorts may lack either partition; missing results stay null.
Different model versions are counted separately. Excluded observations are
counted **per reason** (a row may carry several), and the pre-registered
model-scope strata (more than 16 h since sleep; first waking hour) get their own
exploratory metrics instead of disappearing. User-controlled exports are not
tamper-proof research records.

For debrief exports it reports, per frozen engine version: error by recall
stream and moment (roster forecast peak vs the sleepiest-point rating; the model
sample at the moment vs top-of-descent/end-of-duty ratings); a development/holdout
split by participant; prediction exposure as a covariate; and, on rows with
confirmed sleep, roster forecast vs published model error on the same rows (the
gap estimates the error from roster-inferred sleep). Flag discrimination compares
flagged duties (peak ≥ 6.5) with the pilot's own sleepiest-point KSS ≥ 7:
sensitivity, specificity, PPV/NPV with participant-clustered bootstrap intervals,
mean observed KSS for flagged vs not flagged duties, the self-rated comparison
("felt worse/about right/better") by flag, and strata by duty period, WOCL,
more than 16 h awake, unmodelled countermeasures and prediction exposure.
Not-operated duties and missing forecasts are counted per reason.

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
