from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import shutil, os, base64, httpx, json
from urllib.parse import urlencode

from . import models, schemas, crud
from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

from sqlalchemy import inspect, text


def _ensure_schema():
    """
    Lightweight schema evolution (no Alembic in this project).
    Adds new nullable columns if missing.
    """
    insp = inspect(engine)

    def has_col(table: str, col: str) -> bool:
        try:
            return any(c["name"] == col for c in insp.get_columns(table))
        except Exception:
            return False

    with engine.begin() as conn:
        # directors
        if insp.has_table("directors"):
            if not has_col("directors", "id_type"):
                conn.execute(text('ALTER TABLE directors ADD COLUMN id_type VARCHAR NULL'))
            if not has_col("directors", "id_country"):
                conn.execute(text('ALTER TABLE directors ADD COLUMN id_country VARCHAR NULL'))
            if not has_col("directors", "is_blacklisted"):
                conn.execute(text(
                    'ALTER TABLE directors ADD COLUMN is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE'
                ))
            if not has_col("directors", "blacklist_company_name"):
                conn.execute(text('ALTER TABLE directors ADD COLUMN blacklist_company_name VARCHAR NULL'))
            if not has_col("directors", "blacklist_reason"):
                conn.execute(text('ALTER TABLE directors ADD COLUMN blacklist_reason VARCHAR NULL'))
            if not has_col("directors", "blacklist_notes"):
                conn.execute(text('ALTER TABLE directors ADD COLUMN blacklist_notes VARCHAR NULL'))
            if not has_col("directors", "blacklist_auto"):
                conn.execute(text('ALTER TABLE directors ADD COLUMN blacklist_auto BOOLEAN NOT NULL DEFAULT FALSE'))

        if insp.has_table("blacklisted_companies"):
            if not has_col("blacklisted_companies", "is_explicit"):
                conn.execute(text('ALTER TABLE blacklisted_companies ADD COLUMN is_explicit BOOLEAN NOT NULL DEFAULT FALSE'))
        else:
            models.BlacklistedCompany.__table__.create(bind=conn, checkfirst=True)

    _migrate_legacy_blacklist_table()


def _migrate_legacy_blacklist_table():
    """Move rows from blacklisted_directors into directors (one-time)."""
    insp = inspect(engine)
    if not insp.has_table("blacklisted_directors"):
        return
    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                "SELECT full_name, nic_passport, company_name, id_type, id_country, "
                "address, reason, notes FROM blacklisted_directors"
            )
        ).mappings().all()
        for row in rows:
            nic = row["nic_passport"]
            director = crud.find_director_by_nic(db, nic)
            if director:
                director.is_blacklisted = True
                director.blacklist_company_name = (
                    crud.normalize_company_name(row["company_name"])
                    or director.blacklist_company_name
                )
                director.blacklist_reason = row["reason"] or director.blacklist_reason
                director.blacklist_notes = row["notes"] or director.blacklist_notes
                if row["id_type"]:
                    director.id_type = row["id_type"]
                if row["id_country"]:
                    director.id_country = row["id_country"]
                if row["address"] and not director.residential_address:
                    director.residential_address = row["address"]
            else:
                db.add(
                    models.Director(
                        full_name=(row["full_name"] or "UNKNOWN").strip().upper(),
                        nic_passport=crud.format_nic_for_storage(nic),
                        id_type=row["id_type"],
                        id_country=row["id_country"],
                        residential_address=row["address"],
                        is_blacklisted=True,
                        blacklist_company_name=crud.normalize_company_name(row["company_name"]),
                        blacklist_reason=row["reason"],
                        blacklist_notes=row["notes"],
                    )
                )
            if row["company_name"]:
                crud.ensure_blacklisted_company(db, row["company_name"], row["reason"])
        db.commit()
        # Drop the legacy table so this migration never re-runs
        with engine.begin() as conn:
            conn.execute(text("DROP TABLE blacklisted_directors"))
    except Exception:
        db.rollback()
    finally:
        db.close()


_ensure_schema()


def _normalize_person_name(name: str) -> str:
    return (name or "").strip().upper()


def _other_company_briefs(
    director: models.Director, preview_company_normalized: str
) -> list[schemas.CompanyBrief]:
    nu = preview_company_normalized.strip().upper()
    briefs: list[schemas.CompanyBrief] = []
    for c in director.companies:
        if c.name.strip().upper() == nu:
            continue
        briefs.append(
            schemas.CompanyBrief(
                id=c.id,
                name=c.name,
                company_type=c.company_type,
            )
        )
    return sorted(briefs, key=lambda b: b.name)


def build_extraction_preview(db: Session, data: dict) -> schemas.ExtractionPreview:
    normalized_name = data.get("company_name", "UNKNOWN").strip().upper()
    existing = crud.get_company_by_normalized_name_with_relations(db, normalized_name)
    pdf_rows = data.get("directors") or []

    preview_directors: list[schemas.DirectorPreview] = []
    for pdf_row in pdf_rows:
        pdf_name = (pdf_row.get("full_name") or "").strip() or "UNKNOWN"
        nic_raw = pdf_row.get("nic_passport")
        missing_nic = not crud.normalize_nic(nic_raw)

        # Always try to match: NIC first, then name+email fallback
        d_model = crud.find_director_for_pdf_row(db, pdf_row, normalized_name)

        # Determine how the match was made
        if d_model and not missing_nic:
            matched_by = "nic"
        elif d_model and missing_nic:
            matched_by = "name_email"
        else:
            matched_by = "none"

        other = _other_company_briefs(d_model, normalized_name) if d_model else []
        registry_name = d_model.full_name if d_model else None
        name_changed = bool(
            d_model
            and registry_name
            and _normalize_person_name(pdf_name) != _normalize_person_name(registry_name)
        )

        # Check blacklist: via NIC when available, else via the matched director record
        if not missing_nic:
            blacklist_hit = crud.find_blacklisted_by_nic(db, nic_raw)
        elif d_model and d_model.is_blacklisted:
            blacklist_hit = d_model
        else:
            blacklist_hit = None

        preview_directors.append(
            schemas.DirectorPreview(
                full_name=pdf_name,
                nic_passport=nic_raw,
                residential_address=pdf_row.get("residential_address"),
                email=pdf_row.get("email"),
                source="pdf",
                id=d_model.id if d_model else None,
                matched_by=matched_by,
                registry_full_name=registry_name if name_changed else None,
                name_changed=name_changed,
                missing_nic=missing_nic,
                is_blacklisted=blacklist_hit is not None,
                blacklist_reason=blacklist_hit.blacklist_reason if blacklist_hit else None,
                blacklist_company_name=blacklist_hit.blacklist_company_name if blacklist_hit else None,
                other_companies=other,
            )
        )

    blacklisted_count = sum(1 for d in preview_directors if d.is_blacklisted)
    company_bl = crud.find_blacklisted_company_by_name(db, normalized_name)
    company_is_blacklisted = company_bl is not None or blacklisted_count > 0
    company_blacklist_reason = company_bl.reason if company_bl else None
    if not company_blacklist_reason and blacklisted_count > 0:
        company_blacklist_reason = "A director on this form is on the blacklist."

    blacklist_note = ""
    if blacklisted_count:
        blacklist_note += (
            f" Warning: {blacklisted_count} director(s) match the supervisor blacklist (by NIC/passport)."
        )
    if company_is_blacklisted:
        blacklist_note += " This company is blacklisted."

    if existing:
        message = (
            f"{len(pdf_rows)} director(s) from the PDF. "
            "Matched by NIC/passport when present; otherwise by full name + email. "
            f"Other companies are listed when we find the same person in your registry (excluding {normalized_name!r})."
            + blacklist_note
        )
    else:
        message = (
            f"{len(pdf_rows)} director(s) from the PDF. "
            "Directors are matched by NIC/passport when available, or by full name + email as a fallback. "
            "IDs can be added to a director's record later."
            + blacklist_note
        )

    return schemas.ExtractionPreview(
        company_name=normalized_name,
        company_type=data.get("company_type"),
        registered_address=data.get("registered_address"),
        name_approval_number=data.get("name_approval_number"),
        company_exists_in_registry=existing is not None,
        registry_company_id=existing.id if existing else None,
        company_is_blacklisted=company_is_blacklisted,
        company_blacklist_reason=company_blacklist_reason,
        directors=preview_directors,
        message=message,
    )

app = FastAPI(title="Company Director Registry API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


PDF_EXTRACTION_PROMPT = """You are analyzing a company registration form (Form 1 - Application for Registration of a Company in Sri Lanka).

Extract the following information and return ONLY a valid JSON object with no extra text or markdown:

{
  "company_name": "extracted company name",
  "company_type": "e.g. LIMITED LIABILITY, PUBLIC LIMITED, etc.",
  "registered_address": "full address",
  "name_approval_number": "if present, else null",
  "directors": [
    {
      "full_name": "FULL NAME IN CAPS",
      "nic_passport": "NIC or Passport number (required — this is the permanent ID; names may change)",
      "residential_address": "address",
      "email": "email if present, else null"
    }
  ]
}

For every director you MUST extract nic_passport (Sri Lankan NIC or passport number). Do not omit it.
Be thorough — extract ALL directors listed in the form. Return only the JSON, nothing else."""


SCANNED_PDF_RETRY_PROMPT = """You are analyzing a SCANNED or low-quality company registration form PDF (Form 1 - Sri Lanka).

The document may be blurry, rotated, noisy, or image-only. Carefully read every page before answering.

Return ONLY valid JSON with this exact shape:
{
  "company_name": "company name in UPPERCASE",
  "company_type": "LIMITED LIABILITY / PRIVATE LIMITED / PUBLIC LIMITED / etc. or null",
  "registered_address": "full registered address or null",
  "name_approval_number": "name approval number or null",
  "directors": [
    {
      "full_name": "FULL NAME IN UPPERCASE",
      "nic_passport": "NIC or passport number (if unclear, use null)",
      "residential_address": "address or null",
      "email": "email or null"
    }
  ]
}

Rules:
- Extract ALL directors visible in the form.
- Do not invent data. If unreadable, use null.
- Prefer exact text from the document.
- Return only JSON, no markdown/explanation."""


def _parse_llm_json_text(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()
    return json.loads(text)


def _normalized_extraction(data: dict | None) -> dict:
    if not isinstance(data, dict):
        return {
            "company_name": "UNKNOWN",
            "company_type": None,
            "registered_address": None,
            "name_approval_number": None,
            "directors": [],
        }
    out = dict(data)
    out["company_name"] = str(out.get("company_name") or "UNKNOWN").strip() or "UNKNOWN"
    out["company_type"] = out.get("company_type")
    out["registered_address"] = out.get("registered_address")
    out["name_approval_number"] = out.get("name_approval_number")
    if not isinstance(out.get("directors"), list):
        out["directors"] = []
    return out


def _extraction_quality_score(data: dict) -> int:
    """
    Higher score means more trustworthy extraction.
    """
    score = 0
    company_name = str(data.get("company_name") or "").strip().upper()
    if company_name and company_name not in {"UNKNOWN", "N/A", "NULL"}:
        score += 2

    directors = data.get("directors") or []
    if isinstance(directors, list):
        score += min(len(directors), 5)
        for d in directors:
            if not isinstance(d, dict):
                continue
            if str(d.get("full_name") or "").strip():
                score += 1
            if str(d.get("nic_passport") or "").strip():
                score += 1
    return score


def _is_incomplete_extraction(data: dict) -> bool:
    company_name = str(data.get("company_name") or "").strip().upper()
    directors = data.get("directors") or []
    if company_name in {"", "UNKNOWN", "N/A", "NULL"}:
        return True
    if not isinstance(directors, list) or len(directors) == 0:
        return True
    has_any_named_director = any(
        isinstance(d, dict) and str(d.get("full_name") or "").strip()
        for d in directors
    )
    return not has_any_named_director


def _llm_provider() -> str:
    explicit = (os.getenv("LLM_PROVIDER") or "").strip().lower()
    if explicit in ("openai", "gemini"):
        return explicit
    if (os.getenv("OPENAI_API_KEY") or "").strip():
        return "openai"
    if (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip():
        return "gemini"
    return ""


def _text_from_openai_response(body: dict) -> str:
    t = body.get("output_text")
    if isinstance(t, str) and t.strip():
        return t.strip()
    for block in body.get("output") or []:
        if not isinstance(block, dict):
            continue
        for part in block.get("content") or []:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "output_text":
                s = part.get("text")
                if isinstance(s, str) and s.strip():
                    return s.strip()
    raise HTTPException(
        status_code=500,
        detail=f"OpenAI response had no text output: {json.dumps(body)[:1200]}",
    )


async def _extract_with_openai(pdf_b64: str, api_key: str, prompt: str = PDF_EXTRACTION_PROMPT) -> dict:
    """PDF extraction via OpenAI Responses API (gpt-4o and later)."""
    model = (os.getenv("OPENAI_MODEL") or "gpt-4o").strip()
    url = "https://api.openai.com/v1/responses"
    payload = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {
                        "type": "input_file",
                        "filename": "form1.pdf",
                        "file_data": f"data:application/pdf;base64,{pdf_b64}",
                    },
                ],
            }
        ],
    }
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=500,
            detail=f"OpenAI API error: {response.text}",
        )
    return _parse_llm_json_text(_text_from_openai_response(response.json()))


async def _extract_with_gemini(pdf_b64: str, api_key: str, prompt: str = PDF_EXTRACTION_PROMPT) -> dict:
    model = (os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()
    req_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?{urlencode({'key': api_key})}"
    )
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            req_url,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "inline_data": {
                                    "mime_type": "application/pdf",
                                    "data": pdf_b64,
                                }
                            },
                            {"text": prompt},
                        ],
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "maxOutputTokens": 8192,
                    "temperature": 0.2,
                },
            },
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {response.text}",
        )
    result = response.json()
    candidates = result.get("candidates") or []
    if not candidates:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini returned no candidates: {result}",
        )
    parts = candidates[0].get("content", {}).get("parts") or []
    if not parts or "text" not in parts[0]:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini response missing text: {result}",
        )
    return _parse_llm_json_text(parts[0]["text"])


async def extract_company_data_from_pdf(file_path: str) -> dict:
    """Extract Form 1 fields using OpenAI or Google Gemini (see OPENAI_API_KEY / GEMINI_API_KEY)."""
    with open(file_path, "rb") as f:
        pdf_b64 = base64.standard_b64encode(f.read()).decode("utf-8")

    provider = _llm_provider()
    if not provider:
        raise HTTPException(
            status_code=500,
            detail=(
                "No LLM configured. Set OPENAI_API_KEY for OpenAI, or GEMINI_API_KEY / GOOGLE_API_KEY "
                "for Google Gemini. Optional: LLM_PROVIDER=openai or gemini to force one provider."
            ),
        )

    openai_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    gemini_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()

    providers_order: list[str] = [provider]
    if provider == "openai" and gemini_key:
        providers_order.append("gemini")
    elif provider == "gemini" and openai_key:
        providers_order.append("openai")

    best_data: dict | None = None
    best_score = -1
    last_error: str | None = None

    async def _attempt_extract(provider_name: str, prompt: str) -> dict:
        if provider_name == "openai":
            if not openai_key:
                raise RuntimeError("OPENAI_API_KEY is not configured.")
            return await _extract_with_openai(pdf_b64, openai_key, prompt)
        if not gemini_key:
            raise RuntimeError("GEMINI_API_KEY / GOOGLE_API_KEY is not configured.")
        return await _extract_with_gemini(pdf_b64, gemini_key, prompt)

    for provider_name in providers_order:
        # Pass 1: normal extraction prompt
        try:
            first_pass = _normalized_extraction(
                await _attempt_extract(provider_name, PDF_EXTRACTION_PROMPT)
            )
            score = _extraction_quality_score(first_pass)
            if score > best_score:
                best_data, best_score = first_pass, score
            if not _is_incomplete_extraction(first_pass):
                return first_pass
        except Exception as e:
            last_error = str(e)

        # Pass 2: retry prompt for scanned / low-quality PDFs
        try:
            retry_pass = _normalized_extraction(
                await _attempt_extract(provider_name, SCANNED_PDF_RETRY_PROMPT)
            )
            score = _extraction_quality_score(retry_pass)
            if score > best_score:
                best_data, best_score = retry_pass, score
            if not _is_incomplete_extraction(retry_pass):
                return retry_pass
        except Exception as e:
            last_error = str(e)

    if best_data is not None:
        # Return best-effort extraction so user can still review/edit in UI.
        return best_data

    raise HTTPException(
        status_code=500,
        detail=f"Could not extract data from PDF. Please upload a clearer scan. {last_error or ''}".strip(),
    )


@app.post("/api/extract-pdf", response_model=schemas.ExtractPdfResponse)
async def extract_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        data = await extract_company_data_from_pdf(file_path)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse LLM JSON: {e}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    if data.get("directors") is None:
        data["directors"] = []
    extraction = schemas.ExtractionPayload.model_validate(data)
    preview = build_extraction_preview(db, extraction.model_dump())
    return schemas.ExtractPdfResponse(preview=preview, extraction=extraction)


@app.post("/api/save-extraction", response_model=schemas.UploadResult)
def save_extraction(payload: schemas.ExtractionPayload, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("directors") is None:
        data["directors"] = []
    company = crud.get_or_create_company(db, data)
    directors_created = []
    try:
        for d in data.get("directors", []):
            director = crud.get_or_create_director(db, d, company_name_hint=company.name)
            crud.link_director_to_company(db, director.id, company.id)
            if director.is_blacklisted:
                crud.ensure_blacklisted_company(
                    db,
                    company.name,
                    director.blacklist_reason or f"Associated with blacklisted director {director.full_name}",
                    is_explicit=False
                )
            directors_created.append(schemas.Director.model_validate(director))
    except crud.ConflictError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return schemas.UploadResult(
        company=schemas.Company.model_validate(company),
        directors=directors_created,
        message=f"Saved {company.name} with {len(directors_created)} director link(s) from this form.",
    )


@app.get("/api/companies", response_model=list[schemas.CompanyWithDirectors])
def list_companies(db: Session = Depends(get_db)):
    return crud.get_all_companies_with_directors(db)


@app.patch("/api/companies/{company_id}", response_model=schemas.CompanyWithDirectors)
def patch_company(
    company_id: int,
    body: schemas.CompanyUpdate,
    db: Session = Depends(get_db),
):
    updates = body.model_dump(exclude_unset=True)
    try:
        if updates:
            company = crud.update_company(db, company_id, updates)
        else:
            company = crud.get_company_with_directors(db, company_id)
    except crud.ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
    return company


@app.get("/api/directors", response_model=list[schemas.DirectorWithCompanies])
def list_directors(status: str | None = None, db: Session = Depends(get_db)):
    """List directors. Optional status: all (default), blacklisted, active."""
    if status and status not in ("all", "blacklisted", "active"):
        raise HTTPException(status_code=400, detail="status must be all, blacklisted, or active")
    filter_status = None if not status or status == "all" else status
    return crud.get_all_directors_with_companies(db, filter_status)


@app.post("/api/directors", response_model=schemas.DirectorWithCompanies, status_code=201)
def create_director(body: schemas.DirectorCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_director(db, body.model_dump())
    except crud.ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.patch("/api/directors/{director_id}", response_model=schemas.DirectorWithCompanies)
def patch_director(
    director_id: int,
    body: schemas.DirectorUpdate,
    db: Session = Depends(get_db),
):
    updates = body.model_dump(exclude_unset=True)
    try:
        if updates:
            director = crud.update_director(db, director_id, updates)
        else:
            director = crud.get_director_with_companies(db, director_id)
    except crud.ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not director:
        raise HTTPException(status_code=404, detail="Director not found.")
    return director


@app.delete("/api/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    crud.delete_company(db, company_id)
    return {"message": "Company deleted."}


@app.delete("/api/directors/{director_id}")
def delete_director(director_id: int, db: Session = Depends(get_db)):
    crud.delete_director(db, director_id)
    return {"message": "Director deleted."}


@app.delete("/api/companies/{company_id}/directors/{director_id}")
def unlink_director(company_id: int, director_id: int, db: Session = Depends(get_db)):
    success = crud.unlink_director_from_company(db, company_id, director_id)
    if not success:
        raise HTTPException(status_code=404, detail="Company or director not found, or they are not linked.")
    return {"message": "Director unlinked from company."}


@app.get("/api/blacklist/companies", response_model=list[schemas.BlacklistedCompany])
def list_blacklisted_companies(db: Session = Depends(get_db)):
    return crud.get_all_blacklisted_companies(db)


@app.get("/api/blacklist/suggest-companies")
def suggest_companies_for_nic(nic: str, db: Session = Depends(get_db)):
    """Registry companies linked to this NIC (helps fill the form)."""
    names = crud.get_registry_companies_for_nic(db, nic)
    return {"companies": names}


@app.patch("/api/directors/{director_id}/blacklist", response_model=schemas.DirectorWithCompanies)
def blacklist_director_endpoint(
    director_id: int,
    body: schemas.BlacklistRequest,
    db: Session = Depends(get_db)
):
    director = crud.blacklist_director(db, director_id, body.reason, body.notes)
    if not director:
        raise HTTPException(status_code=404, detail="Director not found.")
    return director


@app.patch("/api/directors/{director_id}/unblacklist", response_model=schemas.DirectorWithCompanies)
def unblacklist_director_endpoint(
    director_id: int,
    db: Session = Depends(get_db)
):
    try:
        director = crud.unblacklist_director(db, director_id)
    except crud.ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not director:
        raise HTTPException(status_code=404, detail="Director not found.")
    return director


@app.patch("/api/companies/{company_id}/blacklist", response_model=schemas.CompanyWithDirectors)
def blacklist_company_endpoint(
    company_id: int,
    body: schemas.BlacklistRequest,
    db: Session = Depends(get_db)
):
    company = crud.blacklist_company(db, company_id, body.reason, body.notes)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
    return company


@app.patch("/api/companies/{company_id}/unblacklist", response_model=schemas.CompanyUnblacklistResponse)
def unblacklist_company_endpoint(
    company_id: int,
    db: Session = Depends(get_db)
):
    # First check if company_id matches a company in the registry
    company = crud.get_company_with_directors(db, company_id)
    if company:
        updated_company = crud.unblacklist_company(db, company_id)
        if not updated_company:
            raise HTTPException(status_code=400, detail="Company is not explicitly blacklisted.")
        return schemas.CompanyUnblacklistResponse(
            message="Company unblacklisted.",
            company=schemas.CompanyWithDirectors.model_validate(updated_company)
        )
    
    # If not found in registry, check if company_id matches blacklisted_companies.id
    bc = db.query(models.BlacklistedCompany).filter(models.BlacklistedCompany.id == company_id).first()
    if bc and bc.is_explicit:
        db.delete(bc)
        db.commit()
        return schemas.CompanyUnblacklistResponse(
            message="Company unblacklisted.",
            company=None
        )
        
    raise HTTPException(status_code=404, detail="Company not found in registry or blacklist.")


@app.get("/api/blacklist/directors", response_model=list[schemas.DirectorWithCompanies])
def list_blacklisted_directors(db: Session = Depends(get_db)):
    return crud.get_all_directors_with_companies(db, status="blacklisted")


@app.get("/api/health")
def health():
    return {"status": "ok"}

