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

## Repeatable workflow

Use the upload review screen before analysis. It shows dates, resolved base/zone, counts, source block reconciliation and inferred-time warnings. Confirmation is explicit. Unknown airports, overlapping sectors/duties and implausible durations are rejected.

For private offline validation, from `fatigue-tool`:

```sh
python scripts/validate_roster.py /private/path/roster.pdf --base DOH
python scripts/validate_roster.py /private/path/roster.pdf --base DOH --expected /private/path/reviewed.json
```

The expectations file is a JSON subset of the preview response, independently reviewed against the source. Do not generate expected values with the same parser under test. Keep that file and detailed output private. `tests/test_roster_reference_format.py` contains synthetic cells for overnight markers, continuation, home standby and month clipping without copying the private schedule.

CSV columns: `Date,Flight,Departure,Arrival,STD,STA,Report,Release`. `Date` is the home-base duty date; report/release are home-base local times and STD/STA are airport local times. For date-line or differing departure dates use explicit `DepartureDate` and `ArrivalDate` (ISO dates). DST gaps/folds require an unambiguous source; ambiguous local times fail validation rather than silently choosing an offset.
