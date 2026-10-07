# Product, evidence and mobile audit — October 2026

This review starts from `c794a7a` and covers the React pilot journey, Python model and sleep inference, parser/API contracts, regulatory checks, scientific explanations, reports, offline logging, privacy, dependencies and release checks. It improves the software and the information pilots see. It does not establish biological validity, regulator acceptance or equivalence to a commercial model.

## Implemented improvements

| Area | Before | Implemented result and rationale |
|---|---|---|
| Roster briefing | Sleep assumptions, inferred crew and incomplete FTL coverage were scattered across views; absent coverage could appear “Clear”. | A compact outlook brings forward body-clock exposure, seven-day sleep shortfall, inherited/assumed history, crew assumptions and check coverage. Review actions open the relevant view or duty. Missing predictions never imply no demanding duties. |
| Priorities | Retrospective debrief requests preceded the prospective forecast. | Current-duty logging stays available; future roster pressure leads, followed by duties to watch and past-duty debriefs. First/highest forecast dates open duty details. |
| Phone calendar | A complete month compressed into small rows, with hover-only rest details. | Seven-day focus on phones, full-month option, previous/next and peak-day navigation, 56 px focused rows, touch controls, visible duty summaries, and an expandable key. Calendar controls were reduced from about 514 to 319 px above the grid at 390 px width. |
| Times and night windows | UTC view reused a fixed 02:00–06:00 home-time band; month edges and post-flight release could be misplaced. | Actual home-zone night windows are converted to UTC, including daylight saving. Bars respect release time, overnight continuations and month boundaries. Unknown zones do not acquire invented night shading. |
| Monthly sleepiness | A month of values was compressed on mobile; a missing prediction could be labelled asleep. | Seven-day navigation plus accessible daily values. Estimated sleep and unavailable predictions have separate states; the full-month view remains available. |
| Body clock | A second frontend adaptation heuristic generated fallback shifts and recovery dates even without model samples. | Only backend samples are plotted, dated in home time and available in a readable table. Missing model evidence produces an explicit empty state. No fabricated recovery deadline. |
| Contextual explanation | Tiny information buttons, text-only popovers and inconsistent scientific claims. | Touch/keyboard-open explanations include schematic KSS, sleep, body-clock and FTL diagrams, named dialogs, practical interpretation and evidence links. Opening a source preserves the roster tab. Heuristic sleep ratings are distinguished from calibrated confidence. |
| Peak explanation | A higher post-FDP sample could explain an FDP headline peak at another time. | Process contributions use the headline timestamp (or an explicitly matching sample); absent context is not invented. |
| Evidence library | Static lists mixed journal articles, reports, regulations and unresolved citations; several titles, years and venues were wrong. | Search, topic/source filters, deep links and per-source application/limitations. Identified publications are counted separately from unresolved legacy records. [Source audit](SCIENCE_SOURCE_AUDIT.md) records checks and remaining uncertainty. |
| Recommendations | Some text implied a universal minimum sleep, precise caffeine benefit, fixed inertia recovery time or scientifically validated quality coefficient. | Recommendations and source links now distinguish supporting literature from application assumptions and operator-dependent mitigations. No KSS-to-PVT, BAC or accident-probability conversion. |
| FTL and operator presentation | Private manual assumptions were conflated with combined regulator rules; discretion looked like extra planned capacity. | Neutral operator presentation, explicit owner-supplied scheme provenance, unverified approval/history coverage, visible ULR/rest-facility assumptions and no planned discretion allowance. [Operator scope](OPERATOR_FTL.md) lists implemented and unassessed rules. |
| FTL correctness | DST offsets used UTC wall fields as local time; standby could count as uninterrupted rest; reduced-rest approval was obscured. | Offsets use the actual instant, intervening standby triggers a call-out assessment gap, and reduced rest with unknown approval is flagged. No new regulatory values were invented. |
| Rest-facility input | Augmented duties silently assumed a Class 1 bunk, and four-pilot planning ignored other classes. | Per-duty facility choice travels with crew overrides and replay provenance. Unsupported Class 2/3 ULR limits remain unassessed rather than inheriting a Class 1 approval. |
| Operator identity | Heuristic detection could assign a pilot to an airline without confirmation. | Explicit confirmation before membership changes; neutral labels preserve existing stored identity and parser compatibility. IANA timezone identifiers and geographical names remain valid. |
| Private logging | Automatic study participation contradicted the privacy notice; withdrawal missed in-flight records; an asynchronous queue could cross sessions. | Explicit current-version opt-in, private logging without participation, owner/session guards, complete withdrawal/deletion handling and restored account log history after sign-in. Offline device entries survive read failures. |
| Retention | The interface promised an automatic expiry that did not exist. | The notice describes actual deletion behaviour. Legal identity, private contact, hosting/backup policy and automated retention remain owner-supplied release requirements. |
| Dependencies and old code | Patchable tool vulnerabilities and an unused chart capable of inventing recovery forecasts remained. | Patch updates, reproducible install, strict advisory policy and removal of the unused fabricated timeline. One unpatched build-only advisory is isolated and documented; unrelated advisories fail CI. |

The published biological equations and risk bands were not tuned to make the roster look better. Engine `aerowake-4.2-kss` identifies the temporal/rest-input changes; stored 4.0/4.1 results retain their original provenance. Product version is 4.1.0.

## Coverage of pilot information

| Pilot question | Where it is answered | Relevant limit |
|---|---|---|
| Which days need attention, and when? | Outlook, first/highest peak links, month strip and duties to watch | A model forecast is not personal fitness or an operational go/no-go decision. |
| Why might this duty be difficult? | Watch-card sleep/wake/WOCL context, peak contributions, duty timeline and evidence popovers | Sleep is inferred or pilot-planned until separately reported; model inputs and scope matter. |
| What will the whole roster look like? | Seven-day/month calendar, continuous sleepiness curve, routes and recovery views | Missing history and unmodelled periods are disclosed rather than filled with reassuring values. |
| What can I change? | Sleep habits, planned sleep editing, crew and rest-facility inputs, prospective concern report | Scenario changes recalculate estimates; they do not constitute operator approval or guaranteed mitigation. |
| Are the duty limits met? | FTL findings and rule-by-rule coverage, duty FDP detail | Only supplied records and configured rules are assessed; approval, annual history and unsupported cases remain explicit gaps. |
| What supports these numbers? | Evidence library, model method page, metric explanations and report citations | Identifying a paper does not validate every coefficient, the assembled product or individual predictions. |
| What did I actually experience? | Private in-flight KSS, debrief and actual-sleep diary | Reported values remain distinct from model forecasts; contribution to calibration requires explicit consent. |
| Can I take it to my operator? | Prospective/experienced report flows, export and print appendices | The pilot controls submission. Software does not silently submit a report. |

## BAM / SAFTE comparison and quoted improvements

“Quote” is treated here as source-backed improvements plus indicative engineering estimates for the remaining programme. These ranges are planning estimates for one experienced engineer with specialist review, not commercial quotations. Licensing, recruitment, governance and reviewer availability are excluded.

Aerowake currently predicts **subjective KSS** using the published Three Process Model and its own roster-to-sleep assumptions. SAFTE/FAST commonly predicts **PVT-derived effectiveness**. These targets cannot be compared using a guessed conversion. Current vendor capability descriptions also do not prove the accuracy of an independently built implementation.

- [Ingre et al. (2014), PLOS ONE, doi:10.1371/journal.pone.0108679](https://doi.org/10.1371/journal.pone.0108679): airline-crew evaluation of the TPM, including 136 participants and 8,040 ratings after the study's inclusion rule. Independently recorded sleep was used to avoid circular validation. The study's residual error is not an Aerowake accuracy guarantee.
- [EASA Easy Access Rules, March 2026, ORO.FTL.105(28)](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations?erules-id=ERULES-1963177438-11941): WOCL is defined in the acclimatised timezone. The app clearly labels its fixed home-base overlay as a reference, separate from an adapting body clock and regulatory acclimatisation.
- [Jeppesen fatigue risk management / BAM](https://ww2.jeppesen.com/airline-crew-optimization-solutions/fatigue-risk-management/): official product description includes sleep timing/tactics, commute inputs and crew-optimisation integration. These are useful capability benchmarks, not evidence of Aerowake parity.
- [FAA (2012), Flight Attendant Fatigue Recommendation II: Validation of the SAFTE/FAST Model](https://rosap.ntl.bts.gov/view/dot/57158/dot_57158_DS1.pdf): population-level PVT validation involving 178 cabin crew and 10,659 sessions. Its target and population differ from an individual pilot's KSS forecast.
- [Devine, Choynowski & Hursh (2025), Safety 11(1):4](https://doi.org/10.3390/safety11010004): SAFTE-FAST Insights evaluation against pilot fatigue reports. Bibliographic metadata was checked; no numerical accuracy claim is reproduced without full-text verification.

| Remaining improvement | Acceptance evidence | Indicative engineering effort |
|---|---|---|
| Independently verify operator profiles and remaining FTL cases | Authorized current source documents; signed rule-by-rule fixtures; standby reductions, split duty, delayed reporting and reduced-rest compensation correctly supported or unassessed | 1–3 weeks after reviewer-approved requirements; independent review separate |
| Validate roster-to-sleep inference separately | Consented diaries/actigraphy, by duty type and timezone; missingness and sensitivity results for naps, quality and commute assumptions | 2–3 weeks for evaluation tools; data collection separate |
| Freeze a prospective predictive-validation protocol | Prespecified outcomes, participant-level holdout, model/input version, missed high-fatigue events, false alarms, uncertainty and bias by scenario | 2–4 weeks for reproducible analysis tools; study duration needs recruitment and statistical design |
| Build an authorized BAM/SAFTE comparison harness | Licensed outputs with matched sleep/duty histories and documented configurations; KSS and PVT outcomes analysed separately | 2–4 weeks after licensing and data access |
| Add one optional measured-sleep source | Explicit consent, timestamp provenance, quality limits, overlap checks and pilot correction | 3–6 weeks after provider/API choice |
| Complete service governance and enforceable retention | Actual controller and private contact, hosting/backup retention policy, expiry job, deletion and restore rehearsal | 1–2 weeks after policy is supplied; legal review not estimated |

A small set of unblinded debriefs is not enough for validation. The ordinary interface exposes forecasts, so a prospective study must account for prediction exposure and use an independently designed protocol. These remaining steps require external evidence or decisions and cannot honestly be completed by changing UI copy.

## Verification

Final local validation: **558 backend tests** with disposable PostgreSQL, **347 frontend tests**, **16 desktop/mobile API-backed browser scenarios**, and **10 dependency-policy tests** passed. Node 22 clean installation, type checking, lint (zero errors; 30 existing warnings), production build and Python dependency audit passed. The frontend audit isolates one unpatched development-only `braces` advisory, reported across five packages locally and seven in GitHub CI because npm also propagates it through two Tailwind peer plugins; no production advisories were found. The exception checks the exact advisory and development-only lockfile provenance, including those peer plugins. Existing bundle-size warnings remain.

Production-preview checks at 390 and 1440 px covered outlook, calendar, recovery, FTL, routes and contextual evidence navigation with no horizontal overflow or page errors. Focused mobile checks also covered 320 and 768 px, keyboard/touch activation and 44 px information controls. Screenshots use synthetic inputs:

- [Desktop outlook](product-audit-preview/desktop-outlook.png)
- [Phone calendar](product-audit-preview/mobile-calendar.png)
- [Visual explanation](product-audit-preview/mobile-explanation.png)
- [Evidence deep link](product-audit-preview/mobile-evidence.png)
 Regression coverage includes temporal boundaries, missing inputs, reference navigation, crew/facility replay, study consent, offline owner isolation, imports, reports, print output and phone navigation. Source rosters and personal data are excluded from the repository; visual fixtures are synthetic.
