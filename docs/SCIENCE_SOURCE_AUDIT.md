# Scientific sources and product claims

Reviewed 7 October 2026. This is a bibliography and implementation-claim audit, not an independent validation study or a systematic review of the entire literature.

## What the catalogue contains

The previous Learn library had **54 entries**, including regulatory material, combined citations, inaccurate publication details and unresolved records. Searching the scoring core, sleep strategies, parameter documentation and report recommendations identified further references that were not surfaced in Learn.

The revised catalogue has **69 records: 55 identified journal articles, four reports or regulatory sources, and ten unresolved legacy citations**. The counts are calculated from `fatigue-insight-hub/src/data/references.ts`. Journal articles include experimental research, reviews and other journal publications; they must not be described collectively as 69 independent peer-reviewed validation studies.

The four non-journal sources are EASA's amending regulation, EASA's consolidated rules and guidance, the National Research Council report on commuting, and ICAO Doc 9966. The unresolved records are excluded from the identified evidence count and shown separately in the library.

## Verification method

Bibliographic records were checked against PubMed/Europe PMC and Crossref by title, authors and publication year. DOI or PubMed links identify the actual publication; official EASA, EUR-Lex and ICAO links identify regulatory documents. Crossref requests were rate-limited during the initial batch, so PubMed/Europe PMC supplied most journal metadata. The ICAO PDF returned an access-denied response in this session; its official citation/link is retained, and its full text was not revalidated. The original Borbély paper is linked by PMID 7185792: a DOI returned by an index appeared to describe a later encyclopedia entry and was not adopted.

Checking a publication's existence and metadata does not verify every quantitative assertion attributed to it. Numerical assertions that could not be supported were removed from explanatory UI or explicitly relabelled as modelling assumptions. Exact coefficients were not recalibrated by this audit. All 168 numeric constants in `core/parameters.py` were compared with the pre-audit file and retained.

## Material corrections

| Legacy record or claim | Corrected source or treatment |
| --- | --- |
| Signal 2013 described as a hotel-sleep study; inconsistent journals and pages | *In-flight sleep of flight crew during a 7-hour rest break: implications for research and flight safety*. Sleep 36:109–115. [DOI 10.5665/sleep.2312](https://doi.org/10.5665/sleep.2312). This does not establish universal home/hotel efficiency values. |
| Rempe 2025 attributed to Roach and article zpaf009 | Rempe et al., *Layover start timing predicts layover sleep quantity and timing on long-range and ultra-long-range trips*. Sleep Advances 6:zpaf002. [DOI 10.1093/sleepadvances/zpaf002](https://doi.org/10.1093/sleepadvances/zpaf002). The old `roach_2025` API key resolves to this source. |
| Dijk & Czeisler 1994 assigned to J Sleep Res | Neuroscience Letters 166:63–68. [DOI 10.1016/0304-3940(94)90841-9](https://doi.org/10.1016/0304-3940(94)90841-9). |
| McCauley model article assigned to 2013 / PNAS | The title identifies a **2009** Journal of Theoretical Biology article, 256:227–239. [DOI 10.1016/j.jtbi.2008.09.012](https://doi.org/10.1016/j.jtbi.2008.09.012). Historical citation key retained. |
| Jackson split-sleep article assigned to Accident Analysis & Prevention | Chronobiology International 31:1218–1230. [DOI 10.3109/07420528.2014.957305](https://doi.org/10.3109/07420528.2014.957305). No universal 92% effectiveness claim retained. |
| Kosmadopoulos article assigned to 2017 | **2014**, Chronobiology International 31:1209–1217. [DOI 10.3109/07420528.2014.957763](https://doi.org/10.3109/07420528.2014.957763). Historical key retained. |
| Waterhouse jet-lag article assigned to aviation journal | The Lancet 369:1117–1129. [DOI 10.1016/S0140-6736(07)60529-7](https://doi.org/10.1016/S0140-6736(07)60529-7). |
| Muhm cabin-altitude article assigned to aviation journal | New England Journal of Medicine 357:18–27. [DOI 10.1056/NEJMoa062770](https://doi.org/10.1056/NEJMoa062770). Passenger discomfort does not establish a fixed cognitive penalty. |
| Hamann & Carstengerdes citation had an untraceable title/journal | The identifiable simulator study is *Assessing the development of mental fatigue during simulated flights with concurrent EEG-fNIRS measurement*. [DOI 10.1038/s41598-023-31264-w](https://doi.org/10.1038/s41598-023-31264-w). Treated as background, not a KSS coefficient. |
| Åkerstedt & Folkard 1997 assigned to Sleep | Chronobiology International. [DOI 10.3109/07420529709001149](https://doi.org/10.3109/07420529709001149). |
| Kamimori 2015 assigned to aviation journal | Psychopharmacology: *Caffeine improves reaction time, vigilance and logical reasoning during extended periods with restricted opportunities for sleep*. [DOI 10.1007/s00213-014-3834-5](https://doi.org/10.1007/s00213-014-3834-5). No individual caffeine dose or KSS benefit predicted. |
| Signal 2024 absent from Learn | Added *Managing the challenge of fatigue for pilots operating ultra-long range flights*. [DOI 10.3389/fenvh.2023.1329203](https://doi.org/10.3389/fenvh.2023.1329203). The DOI contains 2023; publication date is January 2024. |
| Rosekind 1994 report cited unconfirmed SAE 942130 | Replaced the displayed reference with the identifiable 1994 aviation-fatigue review, [DOI 10.1177/001872089403600212](https://doi.org/10.1177/001872089403600212), with the substitution disclosed in its scope note. |

Smaller corrections include Minors & Waterhouse volume/pages, full Gander and Arsintescu titles, Brooks/Lack and Tietzel/Lack journals, Agnew's volume, and Kecklund/Åkerstedt's slow-wave-sleep title. The canonical catalogue supplies report bibliography entries. Backend sleep-strategy citations use the corrected bibliographic strings.

## Unresolved records

These author/year records were present in the repository but the cited publication could not be established. This does not prove no related publication exists. They must not be used to support quantitative claims until the actual source is supplied and checked.

| Record | Problem |
| --- | --- |
| Signal 2009 | The cited multi-sector sleep/fatigue title and journal details could not be established. Removed as support for a universal 23:00–07:00 night. |
| Åkerstedt 2008 | The stated sleep-duration, mortality and regional-brain-activity title could not be established. Removed as support for the assumed sleep-onset curve. |
| Åkerstedt 2010 | The stated microsleep title/formula could not be established. A KSS 9 probability is not microsleep probability. |
| Fuentes-Garcia 2021 | The original Scientific Reports citation could not be established. Related psychophysiological flight studies do not establish the claimed fixed simulator discount. |
| Cabon 2008 | The stated nonlinear time-on-task article could not be established. |
| Cabon 1993 | The cited workload/flight-phase record lacks an identifiable publication. |
| Gander 1994 | The stated *Flight crew fatigue V: duty period scheduling* record could not be established. |
| Nesthus 2007 | The cited FAA report/title pairing could not be established. |
| Spencer & Robertson 2002 | Report recommendation supplied authors/year without a title or identifier. Removed from active in-flight-rest advice. |
| Åkerstedt & Gillberg 1986 | A sleep-calculator comment assigned a wake-maintenance claim to J Sleep Res without an identifiable article. |

## What changed for the pilot

The library now supports author/title/topic/DOI search, topic and source-type filters, and direct links from a roster explanation to the cited publication. Every source has a relevance statement and a scope statement. Mobile controls are at least 44 px high; citations wrap rather than requiring a wide table. Unresolved records are retained in a separate expandable section.

The previous long sleep-quality explainer presented application percentages as scientifically validated. It is replaced by a short visual chain from sleep opportunity to body clock to predicted KSS, plus interactive explanations for early reports, night duties, time-zone changes and repeated short sleep. Links take the pilot to the evidence for the selected pattern.

Sleep-assumption explanations now describe why a block was estimated without presenting heuristic confidence as a calibrated probability. Report recommendations no longer promise a fixed post-nap recovery time, a universal six-hour sleep minimum, a caffeine-related KSS improvement or a maximum benefit from a particular bunk-rest window. In-flight rest advice explicitly depends on approved procedures.

## Scientific limits that remain

The current prediction core cites [Ingre et al. 2014](https://doi.org/10.1371/journal.pone.0108679), model 5c. The study's residual standard deviation of 1.42 KSS is a population result, not a personal error bound. Application band thresholds, sleep inference, quality multipliers, initial-state policy and the complete forecast require independent evaluation. Sleep inertia is not included in the KSS score.

A complete scientific review should trace each active coefficient to either a published equation or an explicit assumption; reproduce published experiments where data permit; and evaluate sleep estimation separately from alertness prediction. Pilot observations must remain distinct from predictions. Bibliographic correction and regression tests do not establish biological validity, operational approval or equivalence to BAM or SAFTE-FAST.
