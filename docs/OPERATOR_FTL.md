# Configured operator FTL scheme — provenance and limits

Aerowake compares supplied rosters with a configured FTL scheme. The repository
contains an owner-supplied transcription of a private Operations Manual Part A,
Chapter 7, alongside public EASA comparison references. **A roster upload does
not verify the operator, current manual revision, jurisdiction or approval.**
Do not treat public EASA citations as proof that the private rules apply to every
pilot, or that an operator approval is current.

The manual was supplied by the owner in October 2026 and is not stored in this
repository. Its currency and the applicability of FRM, reduced-rest and ULR
approvals have not been independently established. No regulatory values were
changed during the product audit. Tests pin the transcription, not legal validity.

**Presentation contract.** Pilot-facing text cites the QCAA / EASA flight time
limitations only (ORO.FTL / CS FTL); operator OM-A paragraph and table numbers stay
in code comments and this note, never in the UI or API reference strings. Values
are unchanged: Table 7-6 → ORO.FTL.205(b) Table 2, Table 7-7 → Table 4 (FRM, same
values), Table 7-8 → CS FTL.1.205(a), Tables 7-9/7-10 → CS FTL.1.205(c), rest
7.13.4 → CS FTL.1.235(a), 7.13.5 → CS FTL.1.235(b), 7.13.6 → ORO.FTL.235(c), 7.13.7 →
ORO.FTL.235(d), standby 7.11.3 → CS FTL.1.225. The only operator-specific items
shown are the ULR city pairs with their rest plans and augmented-crew handling,
labelled "operator approval, not verified". Unknown-state FRM limits and ULR
limits say that approval is not verified; the roster FTL view always exposes that
scope, and no operator brand or inferred airline is treated as approval.

Public source: [EASA Easy Access Rules for Air Operations, Regulation (EU)
965/2012](https://www.easa.europa.eu/en/document-library/easy-access-rules/easy-access-rules-air-operations-regulation-eu-no-9652012).
The competent authority and the operator’s current approved scheme take precedence.

## Encoded operator rules

| Rule | Value in code | Where |
|---|---|---|
| 7.18 ULR definition | FDP > 18 h | `core/extended_operations.py` `ULRParameters` |
| 7.18 maximum planned ULR FDP | 20 h; commander's discretion up to 3 h, > 2 h reported to the competent authority under this scheme | same |
| 7.18 ULR crew | 4 pilots (2 captains + 2 first officers) | same |
| 7.18.9 in-flight rest | at least 2 rest periods, one of at least 4 h | same; `ULRRestPlanner` |
| 7.18 pre-ULR rest | 48 h duty-free including 2 local nights | same |
| 7.18 post-ULR rest | 4 local nights at base; away: 48 h including 2 local nights | same |
| 7.18 monthly limit | at most 2 ULR duties per calendar month | same |
| 7.18.3 ULR city pairs | AKL always ULR; DFW and MIA ULR "depending on the season", i.e. only when the scheduled FDP > 18 h (7.18.1) | `ULRParameters`, `crew_inference._is_ulr` |
| 7.6.1 Table 7-1 acclimatisation | B/X/D by time-zone difference and elapsed time; rows > 2 & < 4, ≥ 4 & ≤ 6, > 6 & ≤ 9, > 9 & ≤ 12 (exactly 4 h is the second row) | `AcclimatizationCalculator`; used by `compliance.determine_acclimatisation` |
| 7.18.4.3 pre-ULR | 48 h free of duty **including 2 local nights**, checked before departures from base | `ULRComplianceValidator` |
| 7.18.4.3 post-ULR | at base: **4 consecutive local nights**; away: 48 h including 2 local nights (arrival time zone) | same |
| 7.18.11 rest patterns | Figures 7-3 to 7-8, per crew (table below), scaled to the scheduled block | `configured city-pair patterns`, `ULRRestPlanner.approved_pattern` |
| 7.18.6 / 7.18.7 | discretion: FDP + up to 3 h (> 2 h reported to the competent authority under this scheme); reduced rest away ≥ 24 h incl. 1 local night | params (reduced rest not yet checked) |
| 7.6.3 Table 7-6 maximum daily FDP, acclimatised | by start at reference time and sectors (same rows as ORO.FTL.205(b) Table 2) | `core/qatar_ftl.py` `basic_max_fdp`; `compliance.calculate_fdp_limits` |
| 7.6.3 Table 7-7 unknown state of acclimatisation (approved FRM) | 12:00 for 1–2 sectors, −0:30 per sector, 9:00 at 8 | same |
| 7.6.5 Table 7-8 planned extension without in-flight rest | by start time and 1–5 sectors; not allowed 19:00–06:14; at most twice in 7 days; +2 h pre/post rest or +4 h post | `extension_max_fdp`; `easa_checks` (`fdp_max` info, `fdp_extension`) |
| 7.6.6 Tables 7-9 / 7-10 in-flight rest | 3 pilots 16/15/14 h, 4 pilots 17/16/15 h (class 1/2/3); +1 h with ≤ 2 sectors and one > 9 h; ≤ 3 sectors | `AugmentedFDPParameters` |
| 7.6.6(3) rest after an in-flight-rest FDP | ≥ preceding duty, or 14 h | `core/qatar_rest.py` |
| 7.7.1.2 commander's discretion | +2 h, +3 h augmented, from the basic maximum; rest never below 10 h | `qatar_ftl.DISCRETION_HOURS`, `AugmentedFDPParameters` |
| 7.8.1 cumulative | 60/110/190 duty h in 7/14/28 days; 100 h flight time in 28 days | `easa_checks` |
| 7.11.3 home standby | at most 16 h; 25 % counts as duty | `qatar_rest`, `easa_checks` |
| 7.13.1 / 7.13.2 minimum rest | ≥ preceding duty, or 12 h at base / 10 h away | `easa_checks` (`min_rest`) |
| 7.13.4 disruptive schedules | early start 05:00–05:59, late finish 23:00–01:59, night 02:00–04:59; late/night → early start at base needs 1 local night; ≥ 4 disruptive → next recovery rest 60 h | `compliance.is_disruptive_duty`, `qatar_rest` |
| 7.13.5 time zones | Table 7-12 local nights at base after a rotation with ≥ 4 h difference; 14 h away after a ≥ 4 h FDP; 3 local nights between east-west rotations | `qatar_rest.table_7_12` |
| 7.13.6 reduced rest | never below 12 h / 10 h; noted between that floor and the preceding duty | `qatar_rest` (`reduced_rest`) |
| 7.13.7 recovery rest | 36 h incl. 2 local nights, ≤ 168 h apart; 2 local days twice a month | `easa_checks`, `qatar_rest` |
| Compliance check | `ULRComplianceValidator` → `ulr_compliance` on each ULR duty | API `DutyResponse.ulr_compliance` |

Source: OM-A Chapter 7 (full chapter supplied by the owner, October 2026; the manual itself is
not stored in the repository). Tables are pinned cell by cell in `tests/test_qatar_ftl.py`.

### Approved ULR rest patterns (7.18.11), hours from off-blocks

| Sector | Block | Crew A rest | Crew B rest |
|---|---|---|---|
| DOH–AKL (Fig 7-3) | 16:10 | 3:30–8:00, 12:30–15:30 (7:30) | 0:30–3:30, 8:00–12:30 (7:30) |
| AKL–DOH (Fig 7-4) | 17:30 | 0:30–4:00, 8:40–13:20 (8:10) | 4:00–8:40, 13:20–16:50 (8:10) |
| DOH–DFW (Fig 7-5) | 16:25 | 4:20–8:20, 12:10–15:55 (7:45) | 0:20–4:20, 8:20–12:10 (7:50) |
| DFW–DOH (Fig 7-6) | 14:20 | 0:20–3:20, 7:20–11:20 (7:00) | 3:20–7:20, 11:20–13:50 (6:30) |
| DOH–MIA (Fig 7-7) | 15:40 | 3:50–11:10 (7:20) | 0:20–3:50, 11:10–15:10 (7:30) |
| MIA–DOH (Fig 7-8) | 14:20 | 0:20–3:30, 9:50–13:50 (7:10) | 3:30–9:50 (6:20) |

Read from the labelled durations laid end to end; every sector adds up exactly to the
figure's block time and per-crew rest totals. Notes for the owner: in Figure 7-4 (AKL–DOH)
the two middle blocks carry crew labels that look copy-pasted ("Crew B Operates" printed in
Crew A's column); the bar positions and totals were used. DOH–MIA Crew A and MIA–DOH Crew B
have a single rest period, so the 7.18.4.3 "at least 2 periods, one ≥ 4 h" rule is checked on
the plan (both crews), not per pilot. Routes without an approved pattern use the generic
rotation (no rest in the first/last 90 min).

## Augmented crew (3 or 4 pilots) — how it works

- **Detection.** `IR` = **In-flight Rest** (CrewLink activity code on a sector, confirmed by
  the owner): on that sector the pilot is the augmenting crew taking in-flight rest rather
  than the crew operating the departure. Operator OM-A 7.18.9.3: Crew A operates the outbound from base, Crew B the
  return, and a pilot is in one crew for the whole pairing. So IR on the sector departing
  base → Crew B on both legs; IR on the sector arriving at base → Crew A on both legs
  (`parsers/roster_parser.py::auto_detect_crew_augmentation`). Both crews rest in flight on
  both sectors; the crew set selects the approved pattern. Until October 2026 the code
  assigned the crew per sector (IR leg = B, other leg = A), which put one leg of every
  pairing on the wrong rest pattern.
- **Crew size from the FDP** (`core/crew_inference.py`). IR is treated as IR
  whatever the pilot's rank (owner, October 2026). A duty without IR is not known to be
  augmented, so its crew is an estimate the pilot can change (`crew_source` 'fdp', shown as
  "estimated"). For every long-haul duty (a sector ≥ 7 h block) whose crew the pilot has not set: FDP > 18 h or AKL → 4 pilots, ULR (DFW/MIA only when FDP > 18 h);
  FDP above the 2-pilot planned maximum (7.6.5 Table 7-8 where an extension is allowed at that
  start time, else Table 7-6/7-7) → the smallest augmented crew whose 7.6.6 Table 7-9/7-10
  class-1 limit covers it (3 pilots 16 h, 4 pilots 17 h, +1 h with ≤ 2 sectors and one > 9 h).
  IR duties are sized by the same rule (3 or 4). Inferred 4-pilot duties without IR default to
  Crew A. Within a planned extension the crew stays 2 pilots and the pilot is asked
  (`augmentation_suggested`). `crew_source` = 'roster_ir' | 'fdp' | 'pilot'.
- **Pilot override.** On every flight duty the pilot can set 2 / 3 / 4 pilots and Crew A/B, whatever
  the roster or the FDP estimate says (a last-minute change). Crew A/B exist with 4 pilots, so
  choosing one makes a 4-pilot crew of that set. The analysis is re-run with `duty_crew_overrides`
  (`{duty_id: 'crew_a' | 'crew_b' | {composition, crew_set}}`) — `api_server._apply_crew_overrides`.
  The choice is stored in the replay snapshot.
- **Model.** Augmented duties get crew-specific pre-duty sleep strategies and in-flight
  rest from `AugmentedCrewRestPlanner` (3-pilot) or `ULRRestPlanner` (4-pilot Crew A/B
  rotation). In-flight sleep counts as sleep in the KSS model (crew-rest efficiency).
- **Display.** Every in-flight rest block the model scored is returned with
  `source = 'roster_ir'` (an IR sector on the roster) or `'planned'` (standard rotation,
  to be confirmed by the pilot). Watch cards and duty details show a crew badge
  ("4 pilots · ULR · Crew B", "3 pilots").

## Audit fixes and coverage

- Private FRM and ULR approvals are explicitly unverified. A calculated comparison
  never receives a complete “passed” FDP coverage verdict from a roster alone.
- Rest below the preceding duty now produces a warning: approval and compensation
  cannot be inferred from a gap that merely clears the 12 h / 10 h floor.
- Rest-boundary checks include intervening home standby; standby is not counted as
  uninterrupted rest. A short gap after standby is flagged for call-out review,
  without inventing a mandatory 12-hour rest after a legitimate call-out. The
  call-out relationship and any FDP reduction remain unassessed.
- Time-zone offsets are resolved at the actual UTC instant, including daylight-saving
  transitions, rather than interpreting UTC clock fields as local wall time.
- ULR warnings and missing history before/after the supplied roster are surfaced in
  duty details. A planned FDP cannot use discretion as scheduled capacity.
- Crew, rest facilities, ULR city pairs and rest rotations remain model assumptions
  until confirmed. Pilots can choose the facility class; its FDP and sleep-efficiency
  inputs are recalculated and retained in replay. ULR with a class-2/3 facility has no
  FDP verdict because this configured ULR scheme assumes a class-1 bunk. A full
  operator-profile selection/approval registry is not yet implemented; do not market these checks as universal regulatory certification.

## Not yet modelled

| Item | OM-A | Why |
|---|---|---|
| FDP reduction after standby (home > 6 h, 8 h augmented, 23:00–07:00 excluded; airport > 4 h, 16 h combined) | 7.11.2 / 7.11.3 | CrewLink does not show a call-out from standby |
| Split duty (+50 % of a break ≥ 3 h) | 7.6.7 | breaks are not identified on the roster |
| Reduced-rest consequences (next rest extended, next FDP reduced, ≤ 2 between recovery rests) | 7.13.6 | reduced rest is not marked on the roster; it is only noted |
| Delayed reporting | 7.7.2 | not on the roster |
| Rest facility class other than class 1 | 7.6.6 | bunk (class 1) defaults remain; pilots can select class 1/2/3 per augmented duty and re-run with the original roster file |
| Reporting times (Tables 7-2 – 7-5) | 7.6.2 | the roster's printed report time is used |

When the OM-A is revised, update `core/qatar_ftl.py` / `core/qatar_rest.py`, cite the paragraph,
update this table and the tests that pin the value.
