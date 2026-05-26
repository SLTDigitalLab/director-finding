from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from difflib import SequenceMatcher
from . import models


class ConflictError(Exception):
    """Raised when an update would violate a unique constraint or business rule."""


def _clean_optional_str(value) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def normalize_nic(nic: str | None) -> str | None:
    """Canonical NIC/passport for comparison (spacing-insensitive, upper)."""
    if nic is None or not str(nic).strip():
        return None
    return "".join(str(nic).split()).upper() or None


def normalize_email(email) -> str | None:
    if email is None or not str(email).strip():
        return None
    return str(email).strip().lower()


def _director_by_normalized_nic(db: Session, nic_raw) -> models.Director | None:
    key = normalize_nic(nic_raw)
    if not key:
        return None
    for d in db.query(models.Director).filter(models.Director.nic_passport.isnot(None)):
        if normalize_nic(d.nic_passport) == key:
            return d
    return None


def _director_by_normalized_email(db: Session, email_raw) -> models.Director | None:
    key = normalize_email(email_raw)
    if not key:
        return None
    rows = (
        db.query(models.Director)
        .filter(models.Director.email.isnot(None))
        .filter(func.lower(func.trim(models.Director.email)) == key)
        .all()
    )
    if len(rows) == 1:
        return rows[0]
    if not rows:
        for d in db.query(models.Director).filter(models.Director.email.isnot(None)):
            if normalize_email(d.email) == key:
                return d
    return None


def _director_by_fuzzy_name(db: Session, name: str, threshold: float = 0.968) -> models.Director | None:
    """Last-resort match for long names with OCR drift (e.g. one character typo)."""
    if len(name) < 16:
        return None
    best = None
    best_r = 0.0
    for d in db.query(models.Director).all():
        r = SequenceMatcher(None, name, d.full_name).ratio()
        if r > best_r:
            best_r, best = r, d
    if best is not None and best_r >= threshold:
        return best
    return None


def resolve_director_match(db: Session, d: dict) -> models.Director | None:
    """
    Find an existing director for this payload: normalized NIC, exact name, email, then fuzzy name.
    Used so repeat uploads with minor OCR differences reuse one row.
    """
    nic = d.get("nic_passport")
    name = (d.get("full_name") or "").strip().upper()

    hit = _director_by_normalized_nic(db, nic)
    if hit:
        return hit
    if name:
        hit = db.query(models.Director).filter(models.Director.full_name == name).first()
        if hit:
            return hit
    hit = _director_by_normalized_email(db, d.get("email"))
    if hit:
        return hit
    if name:
        hit = _director_by_fuzzy_name(db, name)
        if hit:
            return hit
    return None


def get_company_by_normalized_name(db: Session, normalized_name: str) -> models.Company | None:
    return (
        db.query(models.Company).filter(models.Company.name == normalized_name).first()
    )


def get_company_by_normalized_name_with_relations(db: Session, normalized_name: str) -> models.Company | None:
    """Company with directors and each director's companies (for extraction preview)."""
    return (
        db.query(models.Company)
        .options(
            joinedload(models.Company.directors).joinedload(models.Director.companies),
        )
        .filter(models.Company.name == normalized_name)
        .first()
    )


def find_director_for_pdf_row(db: Session, pdf_row: dict) -> models.Director | None:
    """Match PDF row to an existing director without creating. Eager-loads companies."""
    d = resolve_director_match(db, pdf_row)
    if not d:
        return None
    return (
        db.query(models.Director)
        .options(joinedload(models.Director.companies))
        .filter(models.Director.id == d.id)
        .first()
    )


def get_or_create_company(db: Session, data: dict) -> models.Company:
    name = data.get("company_name", "UNKNOWN").strip().upper()
    company = db.query(models.Company).filter(models.Company.name == name).first()
    if not company:
        company = models.Company(
            name=name,
            company_type=data.get("company_type"),
            registered_address=data.get("registered_address"),
            name_approval_number=data.get("name_approval_number"),
        )
        db.add(company)
        db.commit()
        db.refresh(company)
    return company


def get_or_create_director(db: Session, d: dict) -> models.Director:
    existing = resolve_director_match(db, d)
    if existing:
        return existing

    nic = d.get("nic_passport", "").strip() if d.get("nic_passport") else None
    name = d.get("full_name", "").strip().upper()

    director = models.Director(
        full_name=name,
        nic_passport=nic,
        residential_address=d.get("residential_address"),
        email=d.get("email"),
    )
    db.add(director)
    db.commit()
    db.refresh(director)
    return director


def link_director_to_company(db: Session, director_id: int, company_id: int):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    director = db.query(models.Director).filter(models.Director.id == director_id).first()
    if director and company and director not in company.directors:
        company.directors.append(director)
        db.commit()


def get_all_companies_with_directors(db: Session):
    return (
        db.query(models.Company)
        .options(joinedload(models.Company.directors))
        .order_by(models.Company.name)
        .all()
    )


def get_all_directors_with_companies(db: Session):
    return (
        db.query(models.Director)
        .options(joinedload(models.Director.companies))
        .order_by(models.Director.full_name)
        .all()
    )


def get_company_with_directors(db: Session, company_id: int) -> models.Company | None:
    return (
        db.query(models.Company)
        .options(joinedload(models.Company.directors))
        .filter(models.Company.id == company_id)
        .first()
    )


def get_director_with_companies(db: Session, director_id: int) -> models.Director | None:
    return (
        db.query(models.Director)
        .options(joinedload(models.Director.companies))
        .filter(models.Director.id == director_id)
        .first()
    )


def update_company(db: Session, company_id: int, updates: dict) -> models.Company | None:
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        return None

    if "name" in updates:
        new_name = (updates["name"] or "").strip().upper()
        if not new_name:
            raise ConflictError("Company name cannot be empty.")
        if new_name != company.name:
            taken = (
                db.query(models.Company)
                .filter(models.Company.name == new_name, models.Company.id != company_id)
                .first()
            )
            if taken:
                raise ConflictError("A company with this name already exists.")
            company.name = new_name

    if "company_type" in updates:
        company.company_type = _clean_optional_str(updates["company_type"])
    if "registered_address" in updates:
        company.registered_address = _clean_optional_str(updates["registered_address"])
    if "name_approval_number" in updates:
        company.name_approval_number = _clean_optional_str(updates["name_approval_number"])

    db.commit()
    return get_company_with_directors(db, company_id)


def update_director(db: Session, director_id: int, updates: dict) -> models.Director | None:
    director = db.query(models.Director).filter(models.Director.id == director_id).first()
    if not director:
        return None

    if "full_name" in updates:
        name = (updates["full_name"] or "").strip().upper()
        if not name:
            raise ConflictError("Director full name cannot be empty.")
        director.full_name = name

    if "nic_passport" in updates:
        raw = updates["nic_passport"]
        nic_stored = _clean_optional_str(raw)
        key = normalize_nic(raw)
        if key:
            existing = _director_by_normalized_nic(db, raw)
            if existing and existing.id != director_id:
                raise ConflictError("Another director already has this NIC or passport number.")
        director.nic_passport = nic_stored

    if "residential_address" in updates:
        director.residential_address = _clean_optional_str(updates["residential_address"])
    if "email" in updates:
        email = _clean_optional_str(updates["email"])
        director.email = normalize_email(email) if email else None

    db.commit()
    return get_director_with_companies(db, director_id)


def delete_company(db: Session, company_id: int):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if company:
        db.delete(company)
        db.commit()


def delete_director(db: Session, director_id: int):
    director = db.query(models.Director).filter(models.Director.id == director_id).first()
    if director:
        db.delete(director)
        db.commit()
