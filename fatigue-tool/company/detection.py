"""
Airline detection from roster signals.

Uses a combination of parser format, home base, flight prefixes, and
PDF text keywords to guess which airline a pilot belongs to.
Returns a confidence score so the frontend can decide whether to
auto-assign silently (high confidence) or ask for confirmation.

Usage:
    from company.detection import detect_airline
    result = detect_airline(
        roster_format='crewlink',
        home_base='DOH',
        raw_pdf_text='...',
        flight_numbers=['QR101', 'QR102'],
    )
    # result = {'name': 'Qatar Airways', 'icao': 'QTR', 'confidence': 0.95}
"""

import re
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class AirlineGuess:
    name: str
    icao: str
    confidence: float           # 0.0 - 1.0

    def to_dict(self) -> Dict:
        return {
            'suggested_name': self.name,
            'suggested_icao': self.icao,
            'confidence': self.confidence,
            'needs_confirmation': self.confidence < 0.9,
        }


# ── Known airline signatures ────────────────────────────────────────────────

# Each entry: (name, icao, format, bases, flight_prefix_re, text_keywords)
_AIRLINE_SIGNATURES = [
    {
        'name': 'easyJet',
        'icao': 'EZY',
        'format': 'easyjet',                    # Unique parser format = certain
        'bases': None,                            # Any base
        'flight_re': re.compile(r'^EJU\d{4}$'),
        'keywords': ['easyjet', 'eju'],
    },
    {
        'name': 'Qatar Airways',
        'icao': 'QTR',
        'format': 'crewlink',
        'bases': {'DOH'},
        'flight_re': re.compile(r'^QR\d{3,4}$'),
        'keywords': ['qatar airways', 'qatar'],
    },
    {
        'name': 'Emirates',
        'icao': 'UAE',
        'format': 'crewlink',
        'bases': {'DXB'},
        'flight_re': re.compile(r'^EK\d{3,4}$'),
        'keywords': ['emirates'],
    },
    {
        'name': 'Etihad Airways',
        'icao': 'ETD',
        'format': 'crewlink',
        'bases': {'AUH'},
        'flight_re': re.compile(r'^EY\d{3,4}$'),
        'keywords': ['etihad'],
    },
]


def detect_airline(
    roster_format: str,
    home_base: Optional[str] = None,
    raw_pdf_text: Optional[str] = None,
    flight_numbers: Optional[List[str]] = None,
) -> Optional[AirlineGuess]:
    """
    Detect which airline a roster belongs to using heuristic signals.

    Args:
        roster_format: Parser format identifier ('crewlink', 'easyjet', etc.)
        home_base: Pilot's home base IATA code (e.g. 'DOH')
        raw_pdf_text: Raw text extracted from the PDF (for keyword matching)
        flight_numbers: List of flight numbers found in the roster

    Returns:
        AirlineGuess with name, ICAO code, and confidence score (0.0-1.0).
        Returns None if no airline could be guessed.
    """
    best_guess: Optional[AirlineGuess] = None
    best_score: float = 0.0

    text_lower = (raw_pdf_text or '').lower()
    base_upper = (home_base or '').upper()
    flights = flight_numbers or []

    for sig in _AIRLINE_SIGNATURES:
        score = 0.0

        # ── Format match (strongest signal for unique formats) ────────
        if sig['format'] and roster_format == sig['format']:
            # Unique formats like 'easyjet' are nearly certain
            if roster_format != 'crewlink':
                score += 0.9  # Nearly certain
            else:
                score += 0.2  # CrewLink is shared by many airlines

        elif sig['format'] and roster_format != sig['format']:
            continue  # Wrong format family, skip entirely

        # ── Home base match ───────────────────────────────────────────
        if sig['bases'] and base_upper in sig['bases']:
            score += 0.4

        # ── Flight prefix match ───────────────────────────────────────
        if sig['flight_re'] and flights:
            prefix_matches = sum(1 for f in flights if sig['flight_re'].match(f))
            if prefix_matches > 0:
                ratio = prefix_matches / len(flights)
                score += 0.3 * ratio  # More matches = more confidence

        # ── Text keyword match (PDF header/body) ──────────────────────
        if sig['keywords'] and text_lower:
            for kw in sig['keywords']:
                if kw in text_lower:
                    score += 0.2
                    break  # One keyword match is enough

        # Cap at 1.0
        score = min(score, 1.0)

        if score > best_score:
            best_score = score
            best_guess = AirlineGuess(
                name=sig['name'],
                icao=sig['icao'],
                confidence=round(score, 2),
            )

    # Only return if we have a meaningful guess (> 0.3 threshold)
    if best_guess and best_guess.confidence >= 0.3:
        return best_guess

    return None


def extract_fleet_and_role(pilot_info: Dict) -> Dict[str, Optional[str]]:
    """
    Extract fleet (aircraft type) and pilot role from parsed pilot info.

    Handles both Qatar CrewLink format:
        pilot_aircraft = "A320", role parsed from "ID :134614 (DOH CP-A320)"
    And easyJet format:
        aircraft = "319", role = "CP"

    Returns: {'fleet': 'A320' or None, 'pilot_role': 'captain' or 'first_officer' or None}
    """
    fleet = None
    role = None

    # Fleet extraction
    aircraft = pilot_info.get('aircraft') or pilot_info.get('pilot_aircraft') or ''
    if aircraft:
        aircraft = aircraft.strip()
        # Normalize: "319" → "A319", "320" → "A320", "A350" stays "A350"
        if re.match(r'^\d{3}$', aircraft):
            fleet = f"A{aircraft}"
        elif re.match(r'^[A-Z]?\d{3}', aircraft):
            fleet = aircraft.upper()
        else:
            fleet = aircraft.upper()

    # Role extraction
    role_code = pilot_info.get('role', '').strip().upper()
    if role_code in ('CP', 'CA', 'CAPT', 'PIC'):
        role = 'captain'
    elif role_code in ('FO', 'F/O', 'SFO', 'COFO'):
        role = 'first_officer'
    elif role_code:
        role = role_code.lower()

    return {'fleet': fleet, 'pilot_role': role}
