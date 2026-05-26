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
        d_model = crud.find_director_for_pdf_row(db, pdf_row)
        other = _other_company_briefs(d_model, normalized_name) if d_model else []
        preview_directors.append(
            schemas.DirectorPreview(
                full_name=(pdf_row.get("full_name") or "").strip() or "UNKNOWN",
                nic_passport=pdf_row.get("nic_passport"),
                residential_address=pdf_row.get("residential_address"),
                email=pdf_row.get("email"),
                source="pdf",
                id=d_model.id if d_model else None,
                other_companies=other,
            )
        )

    if existing:
        message = (
            f"{len(pdf_rows)} director(s) from the PDF. "
            f"The second column searches your database for each person and lists other companies they are on "
            f'(not "{normalized_name}").'
        )
    else:
        message = (
            f"{len(pdf_rows)} director(s) from the PDF. "
            "We match each person in your database (NIC, name, email) where possible and show their other companies."
        )

    return schemas.ExtractionPreview(
        company_name=normalized_name,
        company_type=data.get("company_type"),
        registered_address=data.get("registered_address"),
        name_approval_number=data.get("name_approval_number"),
        company_exists_in_registry=existing is not None,
        registry_company_id=existing.id if existing else None,
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
      "nic_passport": "NIC or Passport number",
      "residential_address": "address",
      "email": "email if present, else null"
    }
  ]
}

Be thorough — extract ALL directors listed in the form. Return only the JSON, nothing else."""


def _parse_llm_json_text(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()
    return json.loads(text)


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


async def _extract_with_openai(pdf_b64: str, api_key: str) -> dict:
    """PDF extraction via OpenAI Responses API (gpt-4o and later)."""
    model = (os.getenv("OPENAI_MODEL") or "gpt-4o").strip()
    url = "https://api.openai.com/v1/responses"
    payload = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": PDF_EXTRACTION_PROMPT},
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


async def _extract_with_gemini(pdf_b64: str, api_key: str) -> dict:
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
                            {"text": PDF_EXTRACTION_PROMPT},
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

    if provider == "openai":
        key = (os.getenv("OPENAI_API_KEY") or "").strip()
        if not key:
            raise HTTPException(
                status_code=500,
                detail="LLM_PROVIDER is openai but OPENAI_API_KEY is not set.",
            )
        return await _extract_with_openai(pdf_b64, key)

    key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not key:
        raise HTTPException(
            status_code=500,
            detail="LLM_PROVIDER is gemini but GEMINI_API_KEY (or GOOGLE_API_KEY) is not set.",
        )
    return await _extract_with_gemini(pdf_b64, key)


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
    for d in data.get("directors", []):
        director = crud.get_or_create_director(db, d)
        crud.link_director_to_company(db, director.id, company.id)
        directors_created.append(schemas.Director.model_validate(director))

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
def list_directors(db: Session = Depends(get_db)):
    return crud.get_all_directors_with_companies(db)


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


@app.get("/api/health")
def health():
    return {"status": "ok"}
