from pydantic import BaseModel
from typing import Literal, Optional


class DirectorBase(BaseModel):
    full_name: str
    nic_passport: Optional[str] = None
    residential_address: Optional[str] = None
    email: Optional[str] = None


class Director(DirectorBase):
    id: int
    model_config = {"from_attributes": True}


class DirectorUpdate(BaseModel):
    """Partial update; only fields present in the request are changed."""

    full_name: Optional[str] = None
    nic_passport: Optional[str] = None
    residential_address: Optional[str] = None
    email: Optional[str] = None


class CompanyBase(BaseModel):
    name: str
    company_type: Optional[str] = None
    registered_address: Optional[str] = None
    name_approval_number: Optional[str] = None


class Company(CompanyBase):
    id: int
    model_config = {"from_attributes": True}


class CompanyUpdate(BaseModel):
    """Partial update; only fields present in the request are changed."""

    name: Optional[str] = None
    company_type: Optional[str] = None
    registered_address: Optional[str] = None
    name_approval_number: Optional[str] = None


class CompanyWithDirectors(Company):
    directors: list[Director] = []


class DirectorWithCompanies(Director):
    companies: list[Company] = []


class UploadResult(BaseModel):
    company: Company
    directors: list[Director]
    message: str


class ExtractionPayload(BaseModel):
    """Payload returned from PDF extraction and sent back to save (persist PDF data only)."""

    company_name: str
    company_type: Optional[str] = None
    registered_address: Optional[str] = None
    name_approval_number: Optional[str] = None
    directors: list[DirectorBase] = []


class CompanyBrief(BaseModel):
    """Lightweight company row for preview cross-links."""

    id: int
    name: str
    company_type: Optional[str] = None
    model_config = {"from_attributes": True}


class DirectorPreview(DirectorBase):
    source: Literal["pdf", "registry"]
    id: Optional[int] = None
    """Set when this person already exists in the database (PDF match or registry row)."""
    other_companies: list[CompanyBrief] = []
    """Other companies this director is linked to, excluding the PDF / preview company."""


class ExtractionPreview(BaseModel):
    company_name: str
    company_type: Optional[str] = None
    registered_address: Optional[str] = None
    name_approval_number: Optional[str] = None
    company_exists_in_registry: bool
    registry_company_id: Optional[int] = None
    directors: list[DirectorPreview]
    message: str


class ExtractPdfResponse(BaseModel):
    preview: ExtractionPreview
    extraction: ExtractionPayload
