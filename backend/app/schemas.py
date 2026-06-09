from pydantic import BaseModel
from typing import Literal, Optional


class DirectorBase(BaseModel):
    full_name: str
    nic_passport: Optional[str] = None
    id_type: Optional[Literal["NIC", "PASSPORT"]] = None
    id_country: Optional[str] = None
    residential_address: Optional[str] = None
    email: Optional[str] = None
    is_blacklisted: bool = False
    blacklist_company_name: Optional[str] = None
    blacklist_reason: Optional[str] = None
    blacklist_notes: Optional[str] = None
    blacklist_auto: bool = False


class DirectorCreate(DirectorBase):
    """Create a director manually (registry or blacklist)."""


class Director(DirectorBase):
    id: int
    model_config = {"from_attributes": True}


class DirectorUpdate(BaseModel):
    """Partial update; only fields present in the request are changed."""

    full_name: Optional[str] = None
    nic_passport: Optional[str] = None
    id_type: Optional[Literal["NIC", "PASSPORT"]] = None
    id_country: Optional[str] = None
    residential_address: Optional[str] = None
    email: Optional[str] = None
    is_blacklisted: Optional[bool] = None
    blacklist_company_name: Optional[str] = None
    blacklist_reason: Optional[str] = None
    blacklist_notes: Optional[str] = None
    blacklist_auto: Optional[bool] = None


class CompanyBase(BaseModel):
    name: str
    company_type: Optional[str] = None
    registered_address: Optional[str] = None
    name_approval_number: Optional[str] = None


class Company(CompanyBase):
    id: int
    is_blacklisted: bool = False
    blacklist_reason: Optional[str] = None
    blacklist_notes: Optional[str] = None
    is_explicit: bool = False
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


class BlacklistedCompany(BaseModel):
    id: int
    name: str
    reason: Optional[str] = None
    notes: Optional[str] = None
    is_explicit: bool = False
    company_id: Optional[int] = None
    model_config = {"from_attributes": True}


class BlacklistRequest(BaseModel):
    reason: str
    notes: Optional[str] = None



class DirectorPreview(DirectorBase):
    source: Literal["pdf", "registry"]
    id: Optional[int] = None
    """Set when this person already exists in the database (matched by NIC/passport)."""
    matched_by: Literal["nic", "name_email", "none"] = "none"
    """How this PDF row was linked to the registry: NIC, name+email fallback, or no match."""
    registry_full_name: Optional[str] = None
    """Name on file when matched by NIC but the PDF shows a different name."""
    name_changed: bool = False
    """True when PDF name differs from registry — possible name change on a new form."""
    missing_nic: bool = False
    """True when the PDF row has no NIC/passport — cannot reliably identify this person."""
    is_blacklisted: bool = False
    """True when this NIC/passport is on the supervisor blacklist."""
    blacklist_reason: Optional[str] = None
    blacklist_company_name: Optional[str] = None
    """Company recorded on the blacklist entry for this director."""
    other_companies: list[CompanyBrief] = []
    """Other companies this director is linked to, excluding the PDF / preview company."""


class ExtractionPreview(BaseModel):
    company_name: str
    company_type: Optional[str] = None
    registered_address: Optional[str] = None
    name_approval_number: Optional[str] = None
    company_exists_in_registry: bool
    registry_company_id: Optional[int] = None
    company_is_blacklisted: bool = False
    company_blacklist_reason: Optional[str] = None
    directors: list[DirectorPreview]
    message: str


class ExtractPdfResponse(BaseModel):
    preview: ExtractionPreview
    extraction: ExtractionPayload


class CompanyUnblacklistResponse(BaseModel):
    message: str
    company: Optional[CompanyWithDirectors] = None

