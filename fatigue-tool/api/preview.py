"""Review parsing and assumptions before running a fatigue simulation."""
import os
import tempfile
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from api.analysis_access import analysis_principal
from api.hardening import read_upload, run_compute, validate_upload
from parsers.roster_parser import CSVRosterParser, PDFRosterParser
from parsers.validation import resolve_home_timezone, validate_roster
from parsers.reconciliation import review

router = APIRouter()

def parse_for_review(content, suffix, base):
    zone = resolve_home_timezone(base)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        path = tmp.name
    try:
        parser = PDFRosterParser(base, zone) if suffix == '.pdf' else CSVRosterParser(base, zone)
        method = parser.parse_pdf if suffix == '.pdf' else parser.parse_csv
        roster = method(path, 'preview', '2026-02')
        validate_roster(roster)
        return review(roster, parser, suffix)
    finally:
        os.unlink(path)

@router.post('/api/roster/preview')
async def preview(file: UploadFile = File(...), home_base: str = Form(...), principal=Depends(analysis_principal)):
    suffix = os.path.splitext(file.filename or '')[1].lower()
    if suffix not in ('.pdf', '.csv'):
        raise HTTPException(422, 'Choose a PDF or CSV roster.')
    content = await read_upload(file)
    validate_upload(content, suffix)
    try:
        return await run_compute(parse_for_review, content, suffix, home_base)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
