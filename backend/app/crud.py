from sqlalchemy.orm import Session, joinedload
import re
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
    s = str(nic).strip()
    # Allow inputs like: "Z 4212133 (India)" -> key "Z4212133"
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)
    s = "".join(s.split()).upper()
    return s or None


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


def format_nic_for_storage(nic_raw) -> str | None:
    """Trim NIC/passport for storage; comparison uses normalize_nic()."""
    return _clean_optional_str(nic_raw)


def find_director_by_nic(db: Session, nic_raw) -> models.Director | None:
    """Find a director by NIC or passport only (names may change; IDs do not)."""
    return _director_by_normalized_nic(db, nic_raw)


def find_director_by_name_email(
    db: Session, name: str | None, email: str | None
) -> models.Director | None:
    """Find a director by normalized full name + email (fallback when NIC/passport is absent)."""
    norm_name = (name or "").strip().upper()
    norm_email = normalize_email(email)
    if not norm_name or not norm_email:
        return None
    return (
        db.query(models.Director)
        .filter(
            models.Director.full_name == norm_name,
            models.Director.email == norm_email,
        )
        .first()
    )


def find_director_in_company_by_name(
    db: Session,
    company_name_raw: str | None,
    name: str | None,
) -> models.Director | None:
    """
    Safer fallback for no-ID rows:
    match by exact normalized full name, but only inside the specific company.
    """
    company_key = normalize_company_name(company_name_raw)
    norm_name = (name or "").strip().upper()
    if not company_key or not norm_name:
        return None

    company = (
        db.query(models.Company)
        .options(joinedload(models.Company.directors))
        .filter(models.Company.name == company_key)
        .first()
    )
    if not company:
        return None

    for d in company.directors:
        if (d.full_name or "").strip().upper() == norm_name:
            return d
    return None


def resolve_director_match(db: Session, d: dict) -> models.Director | None:
    """Match an existing director: NIC/passport first, then name+email fallback."""
    nic = d.get("nic_passport")
    if normalize_nic(nic):
        return find_director_by_nic(db, nic)
    return find_director_by_name_email(db, d.get("full_name"), d.get("email"))


def merge_director_from_pdf(director: models.Director, d: dict) -> bool:
    """
    Apply PDF fields onto an existing director row.
    Returns True if the legal name on file changed (same NIC, different name).
    """
    name = (d.get("full_name") or "").strip().upper()
    name_changed = bool(name and director.full_name != name)
    if name:
        director.full_name = name

    nic_stored = format_nic_for_storage(d.get("nic_passport"))
    if nic_stored:
        director.nic_passport = nic_stored
    if "id_type" in d:
        director.id_type = _clean_optional_str(d.get("id_type"))
    if "id_country" in d:
        director.id_country = _clean_optional_str(d.get("id_country"))

    if "residential_address" in d:
        director.residential_address = _clean_optional_str(d.get("residential_address"))
    if "email" in d:
        email = _clean_optional_str(d.get("email"))
        director.email = normalize_email(email) if email else None

    return name_changed


def get_company_by_normalized_name(
    db: Session, normalized_name: str
) -> models.Company | None:
    return (
        db.query(models.Company).filter(models.Company.name == normalized_name).first()
    )


def get_company_by_normalized_name_with_relations(
    db: Session, normalized_name: str
) -> models.Company | None:
    """Company with directors and each director's companies (for extraction preview)."""
    return (
        db.query(models.Company)
        .options(
            joinedload(models.Company.directors).joinedload(models.Director.companies),
        )
        .filter(models.Company.name == normalized_name)
        .first()
    )


def find_director_for_pdf_row(
    db: Session,
    pdf_row: dict,
    company_name_hint: str | None = None,
) -> models.Director | None:
    """Match PDF row to existing director (NIC > name+email > same-company name fallback)."""
    d = resolve_director_match(db, pdf_row)
    if not d and not normalize_nic(pdf_row.get("nic_passport")):
        d = find_director_in_company_by_name(
            db, company_name_hint, pdf_row.get("full_name")
        )
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

    bc = find_blacklisted_company_by_name(db, company.name)
    company.is_blacklisted = bc is not None
    company.blacklist_reason = bc.reason if bc else None
    company.blacklist_notes = bc.notes if bc else None
    company.is_explicit = bc.is_explicit if bc else False
    return company


def get_or_create_director(
    db: Session,
    d: dict,
    company_name_hint: str | None = None,
) -> models.Director:
    nic_stored = format_nic_for_storage(d.get("nic_passport"))
    has_nic = bool(normalize_nic(nic_stored))

    if has_nic:
        existing = find_director_by_nic(db, nic_stored)
    else:
        existing = find_director_by_name_email(db, d.get("full_name"), d.get("email"))
        if not existing:
            existing = find_director_in_company_by_name(
                db, company_name_hint, d.get("full_name")
            )

    if existing:
        # If this form provides a NIC for a previously no-ID director, fill it in
        if has_nic and not normalize_nic(existing.nic_passport):
            existing.nic_passport = nic_stored
        merge_director_from_pdf(existing, d)
        db.commit()
        db.refresh(existing)
        return existing

    name = (d.get("full_name") or "").strip().upper() or "UNKNOWN"
    email = _clean_optional_str(d.get("email"))

    director = models.Director(
        full_name=name,
        nic_passport=nic_stored if has_nic else None,
        id_type=_clean_optional_str(d.get("id_type")),
        id_country=_clean_optional_str(d.get("id_country")),
        residential_address=_clean_optional_str(d.get("residential_address")),
        email=normalize_email(email) if email else None,
    )
    db.add(director)
    db.commit()
    db.refresh(director)
    return director


def link_director_to_company(db: Session, director_id: int, company_id: int):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    director = (
        db.query(models.Director).filter(models.Director.id == director_id).first()
    )
    if director and company and director not in company.directors:
        company.directors.append(director)
        db.flush()
        company_blacklist = find_blacklisted_company_by_name(db, company.name)
        if company_blacklist:
            # Company is blacklisted - blacklist this director (explicit, no cascade)
            director.is_blacklisted = True
            director.blacklist_reason = company_blacklist.reason
            director.blacklist_notes = company_blacklist.notes
            director.blacklist_company_name = normalize_company_name(company.name)
            director.blacklist_auto = False
        if director.is_blacklisted:
            # Director is already blacklisted - no cascade needed
            pass
        db.commit()


def get_all_companies_with_directors(db: Session):
    companies = (
        db.query(models.Company)
        .options(joinedload(models.Company.directors))
        .order_by(models.Company.name)
        .all()
    )
    bl_companies = {
        bc.name.strip().upper(): bc for bc in db.query(models.BlacklistedCompany).all()
    }
    related_names = {
        rc.company_name.strip().upper()
        for rc in db.query(models.RelatedCompany)
        .filter(models.RelatedCompany.status == "highlighted")
        .all()
    }
    for c in companies:
        bc = bl_companies.get(c.name.strip().upper())
        c.is_blacklisted = bc is not None
        c.blacklist_reason = bc.reason if bc else None
        c.blacklist_notes = bc.notes if bc else None
        c.is_explicit = bc.is_explicit if bc else False
        c.is_related = c.name.strip().upper() in related_names
    return companies


def get_all_directors_with_companies(db: Session, status: str | None = None):
    q = db.query(models.Director).options(joinedload(models.Director.companies))
    if status == "blacklisted":
        q = q.filter(models.Director.is_blacklisted.is_(True))
    elif status == "active":
        q = q.filter(models.Director.is_blacklisted.is_(False))
    return q.order_by(models.Director.full_name).all()


def get_company_with_directors(db: Session, company_id: int) -> models.Company | None:
    c = (
        db.query(models.Company)
        .options(joinedload(models.Company.directors))
        .filter(models.Company.id == company_id)
        .first()
    )
    if c:
        bc = find_blacklisted_company_by_name(db, c.name)
        c.is_blacklisted = bc is not None
        c.blacklist_reason = bc.reason if bc else None
        c.blacklist_notes = bc.notes if bc else None
        c.is_explicit = bc.is_explicit if bc else False
    return c


def get_director_with_companies(
    db: Session, director_id: int
) -> models.Director | None:
    return (
        db.query(models.Director)
        .options(joinedload(models.Director.companies))
        .filter(models.Director.id == director_id)
        .first()
    )


def update_company(
    db: Session, company_id: int, updates: dict
) -> models.Company | None:
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
                .filter(
                    models.Company.name == new_name, models.Company.id != company_id
                )
                .first()
            )
            if taken:
                raise ConflictError("A company with this name already exists.")

            old_name = company.name
            company.name = new_name

            # Keep blacklisted_companies in sync with the rename so the company
            # doesn't silently appear unblacklisted after renaming.
            bc = _blacklisted_company_by_normalized_name(db, old_name)
            if bc:
                bc.name = new_name

            # Update directors whose blacklist_company_name referenced the old name.
            affected = (
                db.query(models.Director)
                .filter(models.Director.blacklist_company_name == old_name)
                .all()
            )
            for d in affected:
                d.blacklist_company_name = new_name

    if "company_type" in updates:
        company.company_type = _clean_optional_str(updates["company_type"])
    if "registered_address" in updates:
        company.registered_address = _clean_optional_str(updates["registered_address"])
    if "name_approval_number" in updates:
        company.name_approval_number = _clean_optional_str(
            updates["name_approval_number"]
        )

    db.commit()
    return get_company_with_directors(db, company_id)


def create_company(db: Session, data: dict) -> models.Company:
    name = (data.get("name") or "").strip().upper()
    if not name:
        raise ConflictError("Company name is required.")
    if db.query(models.Company).filter(models.Company.name == name).first():
        raise ConflictError("A company with this name already exists.")

    company = models.Company(
        name=name,
        company_type=_clean_optional_str(data.get("company_type")),
        registered_address=_clean_optional_str(data.get("registered_address")),
        name_approval_number=_clean_optional_str(data.get("name_approval_number")),
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return get_company_with_directors(db, company.id)


def _apply_blacklist_fields(db: Session, director: models.Director, data: dict) -> None:
    """Set blacklist status and sync company blacklist."""
    if "is_blacklisted" in data:
        director.is_blacklisted = bool(data["is_blacklisted"])

    if "blacklist_company_name" in data:
        director.blacklist_company_name = normalize_company_name(
            data["blacklist_company_name"]
        )
    if "blacklist_reason" in data:
        director.blacklist_reason = _clean_optional_str(data["blacklist_reason"])
    if "blacklist_notes" in data:
        director.blacklist_notes = _clean_optional_str(data["blacklist_notes"])

    if director.is_blacklisted:
        # Explicit blacklist via form — mark as non-auto
        director.blacklist_auto = False

        company_key = director.blacklist_company_name or normalize_company_name(
            data.get("blacklist_company_name")
        )
        if not company_key and director.companies:
            company_key = normalize_company_name(director.companies[0].name)
        if not company_key:
            raise ConflictError(
                "Company name is required when blacklisting a director (their company is blacklisted too)."
            )
        director.blacklist_company_name = company_key
        db.flush()
    elif "is_blacklisted" in data and not director.is_blacklisted:
        # Mirror the guard from unblacklist_director: refuse to clear an
        # auto-blacklisted director while its trigger company is still blacklisted.
        if director.blacklist_auto:
            trigger_company = normalize_company_name(director.blacklist_company_name)
            if trigger_company:
                trigger_blacklisted = (
                    find_blacklisted_company_by_name(db, trigger_company) is not None
                )
            else:
                trigger_blacklisted = any(
                    find_blacklisted_company_by_name(db, c.name) is not None
                    for c in director.companies
                )
            if trigger_blacklisted:
                raise ConflictError(
                    "This director is auto-blacklisted by a blacklisted company. "
                    "Unblacklist the company or source director first."
                )

        director.blacklist_company_name = None
        director.blacklist_reason = None
        director.blacklist_notes = None
        director.blacklist_auto = False

        db.flush()


def create_director(db: Session, data: dict) -> models.Director:
    company_id = data.get("company_id")
    company = (
        db.query(models.Company)
        .options(joinedload(models.Company.directors))
        .filter(models.Company.id == company_id)
        .first()
    )
    if not company:
        raise ConflictError("Select a valid company before adding a director.")

    nic_stored = format_nic_for_storage(data.get("nic_passport"))
    has_nic = bool(normalize_nic(nic_stored))
    name = (data.get("full_name") or "").strip().upper()
    if not name:
        raise ConflictError("Full name is required.")

    if has_nic:
        director = find_director_by_nic(db, nic_stored)
    else:
        director = find_director_by_name_email(
            db, data.get("full_name"), data.get("email")
        )
        if not director:
            director = find_director_in_company_by_name(
                db, company.name, data.get("full_name")
            )

    existing_director = director is not None
    if director:
        if director not in company.directors:
            company.directors.append(director)
        merge_director_from_pdf(director, data)
    else:
        email = _clean_optional_str(data.get("email"))
        director = models.Director(
            full_name=name,
            nic_passport=nic_stored if has_nic else None,
            id_type=_clean_optional_str(data.get("id_type")),
            id_country=_clean_optional_str(data.get("id_country")),
            residential_address=_clean_optional_str(data.get("residential_address")),
            email=normalize_email(email) if email else None,
            is_blacklisted=bool(data.get("is_blacklisted")),
            blacklist_company_name=normalize_company_name(
                data.get("blacklist_company_name")
            ),
            blacklist_reason=_clean_optional_str(data.get("blacklist_reason")),
            blacklist_notes=_clean_optional_str(data.get("blacklist_notes")),
        )
        company.directors.append(director)
        db.add(director)

    db.flush()
    data = dict(data)
    if data.get("is_blacklisted") and not data.get("blacklist_company_name"):
        data["blacklist_company_name"] = company.name
    if data.get("is_blacklisted"):
        _apply_blacklist_fields(db, director, data)
    db.commit()
    db.refresh(director)
    return get_director_with_companies(db, director.id)


def update_director(
    db: Session, director_id: int, updates: dict
) -> models.Director | None:
    director = (
        db.query(models.Director)
        .options(joinedload(models.Director.companies))
        .filter(models.Director.id == director_id)
        .first()
    )
    if not director:
        return None

    if "full_name" in updates:
        name = (updates["full_name"] or "").strip().upper()
        if not name:
            raise ConflictError("Director full name cannot be empty.")
        director.full_name = name

    if "nic_passport" in updates:
        raw = updates["nic_passport"]
        nic_stored = format_nic_for_storage(raw)
        key = normalize_nic(raw)
        if key:
            existing = find_director_by_nic(db, raw)
            if existing and existing.id != director_id:
                raise ConflictError(
                    "Another director already has this NIC or passport number."
                )
        director.nic_passport = nic_stored
    if "id_type" in updates:
        director.id_type = _clean_optional_str(updates["id_type"])
    if "id_country" in updates:
        director.id_country = _clean_optional_str(updates["id_country"])

    if "residential_address" in updates:
        director.residential_address = _clean_optional_str(
            updates["residential_address"]
        )
    if "email" in updates:
        email = _clean_optional_str(updates["email"])
        director.email = normalize_email(email) if email else None

    blacklist_keys = {
        "is_blacklisted",
        "blacklist_company_name",
        "blacklist_reason",
        "blacklist_notes",
    }
    if blacklist_keys & set(updates.keys()):
        _apply_blacklist_fields(db, director, updates)

    db.commit()
    return get_director_with_companies(db, director_id)


def delete_company(db: Session, company_id: int):
    company = (
        db.query(models.Company)
        .options(joinedload(models.Company.directors))
        .filter(models.Company.id == company_id)
        .first()
    )
    if not company:
        return

    # Remove the matching blacklisted_companies row (no FK, so it won't cascade).
    bc = find_blacklisted_company_by_name(db, company.name)
    if bc:
        db.delete(bc)

    db.delete(company)
    db.flush()
    db.commit()


def delete_director(db: Session, director_id: int):
    director = (
        db.query(models.Director)
        .options(joinedload(models.Director.companies))
        .filter(models.Director.id == director_id)
        .first()
    )
    if not director:
        return

    was_blacklisted = director.is_blacklisted
    db.delete(director)
    db.flush()

    db.commit()


def normalize_company_name(name: str | None) -> str | None:
    if name is None or not str(name).strip():
        return None
    return str(name).strip().upper()


def _blacklisted_company_by_normalized_name(
    db: Session, company_name_raw
) -> models.BlacklistedCompany | None:
    key = normalize_company_name(company_name_raw)
    if not key:
        return None
    for row in db.query(models.BlacklistedCompany):
        if normalize_company_name(row.name) == key:
            return row
    return None


def find_blacklisted_company_by_name(
    db: Session, company_name_raw
) -> models.BlacklistedCompany | None:
    return _blacklisted_company_by_normalized_name(db, company_name_raw)


def ensure_blacklisted_company(
    db: Session, company_name_raw, reason: str | None = None, is_explicit: bool = False
) -> models.BlacklistedCompany:
    """Add company to blacklist (idempotent). Called when a director is blacklisted."""
    key = normalize_company_name(company_name_raw)
    if not key:
        raise ConflictError(
            "Company name is required. Blacklisting a director also blacklists their company."
        )
    existing = _blacklisted_company_by_normalized_name(db, key)
    reason_clean = _clean_optional_str(reason)
    if existing:
        if reason_clean and not existing.reason:
            existing.reason = reason_clean
        if is_explicit and not existing.is_explicit:
            existing.is_explicit = True
        return existing
    entry = models.BlacklistedCompany(
        name=key, reason=reason_clean, is_explicit=is_explicit
    )
    db.add(entry)
    db.flush()  # Make visible to subsequent queries within the same transaction
    return entry


def evaluate_company_blacklist_removal(
    db: Session,
    company_name: str,
    _visited: set[str] | None = None,
) -> None:
    """
    Remove company from blacklist if no blacklisted directors remain and not explicit.
    Also cascades: unblacklists auto-directors whose only reason was this company,
    then recursively evaluates their other companies.
    """
    normalized = normalize_company_name(company_name)
    if not normalized:
        return

    if _visited is None:
        _visited = set()
    if normalized in _visited:
        return

    bc = find_blacklisted_company_by_name(db, normalized)
    if not bc or bc.is_explicit:
        return

    # Check if any blacklisted directors remain for reasons OTHER than this company's auto-cascade
    companies = (
        db.query(models.Company)
        .options(
            joinedload(models.Company.directors).joinedload(models.Director.companies)
        )
        .filter(models.Company.name == normalized)
        .all()
    )
    for co in companies:
        for d in co.directors:
            if not d.is_blacklisted:
                continue
            # Auto-blacklisted directors whose trigger is THIS company will be cleaned up below —
            # they should not block removal. All other blacklisted directors (explicit or auto from
            # a different company) do keep the company blacklisted.
            if (
                d.blacklist_auto
                and normalize_company_name(d.blacklist_company_name) == normalized
            ):
                continue
            return  # Has an independently-blacklisted director; keep company on blacklist

    # Safe to remove
    _visited.add(normalized)
    db.delete(bc)
    db.flush()

    # Cascade: unblacklist auto-directors whose blacklist_company_name matches this company
    for co in companies:
        for d in co.directors:
            if not d.is_blacklisted or not d.blacklist_auto:
                continue
            if normalize_company_name(d.blacklist_company_name) != normalized:
                continue
            # Only unblacklist if this director has no other blacklisted companies
            other_bl = any(
                normalize_company_name(c.name) != normalized
                and find_blacklisted_company_by_name(db, c.name) is not None
                for c in d.companies
            )
            if not other_bl:
                other_cos = [
                    c.name
                    for c in d.companies
                    if normalize_company_name(c.name) != normalized
                ]
                d.is_blacklisted = False
                d.blacklist_reason = None
                d.blacklist_notes = None
                d.blacklist_company_name = None
                d.blacklist_auto = False
                db.flush()
                for other_co_name in other_cos:
                    evaluate_company_blacklist_removal(db, other_co_name, _visited)


def unlink_director_from_company(
    db: Session, company_id: int, director_id: int
) -> bool:
    """Remove a director from a company, and evaluate the company for blacklist removal if needed."""
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    director = (
        db.query(models.Director).filter(models.Director.id == director_id).first()
    )
    if company and director and director in company.directors:
        company.directors.remove(director)
        db.flush()

        if director.is_blacklisted:
            evaluate_company_blacklist_removal(db, company.name)

        db.commit()
        return True
    return False


def get_all_blacklisted_companies(db: Session):
    rows = (
        db.query(models.BlacklistedCompany)
        .order_by(models.BlacklistedCompany.name)
        .all()
    )
    for row in rows:
        co = db.query(models.Company).filter(models.Company.name == row.name).first()
        row.company_id = co.id if co else None
    return rows


def blacklist_director(
    db: Session, director_id: int, reason: str, notes: str | None
) -> models.Director | None:
    director = (
        db.query(models.Director)
        .options(joinedload(models.Director.companies))
        .filter(models.Director.id == director_id)
        .first()
    )
    if not director:
        return None

    # Explicitly blacklist this director (not auto)
    director.is_blacklisted = True
    director.blacklist_reason = _clean_optional_str(reason)
    director.blacklist_notes = _clean_optional_str(notes)
    director.blacklist_auto = False

    # Set reference company name from first linked company if not already set
    if not director.blacklist_company_name and director.companies:
        director.blacklist_company_name = normalize_company_name(
            director.companies[0].name
        )

    db.flush()
    db.commit()
    db.refresh(director)
    return director


def unblacklist_director(db: Session, director_id: int) -> models.Director | None:
    director = (
        db.query(models.Director)
        .options(joinedload(models.Director.companies))
        .filter(models.Director.id == director_id)
        .first()
    )
    if not director:
        return None

    # Guard: auto-blacklisted directors must be cleared via their company/source chain.
    if director.blacklist_auto:
        trigger_company = normalize_company_name(director.blacklist_company_name)
        if trigger_company:
            trigger_blacklisted = (
                find_blacklisted_company_by_name(db, trigger_company) is not None
            )
        else:
            trigger_blacklisted = any(
                find_blacklisted_company_by_name(db, c.name) is not None
                for c in director.companies
            )
        if trigger_blacklisted:
            raise ConflictError(
                "This director is auto-blacklisted by a blacklisted company. "
                "Unblacklist the company or source director first."
            )

    director.is_blacklisted = False
    director.blacklist_reason = None
    director.blacklist_notes = None
    director.blacklist_company_name = None
    director.blacklist_auto = False

    db.flush()
    db.commit()
    db.refresh(director)
    return director


def blacklist_company(
    db: Session, company_id: int, reason: str, notes: str | None
) -> models.Company | None:
    """
    Company-first blacklist flow:
    1. Create BlacklistedCompany (is_explicit=True)
    2. Blacklist all directors of this company (explicit, blacklist_auto=False)
    3. Find related companies sharing those directors (excluding whitelisted)
    4. Create RelatedCompany entries with status=highlighted
    """
    company = (
        db.query(models.Company)
        .options(
            joinedload(models.Company.directors).joinedload(models.Director.companies)
        )
        .filter(models.Company.id == company_id)
        .first()
    )
    if not company:
        return None

    key = normalize_company_name(company.name)
    reason_clean = _clean_optional_str(reason)
    notes_clean = _clean_optional_str(notes)

    # 1. Create/update BlacklistedCompany as explicit
    bc = _blacklisted_company_by_normalized_name(db, key)
    if bc:
        bc.is_explicit = True
        if reason_clean:
            bc.reason = reason_clean
        if notes is not None:
            bc.notes = notes_clean
    else:
        bc = models.BlacklistedCompany(
            name=key,
            reason=reason_clean,
            notes=notes_clean,
            is_explicit=True,
        )
        db.add(bc)

    db.flush()

    # 2. Blacklist all directors of this company (explicit)
    blacklisted_director_ids = []
    for director in company.directors:
        director.is_blacklisted = True
        director.blacklist_reason = reason_clean
        director.blacklist_notes = notes_clean
        director.blacklist_company_name = key
        director.blacklist_auto = False
        blacklisted_director_ids.append(director.id)

    db.flush()

    # 3. Find related companies sharing these directors (exclude whitelisted)
    if blacklisted_director_ids:
        related_companies = (
            db.query(models.Company)
            .options(joinedload(models.Company.directors))
            .join(models.Company.directors)
            .filter(models.Director.id.in_(blacklisted_director_ids))
            .filter(models.Company.name != company.name)
            .filter(models.Company.is_whitelisted == False)
            .distinct()
            .all()
        )

        # 4. Create RelatedCompany entries for each related company
        for related_co in related_companies:
            # Find shared directors
            shared_directors = [
                d
                for d in related_co.directors
                if d.id in blacklisted_director_ids and d.is_blacklisted
            ]
            shared_ids = [d.id for d in shared_directors]

            if shared_ids:
                # Upsert RelatedCompany
                existing_rc = (
                    db.query(models.RelatedCompany)
                    .filter(
                        models.RelatedCompany.source_company_name == key,
                        models.RelatedCompany.company_name == related_co.name,
                    )
                    .first()
                )
                if existing_rc:
                    existing_rc.shared_director_ids = shared_ids
                    existing_rc.status = "highlighted"
                else:
                    rc = models.RelatedCompany(
                        company_name=related_co.name,
                        source_company_name=key,
                        shared_director_ids=shared_ids,
                        status="highlighted",
                    )
                    db.add(rc)

    db.commit()
    return get_company_with_directors(db, company_id)


def unblacklist_company(db: Session, company_id: int) -> models.Company | None:
    """
    Explicitly clear a company's blacklist. Returns None if the company is not
    currently *explicitly* blacklisted (so the route can surface a 400), and the
    refreshed company otherwise.

    Since cascade blacklisting is removed, we simply delete the BlacklistedCompany row.
    Related directors remain blacklisted unless explicitly unblacklisted.
    """
    company = (
        db.query(models.Company)
        .options(
            joinedload(models.Company.directors).joinedload(models.Director.companies)
        )
        .filter(models.Company.id == company_id)
        .first()
    )
    if not company:
        return None

    bc = find_blacklisted_company_by_name(db, company.name)
    if not (bc and bc.is_explicit):
        # Signal "not explicitly blacklisted" to the route.
        return None

    db.delete(bc)
    db.flush()
    db.commit()
    return get_company_with_directors(db, company_id)


def get_registry_companies_for_nic(db: Session, nic_raw) -> list[str]:
    """Company names linked to this NIC in the registry (for form suggestions)."""
    director = find_director_by_nic(db, nic_raw)
    if not director:
        return []
    d = get_director_with_companies(db, director.id)
    if not d:
        return []
    return sorted({c.name for c in d.companies})


def find_blacklisted_by_nic(db: Session, nic_raw) -> models.Director | None:
    director = find_director_by_nic(db, nic_raw)
    if director and director.is_blacklisted:
        return director
    return None


def get_related_companies(db: Session) -> list[models.RelatedCompany]:
    """Fetch all highlighted related companies with their shared blacklisted directors."""
    related = (
        db.query(models.RelatedCompany)
        .filter(models.RelatedCompany.status == "highlighted")
        .order_by(models.RelatedCompany.created_at.desc())
        .all()
    )
    # Populate shared_directors for each related company
    for rc in related:
        shared_ids = rc.shared_director_ids or []
        if shared_ids:
            directors = (
                db.query(models.Director)
                .filter(models.Director.id.in_(shared_ids))
                .filter(models.Director.is_blacklisted == True)
                .all()
            )
            rc.shared_directors = directors
        else:
            rc.shared_directors = []
    return related


def validate_form20_directors(
    db: Session, company_name: str, directors_list: list[dict]
) -> dict:
    """
    Validate Form 1/20 directors against blacklist.
    Returns warnings only - no blocking.
    """
    blacklisted_directors = []
    for d in directors_list:
        nic = d.get("nic_passport")
        if nic:
            bl = find_blacklisted_by_nic(db, nic)
            if bl:
                blacklisted_directors.append(
                    {
                        "nic_passport": nic,
                        "full_name": d.get("full_name"),
                        "blacklist_reason": bl.blacklist_reason,
                        "blacklist_company_name": bl.blacklist_company_name,
                    }
                )

    warning_count = len(blacklisted_directors)
    if warning_count > 0:
        message = (
            f"{warning_count} director{'s' if warning_count != 1 else ''} "
            f"on this form match blacklisted records."
        )
    else:
        message = "No blacklisted directors found on this form."

    return {
        "company_name": company_name,
        "total_directors": len(directors_list),
        "blacklisted_directors": blacklisted_directors,
        "warning_count": warning_count,
        "message": message,
    }


def whitelist_company(
    db: Session, company_id: int, reason: str | None = None, notes: str | None = None
) -> models.Company | None:
    """Mark a company as whitelisted. Also updates related companies status to whitelisted."""
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        return None

    company.is_whitelisted = True
    company.whitelist_reason = _clean_optional_str(reason)
    company.whitelist_notes = _clean_optional_str(notes)

    # Update related companies status to whitelisted
    related = (
        db.query(models.RelatedCompany)
        .filter(models.RelatedCompany.company_name == company.name)
        .all()
    )
    for rc in related:
        rc.status = "whitelisted"

    db.commit()
    return get_company_with_directors(db, company_id)


def unwhitelist_company(db: Session, company_id: int) -> models.Company | None:
    """Remove whitelist status from a company."""
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        return None

    company.is_whitelisted = False
    company.whitelist_reason = None
    company.whitelist_notes = None

    # Update related companies status back to highlighted
    related = (
        db.query(models.RelatedCompany)
        .filter(models.RelatedCompany.company_name == company.name)
        .all()
    )
    for rc in related:
        rc.status = "highlighted"

    db.commit()
    return get_company_with_directors(db, company_id)


def blacklist_related_company(
    db: Session, related_company_id: int
) -> models.RelatedCompany | None:
    """Blacklist a related company (calls blacklist_company on the related company)."""
    rc = (
        db.query(models.RelatedCompany)
        .filter(models.RelatedCompany.id == related_company_id)
        .first()
    )
    if not rc:
        return None

    # Find the company in registry
    company = (
        db.query(models.Company).filter(models.Company.name == rc.company_name).first()
    )
    if company:
        # Call blacklist_company which will create new RelatedCompany entries
        blacklist_company(
            db, company.id, "Blacklisted from related companies", None
        )

    # Mark this related company as dismissed (since it's now blacklisted)
    rc.status = "dismissed"
    db.commit()
    db.refresh(rc)
    return rc


def whitelist_related_company(
    db: Session, related_company_id: int
) -> models.RelatedCompany | None:
    """Whitelist a related company."""
    rc = (
        db.query(models.RelatedCompany)
        .filter(models.RelatedCompany.id == related_company_id)
        .first()
    )
    if not rc:
        return None

    # Find the company in registry and whitelist it
    company = (
        db.query(models.Company).filter(models.Company.name == rc.company_name).first()
    )
    if company:
        whitelist_company(db, company.id, "Whitelisted from related companies", None)

    rc.status = "whitelisted"
    db.commit()
    db.refresh(rc)
    return rc


def dismiss_related_company(
    db: Session, related_company_id: int
) -> models.RelatedCompany | None:
    """Dismiss a related company (remove from highlighted list)."""
    rc = (
        db.query(models.RelatedCompany)
        .filter(models.RelatedCompany.id == related_company_id)
        .first()
    )
    if not rc:
        return None

    rc.status = "dismissed"
    db.commit()
    db.refresh(rc)
    return rc


def get_whitelisted_companies(db: Session) -> list[models.Company]:
    """Get all whitelisted companies."""
    return (
        db.query(models.Company)
        .filter(models.Company.is_whitelisted == True)
        .order_by(models.Company.name)
        .all()
    )
