"""Review parsing and assumptions before running a fatigue simulation.

``parse_upload`` is the single intake for preview and analysis. The home base
comes from the roster header, an explicit entry (or override) by the pilot, or
a CSV duty pattern; it is never assumed. Errors carry a stable ``code``.
"""
import os
import tempfile
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from starlette.responses import JSONResponse

from api.analysis_access import analysis_principal
from api.hardening import read_upload, run_compute, validate_upload
from parsers.base_detection import (DUTY_PATTERN, ROSTER_HEADER, RosterIntakeError, infer_csv_base,
                                    normalise_code, require_airport, resolve_base)
from parsers.reconciliation import review
from parsers.roster_parser import CSVRosterParser, PDFRosterParser
from parsers.validation import require_duties, resolve_home_timezone, validate_roster

router = APIRouter()


def rehome(roster, base):
    """Use ``base`` as the analysis home base; roster times are already absolute (UTC)."""
    if roster.pilot_base == base:
        return
    zone = resolve_home_timezone(base)
    roster.pilot_base = base
    roster.home_base_timezone = zone
    for duty in roster.duties + roster.standbys:
        duty.home_base_timezone = zone


def _parse_pdf(path, entered, override, timezone_format, pilot_id, month):
    parser = PDFRosterParser(entered, None, timezone_format)
    roster = parser.parse_pdf(path, pilot_id, month)
    # A file with no duties is reported as such before asking for a base.
    require_duties(roster)
    header = parser.header_base
    resolution = resolve_base(entered, header, ROSTER_HEADER if header else None, override)
    rehome(roster, resolution.base)
    return roster, parser, resolution, parser.detected_format or 'pdf'


def _parse_csv(path, entered, override, pilot_id, month):
    frame = CSVRosterParser.load_frame(path)
    inferred = infer_csv_base(frame)
    pattern = inferred[0] if inferred else None
    resolution = resolve_base(entered, pattern, DUTY_PATTERN if pattern else None, override)
    parser = CSVRosterParser(resolution.base)
    try:
        roster = parser.parse_frame(frame, pilot_id, month)
    except RosterIntakeError:
        raise
    except ValueError as exc:
        if pattern and resolution.base != pattern:
            raise RosterIntakeError(
                f"Report and release times don't line up with the flights when read in {resolution.base} local time. "
                f'Your duties start and end at {pattern}. Check the home base.', 'base_mismatch') from exc
        raise
    require_duties(roster)
    return roster, parser, resolution, 'csv'


def parse_upload(content, suffix, entered=None, override=False, timezone_format='auto',
                 pilot_id='preview', month: Optional[str] = None):
    """Parse an uploaded roster with an honestly resolved base.

    Returns ``(roster, parser, resolution, roster_format)``. Raises
    ``RosterIntakeError`` (``home_base_required``, ``no_duties`` ...) or ValueError.
    """
    entered = normalise_code(entered)
    if entered:
        require_airport(entered)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        path = tmp.name
    try:
        if suffix == '.pdf':
            result = _parse_pdf(path, entered, override, timezone_format, pilot_id, month)
        else:
            result = _parse_csv(path, entered, override, pilot_id, month)
    finally:
        os.unlink(path)
    validate_roster(result[0])
    return result


def parse_for_review(content, suffix, entered=None, override=False):
    roster, parser, resolution, roster_format = parse_upload(content, suffix, entered, override)
    return review(roster, parser, suffix, resolution, roster_format)


def intake_error(exc: ValueError, status: int = 422) -> JSONResponse:
    """String ``detail`` keeps older clients working; ``code`` lets new ones react."""
    return JSONResponse(status_code=status,
                        content={'detail': str(exc), 'code': getattr(exc, 'code', 'invalid_roster')})


@router.post('/api/roster/preview')
async def preview(file: UploadFile = File(...), home_base: Optional[str] = Form(None),
                  home_base_override: bool = Form(False), principal=Depends(analysis_principal)):
    suffix = os.path.splitext(file.filename or '')[1].lower()
    if suffix not in ('.pdf', '.csv'):
        return intake_error(RosterIntakeError('Choose a PDF or CSV roster.', 'unsupported_file'))
    content = await read_upload(file)
    validate_upload(content, suffix)
    try:
        return await run_compute(parse_for_review, content, suffix, home_base, home_base_override)
    except ValueError as exc:
        return intake_error(exc)
