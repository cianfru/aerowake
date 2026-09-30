# CrewLink roster reference and validation boundaries

The user supplied a one-page CrewLink **Crew Schedule Report**, February 2026, with “all times UTC” except OFF/leave entries. It is the format reference for this implementation. The original PDF and personal identifiers are intentionally not stored in the repository.

## Interpretation

- Date columns contain an RPT followed by vertically stacked flight numbers, airports, departure/arrival times and aircraft annotations.
- UTC is taken from the header. `(+1)` moves the arrival to the following UTC date.
- A following column with no RPT can continue a duty where the prior arrival and next departure share an outstation. It must not create a second report time.
- `PSBY` / `SBY` in this format mean home standby; airport standby remains a separate activity.
- Report/release timestamps and sector timestamps are separate facts. Release can be inferred from an allowance where the source does not state it explicitly.
- Calendar block totals clip flying at the UTC month boundary. Whole-duty totals retain a flight's complete duration.

## Independent checks against the supplied document

Twenty sector rows (flight, airports, departure and arrival) and thirteen report times were independently transcribed from the source grid and compared with the parsed result. All matched. There are thirteen flight duty periods and three home standby periods.

| Quantity | Result | Meaning |
|---|---|---|
| February block time | **52:52** | Exact match to the source monthly block total |
| Complete flight block time | **56:07** | Includes March continuation of the last flight |
| Continuation after February | **03:15** | Explains the difference above |
| Source duty total | **90:00** | Not independently reconciled: release allowances/accounting need operator confirmation |

The source's flight-day count is not the same measure as the number of duty periods. Do not force parser duty counts to equal calendar flight days. Passing these checks validates the listed parsing facts for this example, not all CrewLink variants, regulatory compliance, actual sleep, or fatigue predictions.

## Home base: detected, never assumed

The home base sets how home-base times are read, where post-duty sleep is taken (home or hotel), acclimatisation and the ORO.FTL.235 rest minimum at home base. Parsers never fall back to a default base, aircraft, source total or month.

| Source (`base_source`) | When | Pilot action |
|---|---|---|
| `roster_header` | CrewLink `(DOH CP-A320)` (2- or 3-letter role) or easyJet `ID NAME AGP,CP,319`, verified against the airport database | None. Shown as "From roster header" |
| `duty_pattern` | CSV only: one known airport is at least 60% of the first departures and last arrivals of all duties (a tie is not a pattern) | Confirms with the checkbox |
| `entered` | The roster states no base, the CSV pattern is unclear, or the pilot corrects an inferred base | Types the 3-letter code |

A typed base never silently replaces a header base. Without `home_base_override` the header wins and the conflict is returned as a warning. With the override, the pilot's base is used for analysis while roster times are still read in the convention the roster prints; the review warns about it, and about any base at which no flight duty starts or ends. A typed base that differs from a CSV duty pattern is used but flagged. A CSV read in the wrong base's local time is rejected with the base named (`base_mismatch`), not an internal duty identifier.

## Preview and analysis contract

`POST /api/roster/preview` and `POST /api/analyze` take `home_base` (optional) and `home_base_override` (optional, default false) and share one intake (`api/preview.py:parse_upload`), so the analysis uses exactly the base the pilot confirmed. Clients that still send `home_base` keep working; a header conflict is now reported rather than ignored. Saved rosters record the base actually analysed, and replay provenance records `home_base` and `base_source`.

Errors return HTTP 422 with a string `detail` and a stable `code`:

| `code` | Meaning |
|---|---|
| `home_base_required` | No header base, no clear CSV pattern and no entry |
| `no_duties` | Nothing to analyse: not a supported roster, an empty CSV, or home standby only. The message names the supported formats |
| `unknown_airport`, `invalid_home_base` | The entered base is not a known 3-letter IATA code |
| `base_mismatch` | CSV report/release times do not fit the flights in the entered base's local time |
| `roster_period_missing` | easyJet PDF without its period line |
| `unsupported_file`, `invalid_roster` | Not a PDF/CSV, or another validation failure (message explains) |

Preview fields added to the existing response (all additive): `roster_format`, `base_source`, `detected_base`, `detected_base_source`, `entered_base`, `base_conflict`, `base_override`, `base_city`, `base_country`, `base_airport_name`, `base_utc_offsets` (distinct offsets across the month, so a clock change shows twice), `flight_duties`, `training_duties`, `airport_standbys`, `duties_touching_base`, `inferred_release_count`, `checks` (`code`, `severity` `warning`|`info`, `message`) and `needs_confirmation`. Each duty gains `sectors` and `release_inferred`; non-flight duties are labelled Home standby, Airport standby, Simulator or Ground training. `warnings` stays as the list of check messages for older clients.

`needs_confirmation` is true for an inferred CSV base or any warning (header conflict, override, no duty at the base, block total different from the source). A block mismatch is an amber warning with the h:mm difference; it asks for acknowledgement but does not block analysis. Inferred releases are an `info` note with a count: CrewLink prints no release, so flights end 30 minutes after the last landing and training 30 minutes after the session; easyJet releases are inferred only where none is printed.

## Repeatable workflow

Choosing a file reads it immediately. The summary shows the month in words, the base with city, time zone and UTC offset and where it came from, duty/sector/home-standby counts, block time as h:mm against the roster total, flagged items, counted notes, and every duty in home-base time with UTC on demand. "Analyse roster" is the single primary action and is itself the explicit confirmation; the checkbox appears only when `needs_confirmation` is true. Files are checked in the browser for type (PDF/CSV) and size (10 MB) before upload. Unknown airports, overlapping sectors/duties and implausible durations are rejected.

For private offline validation, from `fatigue-tool` (`--base` only when the roster states none):

```sh
python scripts/validate_roster.py /private/path/roster.pdf
python scripts/validate_roster.py /private/path/roster.pdf --expected /private/path/reviewed.json
python scripts/validate_roster.py /private/path/roster.csv --base DOH
```

The expectations file is a JSON subset of the preview response, independently reviewed against the source. Do not generate expected values with the same parser under test. Keep that file and detailed output private. `tests/test_roster_reference_format.py` contains synthetic cells for overnight markers, continuation, home standby and month clipping without copying the private schedule. `tests/test_roster_intake.py` builds synthetic CrewLink PDFs (`tests/synthetic_pdf.py`) and CSVs for base detection, conflicts, overrides and empty files.

CSV columns: `Date,Flight,Departure,Arrival,STD,STA,Report,Release`. `Date` is the home-base duty date; report/release are home-base local times and STD/STA are airport local times. Rows with the same `Date` and `Report` form one duty. For date-line or differing departure dates use explicit `DepartureDate` and `ArrivalDate` (ISO dates). DST gaps/folds require an unambiguous source; ambiguous local times fail validation rather than silently choosing an offset. The upload screen offers a synthetic template (two duties at a Gatwick base) as a download.
