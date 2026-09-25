"""POST /api/fatigue-report — stateless: nothing is stored server-side.

The pilot keeps the generated report (print/PDF/JSON) and decides where to
submit it. Inputs are validated for consistency before analysis.
"""
from datetime import timedelta
from typing import Dict, List, Literal, Optional

import pytz
from fastapi import APIRouter, HTTPException
from pydantic import AwareDatetime, BaseModel, Field, model_validator

from parsers.roster_parser import AirportDatabase, _IATA_DB
from reports.engine import FACTOR_LABELS, DutyIn, ReportInput, Sector, SleepIn, analyse

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
    duty_type: Literal['flight', 'standby', 'simulator', 'ground', 'positioning', 'other'] = 'flight'
    description: str = Field('', max_length=80)
    source: Literal['roster', 'manual'] = 'manual'

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
    event_type: Literal['fatigue_call_before_duty', 'fatigue_during_duty', 'fatigue_after_duty'] = \
        'fatigue_call_before_duty'
    event_time_utc: AwareDatetime
    period_start_utc: AwareDatetime
    period_end_utc: AwareDatetime
    affected_duty_id: Optional[str] = None
    duties: List[DutyModel] = Field(default_factory=list, max_length=80)
    sleeps: List[SleepModel] = Field(default_factory=list, max_length=120)
    self_assessment: SelfAssessmentModel = Field(default_factory=SelfAssessmentModel)
    contributing_factors: List[str] = Field(default_factory=list, max_length=len(FACTOR_LABELS))
    narrative: str = Field('', max_length=5000)
    pilot: PilotModel = Field(default_factory=PilotModel)

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
        return self


def _airport_tz(code: str, unknown: List[str]) -> str:
    code = code.upper()
    if code not in _IATA_DB and code not in AirportDatabase._custom_airports:
        unknown.append(code)
        return 'UTC'
    return AirportDatabase.get_airport(code).timezone


def to_input(req: FatigueReportRequest) -> ReportInput:
    unknown: List[str] = []
    home_tz = req.home_timezone or _airport_tz(req.home_base, unknown)
    duties = [DutyIn(
        id=d.id, report_utc=d.report_utc, release_utc=d.release_utc, status=d.status,
        duty_type=d.duty_type, description=d.description, source=d.source,
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
        unknown_airports=unknown,
    )


@router.post('')
def create_report(req: FatigueReportRequest) -> Dict:
    try:
        return analyse(to_input(req))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get('/factors')
def factors() -> Dict[str, str]:
    return FACTOR_LABELS
