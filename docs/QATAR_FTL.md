# Qatar Airways FTL — what Aerowake encodes

Aerowake's first users are Qatar Airways pilots (Doha base). Qatar Airways operates
under its QCAA-approved FTL scheme (Operations Manual Part A, Chapter 7), not EASA
ORO.FTL directly. This note records which Qatar rules are in the code, where, and
which values still need confirming against the current OM-A Chapter 7. **Update it
whenever an FTL value changes.** Never invent a regulatory value: if a table is not
confirmed here, the app must label the check as EASA-referenced or not assessed.

## Encoded from Qatar FTL

| Rule | Value in code | Where |
|---|---|---|
| 7.18 ULR definition | FDP > 18 h | `core/extended_operations.py` `QatarFTL718Parameters` |
| 7.18 maximum planned ULR FDP | 20 h; commander's discretion up to 3 h, > 2 h reported to QCAA | same |
| 7.18 ULR crew | 4 pilots (2 captains + 2 first officers) | same |
| 7.18.9 in-flight rest | at least 2 rest periods, one of at least 4 h | same; `ULRRestPlanner` |
| 7.18 pre-ULR rest | 48 h duty-free including 2 local nights | same |
| 7.18 post-ULR rest | 4 local nights at base; away: 48 h including 2 local nights | same |
| 7.18 monthly limit | at most 2 ULR duties per calendar month | same |
| ULR city pairs | DOH–AKL permanent; DOH–DFW, DOH–MIA seasonal | same (check each season) |
| 7.6.1 Table 7-1 acclimatisation | B/X/D by time-zone difference and elapsed time | `AcclimatizationCalculator`; used by `compliance.determine_acclimatisation` |
| Compliance check | `QatarFTL718Validator` → `ulr_compliance` on each ULR duty | API `DutyResponse.ulr_compliance` |

## Augmented crew (3 or 4 pilots) — how it works

- **Detection.** The CrewLink PDF marks in-flight rest with `IR` sectors. A duty with an
  `IR` sector is 4-pilot (Crew B); the operating legs of the same pairing are 4-pilot
  (Crew A) — `parsers/roster_parser.py::auto_detect_crew_augmentation`. A 3-pilot crew
  cannot be read from the PDF.
- **Pilot override.** In duty details the pilot can set 2 / 3 / 4 pilots (and Crew A/B for
  4-pilot ULR). The analysis is re-run with `duty_crew_overrides`
  (`{duty_id: 'crew_a' | 'crew_b' | {composition, crew_set}}`) — `api_server._apply_crew_overrides`.
  The choice is stored in the replay snapshot.
- **Model.** Augmented duties get crew-specific pre-duty sleep strategies and in-flight
  rest from `AugmentedCrewRestPlanner` (3-pilot) or `ULRRestPlanner` (4-pilot Crew A/B
  rotation). In-flight sleep counts as sleep in the KSS model (crew-rest efficiency).
- **Display.** Every in-flight rest block the model scored is returned with
  `source = 'roster_ir'` (an IR sector on the roster) or `'planned'` (standard rotation,
  to be confirmed by the pilot). Watch cards and duty details show a crew badge
  ("4 pilots · ULR · Crew B", "3 pilots").

## Still EASA-referenced — confirm against Qatar OM-A Chapter 7

These values are from EASA and are **not yet confirmed** as Qatar's:

| Item | Current value (EASA source) | Where |
|---|---|---|
| Augmented FDP maximum (non-ULR) | 3 pilots: 16 / 15 / 14 h; 4 pilots: 17 / 16 / 15 h for rest facility class 1 / 2 / 3 (CS FTL.1.205(c)(2)) | `AugmentedFDPParameters.fdp_table` |
| Long-sector bonus | +1 h when ≤ 2 sectors and one sector > 9 h flight time | same |
| Augmented sector limit | 3 sectors | same |
| Minimum in-flight rest | 2 h for the landing crew, 90 min for the others | same |
| Commander's discretion, augmented | 3 h | same |
| Standard-crew FDP table | ORO.FTL.205(b) Table 2 / Table 3, 30 min per sector after the 2nd, minimum 9 h | `core/compliance.py` |
| Disruptive schedules | EASA "early type" definitions | `core/compliance.py` |
| Rest facility class default | Class 1 (bunk) when the pilot sets 3/4 pilots without a class | `_apply_crew_overrides` |

When the owner supplies the OM-A Chapter 7 tables, replace these values, cite the
Qatar paragraph in the parameter docstring, move the row to the table above, and add
a test that pins the value.
