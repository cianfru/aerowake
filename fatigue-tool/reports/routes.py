"""POST /api/fatigue-report — stateless: nothing is stored server-side.

The pilot keeps the generated report (print/PDF/JSON) and decides where to
submit it. Inputs are validated for consistency before analysis.
"""
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional

import pytz
from fastapi import APIRouter, HTTPException
from pydantic import AwareDatetime, BaseModel, Field, model_validator

from parsers.roster_parser import AirportDatabase, _IATA_DB
from reports.engine import (EFFECT_LABELS, FACTOR_LABELS, MITIGATION_LABELS, PHASE_LABELS, DutyIn, ReportInput,
                            Sector, SleepIn, analyse)

router = APIRouter(prefix='/api/fatigue-report', tags=['Fatigue report'])

MAX_PERIOD_DAYS = 31


class SectorIn(BaseModel):
    flight_number: str = Field('', max_length=12)
    departure: str = Field(min_length=3, max_length=4)
    arrival: str = Field(min_length=3, max_length=4)
    departure_utc: AwareDatetime
    arrival_utc: AwareDatetime
    is_deadhead: bool = False

    @model_validator(mode='after')
    def _order(self):
        if self.arrival_utc <= self.departure_utc:
            raise ValueError(f'Sector {self.flight_number or self.departure}: arrival must be after departure.')
        if self.arrival_utc - self.departure_utc > timedelta(hours=20):
            raise ValueError('Sector longer than 20 hours.')
        return self


class DutyModel(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    report_utc: AwareDatetime
    release_utc: AwareDatetime
    sectors: List[SectorIn] = Field(default_factory=list, max_length=12)
    status: Literal['operated', 'planned', 'cancelled_fatigue', 'not_operated'] = 'operated'
    duty_type: Literal['flight', 'standby', 'home_standby', 'airport_standby', 'simulator', 'ground', 'positioning', 'other'] = 'flight'
    description: str = Field('', max_length=80)
    source: Literal['roster', 'manual'] = 'manual'
    crew_composition: Literal['standard', 'augmented_3', 'augmented_4', 'unknown'] = 'unknown'
    acclimatization: Literal['acclimatized', 'unknown'] = 'unknown'

    @model_validator(mode='after')
    def _order(self):
        if self.release_utc <= self.report_utc:
            raise ValueError(f'Duty {self.id}: release must be after report.')
        if self.release_utc - self.report_utc > timedelta(hours=24):
            raise ValueError(f'Duty {self.id}: longer than 24 hours.')
        return self


class SleepModel(BaseModel):
    start_utc: AwareDatetime
    end_utc: AwareDatetime
    kind: Literal['main', 'nap', 'inflight_rest'] = 'main'
    location: Literal['home', 'hotel', 'crew_rest', 'other'] = 'home'
    quality: Optional[int] = Field(None, ge=1, le=5)
    source: Literal['reported', 'estimated'] = 'reported'

    @model_validator(mode='after')
    def _order(self):
        if self.end_utc <= self.start_utc:
            raise ValueError('Sleep end must be after its start.')
        if self.end_utc - self.start_utc > timedelta(hours=16):
            raise ValueError('A single sleep period cannot exceed 16 hours.')
        return self


class SelfAssessmentModel(BaseModel):
    kss: Optional[int] = Field(None, ge=1, le=9)
    samn_perelli: Optional[int] = Field(None, ge=1, le=7)
    rated_at_utc: Optional[AwareDatetime] = None


class PilotModel(BaseModel):
    name: str = Field('', max_length=120)
    staff_number: str = Field('', max_length=40)
    rank: str = Field('', max_length=40)
    fleet: str = Field('', max_length=40)
    operator: str = Field('', max_length=120)


class FatigueReportRequest(BaseModel):
    home_base: Optional[str] = Field(None, min_length=3, max_length=4)
    home_timezone: Optional[str] = None
    event_type: Literal['roster_concern', 'fatigue_call_before_duty', 'fatigue_during_duty', 'fatigue_after_duty'] = \
        'fatigue_call_before_duty'
    watch_reference_kss: float = Field(6.5, ge=1, le=9, allow_inf_nan=False)
    event_time_utc: AwareDatetime
    period_start_utc: AwareDatetime
    period_end_utc: AwareDatetime
    diary_complete: bool = False
    affected_duty_id: Optional[str] = None
    duties: List[DutyModel] = Field(default_factory=list, max_length=80)
    sleeps: List[SleepModel] = Field(default_factory=list, max_length=120)
    self_assessment: SelfAssessmentModel = Field(default_factory=SelfAssessmentModel)
    contributing_factors: List[str] = Field(default_factory=list, max_length=len(FACTOR_LABELS))
    narrative: str = Field('', max_length=5000)
    pilot: PilotModel = Field(default_factory=PilotModel)
    # ICAO Doc 9966 / AMC-GM ORO.FTL.120 operational context (optional, pilot-entered).
    crew_position: Literal['', 'captain', 'first_officer', 'second_officer', 'other'] = ''
    pilot_role: Literal['', 'pilot_flying', 'pilot_monitoring'] = ''
    phase_of_flight: Literal[('',) + tuple(PHASE_LABELS)] = ''  # type: ignore[valid-type]
    mitigations: List[Literal[tuple(MITIGATION_LABELS)]] = Field(  # type: ignore[valid-type]
        default_factory=list, max_length=len(MITIGATION_LABELS))
    effect_on_operation: Literal[('',) + tuple(EFFECT_LABELS)] = ''  # type: ignore[valid-type]
    suggested_action: str = Field('', max_length=1000)

    @model_validator(mode='after')
    def _timing(self):
        """Retrospective claims must describe the past (ORO.FTL.120 reporting is about
        fatigue that occurred); upcoming duties belong in a roster concern."""
        now = datetime.now(timezone.utc) + timedelta(minutes=5)
        retrospective = self.event_type != 'roster_concern'
        if retrospective and self.event_time_utc > now:
            raise ValueError('Fatigue you called or experienced must be in the past. '
                             'For an upcoming duty, raise a roster concern instead.')
        for d in self.duties:
            if d.report_utc <= now:
                continue
            if d.status == 'operated':
                raise ValueError(f'Duty {d.id} has not started yet, so it cannot be marked operated.')
            if d.status == 'cancelled_fatigue' and self.event_type != 'fatigue_call_before_duty':
                raise ValueError(f'Duty {d.id} has not started yet. Only a fatigue call made before '
                                 'the duty can mark it not operated because of fatigue.')
        if self.event_type == 'fatigue_during_duty':
            affected = next((d for d in self.duties if d.id == self.affected_duty_id), None)
            if affected is None:
                raise ValueError('Select the duty during which you became fatigued.')
            if not affected.report_utc <= self.event_time_utc <= affected.release_utc:
                raise ValueError('Fatigue during a duty must be timed between that duty’s report and release.')
        if self.phase_of_flight and self.event_type != 'fatigue_during_duty':
            raise ValueError('Phase of flight applies only to fatigue during a duty.')
        return self

    @model_validator(mode='after')
    def _consistency(self):
        if self.period_end_utc <= self.period_start_utc:
            raise ValueError('The period end must be after its start.')
        if self.period_end_utc - self.period_start_utc > timedelta(days=MAX_PERIOD_DAYS):
            raise ValueError(f'Select at most {MAX_PERIOD_DAYS} days.')
        if not self.home_base and not self.home_timezone:
            raise ValueError('Provide a home base airport or time zone.')
        if self.home_timezone and self.home_timezone not in pytz.all_timezones_set:
            raise ValueError('Unknown home time zone.')
        ids = [d.id for d in self.duties]
        if len(ids) != len(set(ids)):
            raise ValueError('Duty ids must be unique.')
        if self.affected_duty_id and self.affected_duty_id not in ids:
            raise ValueError('The affected duty is not in the duty list.')
        bad = [f for f in self.contributing_factors if f not in FACTOR_LABELS]
        if bad:
            raise ValueError(f'Unknown contributing factor(s): {", ".join(bad)}')
        ordered = sorted(self.sleeps, key=lambda s: s.start_utc)
        for a, b in zip(ordered, ordered[1:]):
            if b.start_utc < a.end_utc:
                raise ValueError('Sleep periods overlap: '
                                 f'{a.start_utc.isoformat()} and {b.start_utc.isoformat()}.')
        if not self.period_start_utc <= self.event_time_utc <= self.period_end_utc:
            raise ValueError('The fatigue event must be inside the selected period.')
        # Seven days of initialization history and a single overnight duty are bounded explicitly.
        lower, upper = self.period_start_utc - timedelta(days=7), self.period_end_utc + timedelta(hours=24)
        for d in self.duties:
            if d.report_utc < self.period_start_utc or d.release_utc > upper:
                raise ValueError(f'Duty {d.id}: outside the selected period and overnight allowance.')
            last = d.report_utc
            for sector in sorted(d.sectors, key=lambda x: x.departure_utc):
                if not last <= sector.departure_utc < sector.arrival_utc <= d.release_utc:
                    raise ValueError(f'Duty {d.id}: sectors overlap or fall outside report/release.')
                last = sector.arrival_utc
        active = sorted((d for d in self.duties if d.status in ('operated', 'planned')), key=lambda d: d.report_utc)
        for a, b in zip(active, active[1:]):
            if b.report_utc < a.release_utc:
                raise ValueError(f'Duties {a.id} and {b.id} overlap.')
        for sleep in self.sleeps:
            if sleep.start_utc < lower or sleep.end_utc > upper:
                raise ValueError('Sleep falls outside the maximum report history/horizon.')
            for d in active:
                if (d.status != 'operated' and self.event_type != 'roster_concern') or sleep.start_utc >= d.release_utc or sleep.end_utc <= d.report_utc:
                    continue
                rest_allowed = (sleep.kind == 'inflight_rest' and sleep.location == 'crew_rest'
                                and d.crew_composition in ('augmented_3', 'augmented_4')
                                and any(x.departure_utc <= sleep.start_utc < sleep.end_utc <= x.arrival_utc for x in d.sectors))
                if not rest_allowed and d.duty_type != 'home_standby':
                    raise ValueError(f'Sleep overlaps {d.status} duty {d.id}. Confirm authorized crew rest or correct the times.')
        rated = self.self_assessment.rated_at_utc
        if rated and not self.period_start_utc <= rated <= self.period_end_utc:
            raise ValueError('Self-rating time must be inside the selected period.')
        latest_observation = datetime.now(timezone.utc) + timedelta(minutes=5)
        if (self.self_assessment.kss is not None or self.self_assessment.samn_perelli is not None) and (rated or self.event_time_utc) > latest_observation:
            raise ValueError('A self-rating must describe an observation already made, not future fatigue.')
        if any(s.source == 'reported' and s.end_utc > latest_observation for s in self.sleeps):
            raise ValueError('Future sleep must be marked estimated, not reported.')
        return self


def _airport_tz(code: str, unknown: List[str]) -> str:
    code = code.upper()
    if code not in _IATA_DB and code not in AirportDatabase._custom_airports:
        raise ValueError(f'Unknown airport {code}; confirm the code before generating a report.')
    return AirportDatabase.get_airport(code).timezone


def to_input(req: FatigueReportRequest) -> ReportInput:
    unknown: List[str] = []
    from parsers.validation import resolve_home_timezone
    home_tz = resolve_home_timezone(req.home_base, req.home_timezone) if req.home_base else req.home_timezone
    duties = [DutyIn(
        id=d.id, report_utc=d.report_utc, release_utc=d.release_utc, status=d.status,
        duty_type=d.duty_type, description=d.description, source=d.source,
        crew_composition=d.crew_composition, acclimatization=d.acclimatization,
        sectors=[Sector(s.flight_number, s.departure.upper(), s.arrival.upper(), s.departure_utc,
                        s.arrival_utc, _airport_tz(s.departure, unknown), _airport_tz(s.arrival, unknown),
                        s.is_deadhead) for s in sorted(d.sectors, key=lambda x: x.departure_utc)],
    ) for d in req.duties]
    sleeps = [SleepIn(s.start_utc, s.end_utc, s.kind, s.location, s.quality, s.source) for s in req.sleeps]
    return ReportInput(
        home_timezone=home_tz, home_base=req.home_base.upper() if req.home_base else None,
        event_type=req.event_type, event_time_utc=req.event_time_utc,
        period_start_utc=req.period_start_utc, period_end_utc=req.period_end_utc,
        duties=duties, sleeps=sleeps, affected_duty_id=req.affected_duty_id,
        self_kss=req.self_assessment.kss, self_samn_perelli=req.self_assessment.samn_perelli,
        self_rated_at=req.self_assessment.rated_at_utc, factors=list(dict.fromkeys(req.contributing_factors)),
        narrative=req.narrative.strip(), pilot={k: v for k, v in req.pilot.model_dump().items() if v},
        unknown_airports=unknown, diary_complete=req.diary_complete,
        watch_reference_kss=req.watch_reference_kss,
        crew_position=req.crew_position, pilot_role=req.pilot_role, phase_of_flight=req.phase_of_flight,
        mitigations=list(dict.fromkeys(req.mitigations)), effect_on_operation=req.effect_on_operation,
        suggested_action=req.suggested_action.strip(),
    )


@router.post('')
async def create_report(req: FatigueReportRequest) -> Dict:
    try:
        from api.hardening import run_compute
        import hashlib, json
        report = await run_compute(analyse, to_input(req))
        inputs = req.model_dump(mode='json')
        canonical = json.dumps(inputs, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
        report['provenance'] = {'input_schema': 2, 'parser_version': 'roster-1.1',
                                'input_sha256': hashlib.sha256(canonical.encode()).hexdigest(),
                                'inputs': inputs}
        return report
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get('/factors')
def factors() -> Dict[str, str]:
    return FACTOR_LABELS
