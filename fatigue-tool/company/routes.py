"""
Company management API routes.

Endpoints:
  GET    /api/companies           — List all companies (admin only)
  POST   /api/companies           — Create a company (admin only)
  POST   /api/companies/confirm   — Pilot confirms detected airline
  GET    /api/companies/{id}      — Company detail (admin or member)
"""

import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Company, User
from db.session import get_db, is_db_available
from auth.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/companies", tags=["companies"])


# ── Pydantic models ─────────────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    name: str
    icao_code: Optional[str] = None


class CompanyResponse(BaseModel):
    id: str
    name: str
    icao_code: Optional[str] = None
    member_count: int = 0

    class Config:
        from_attributes = True


class CompanyConfirmRequest(BaseModel):
    """Pilot confirms (or corrects) the detected airline."""
    company_name: str
    company_icao: Optional[str] = None


class CompanyConfirmResponse(BaseModel):
    company_id: str
    company_name: str


# ── Helpers ──────────────────────────────────────────────────────────────────

async def get_or_create_company(
    db: AsyncSession,
    name: str,
    icao_code: Optional[str] = None,
) -> Company:
    """Get existing company by name, or create a new one."""
    result = await db.execute(
        select(Company).where(Company.name == name)
    )
    company = result.scalar_one_or_none()

    if company is None:
        company = Company(
            id=uuid.uuid4(),
            name=name,
            icao_code=icao_code,
        )
        db.add(company)
        await db.flush()
        logger.info(f"Created new company: {name} ({icao_code})")

    return company


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_companies(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all companies (admin only)."""
    if db is None:
        raise HTTPException(503, "Database not available")

    result = await db.execute(select(Company).order_by(Company.name))
    companies = result.scalars().all()

    # Count members per company
    output = []
    for c in companies:
        member_result = await db.execute(
            select(User.id).where(User.company_id == c.id)
        )
        count = len(member_result.all())
        output.append({
            'id': str(c.id),
            'name': c.name,
            'icao_code': c.icao_code,
            'member_count': count,
        })

    return output


@router.post("")
async def create_company(
    body: CompanyCreate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new company (admin only)."""
    if db is None:
        raise HTTPException(503, "Database not available")

    company = await get_or_create_company(db, body.name, body.icao_code)
    await db.commit()

    return {
        'id': str(company.id),
        'name': company.name,
        'icao_code': company.icao_code,
    }


@router.post("/confirm")
async def confirm_company(
    body: CompanyConfirmRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Pilot confirms their airline after first roster upload.

    Called by the frontend after the airline confirmation dialog.
    Creates the company if it doesn't exist yet, then assigns the user.
    """
    if db is None:
        raise HTTPException(503, "Database not available")

    company = await get_or_create_company(db, body.company_name, body.company_icao)

    # Assign user to company
    user.company_id = company.id
    await db.commit()

    logger.info(f"User {user.email} confirmed company: {company.name}")

    return CompanyConfirmResponse(
        company_id=str(company.id),
        company_name=company.name,
    )


@router.get("/{company_id}")
async def get_company(
    company_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get company detail (must be admin or a member)."""
    if db is None:
        raise HTTPException(503, "Database not available")

    result = await db.execute(
        select(Company).where(Company.id == uuid.UUID(company_id))
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(404, "Company not found")

    # Access check: admin or member
    if not user.is_admin and str(user.company_id) != company_id:
        raise HTTPException(403, "Not a member of this company")

    member_result = await db.execute(
        select(User.id).where(User.company_id == company.id)
    )
    count = len(member_result.all())

    return {
        'id': str(company.id),
        'name': company.name,
        'icao_code': company.icao_code,
        'member_count': count,
    }
