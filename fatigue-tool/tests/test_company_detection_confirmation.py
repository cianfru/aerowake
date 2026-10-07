"""Roster heuristics cannot authorise company membership or introduce operator branding."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import asyncio

from company.detection import detect_airline
from company.routes import get_or_create_company


def test_confident_operator_suggestion_is_neutral_and_requires_confirmation():
    result = detect_airline('crewlink', home_base='DOH', flight_numbers=['QR101', 'QR102'])
    public = result.to_dict()
    assert public['suggested_name'] == 'Operator QTR'
    assert public['suggested_icao'] == 'QTR'
    assert public['needs_confirmation'] is True


def test_unique_format_still_needs_explicit_membership_confirmation():
    result = detect_airline('easyjet')
    assert result.confidence >= 0.9
    assert result.to_dict()['needs_confirmation'] is True


def test_neutral_alias_preserves_an_existing_company_identity():
    existing = SimpleNamespace(id='existing-id', name='Stored operator name', icao_code='QTR')
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[
            SimpleNamespace(scalar_one_or_none=lambda: None),
            SimpleNamespace(scalar_one_or_none=lambda: existing),
        ]),
        flush=AsyncMock(),
    )
    result = asyncio.run(get_or_create_company(db, 'Operator QTR', 'QTR'))
    assert result is existing
    assert result.name == 'Stored operator name'
    db.flush.assert_not_called()
