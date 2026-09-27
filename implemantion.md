# Implementation Plan: Company-First Blacklist with Highlight-Only Related Companies

## Core Rule
**Blacklist company → its directors are blacklisted → related companies are highlighted only → user decides Blacklist / Whitelist / Dismiss**

---

## 1. Database Schema Changes

### `Company` model (add whitelist flag only)
```python
is_whitelisted = Column(Boolean, default=False, index=True, nullable=False)
whitelist_reason = Column(String, nullable=True)
whitelist_notes = Column(String, nullable=True)
```

### `Director` model
**NO CHANGES** - remove all whitelist fields from Director

### New table `RelatedCompany`
```python
class RelatedCompany(Base):
    __tablename__ = "related_companies"
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, index=True, nullable=False)
    source_company_name = Column(String, index=True, nullable=False)
    shared_director_ids = Column(ARRAY(Integer), nullable=False)
    status = Column(String, default="highlighted")  # highlighted, whitelisted, dismissed
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    __table_args__ = (
        UniqueConstraint('source_company_name', 'company_name', name='uq_source_related'),
    )
```

---

## 2. CRUD Layer (`backend/app/crud.py`)

### Core Functions

| Function | Purpose |
|----------|---------|
| `blacklist_company(db, company_id, reason, notes)` | Explicit blacklist company → blacklist its directors → find related companies (excluding whitelisted) → create `RelatedCompany` rows (status=highlighted) |
| `get_related_companies(db)` | Fetch all `RelatedCompany` with status=highlighted + company + shared directors |
| `whitelist_company(db, company_id, reason, notes)` | Mark company whitelisted; update related companies status=whitelisted (**does NOT modify director blacklist status**) |
| `blacklist_related_company(db, related_company_id)` | **Calls `blacklist_company()`** on the related company → set RelatedCompany status=dismissed |
| `dismiss_related_company(db, related_company_id)` | Set status=dismissed |
| `validate_form20_directors(db, directors_list)` | Check each director NIC against blacklist; return warnings only |

### Modified/Removed Functions
- **REMOVE**: `_cascade_blacklist_network()` 
- **REMOVE**: `_sweep_blacklist_network()`
- **MODIFY**: `ensure_blacklisted_company()` - **remove whitelist check**; explicit manual blacklisting always allowed
- **MODIFY**: `link_director_to_company()` - check if company is blacklisted (for director blacklist), **ignore whitelist**
- **KEEP**: `blacklist_auto` field for backward compatibility only

---

## 3. Pydantic Schemas (`backend/app/schemas.py`)

```python
class RelatedCompany(BaseModel):
    id: int
    company_name: str
    source_company_name: str
    shared_directors: list[Director]
    status: str  # highlighted, whitelisted, dismissed
    created_at: datetime
    model_config = {"from_attributes": True}

class Company(BaseModel):  # extend existing
    is_whitelisted: bool = False
    whitelist_reason: Optional[str] = None
    whitelist_notes: Optional[str] = None

class Director(BaseModel):  # NO whitelist fields
    # existing fields only

class Form20ValidationRequest(BaseModel):
    company_name: str
    directors: list[DirectorBase]

class Form20ValidationResult(BaseModel):
    company_name: str
    total_directors: int
    blacklisted_directors: list[DirectorPreview]
    warning_count: int
    message: str
```

---

## 4. API Endpoints (`backend/app/main.py`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/companies/{id}/blacklist` | **MODIFIED**: Explicit blacklist → blacklist directors → highlight related (exclude whitelisted) |
| GET | `/api/blacklist/related-companies` | Get all highlighted related companies |
| PATCH | `/api/companies/{id}/whitelist` | Whitelist company; update related companies status=whitelisted |
| PATCH | `/api/companies/{id}/unwhitelist` | Remove whitelist flag (optional) |
| PATCH | `/api/related-companies/{id}/blacklist` | **Calls blacklist_company()** on related company; sets RelatedCompany status=dismissed |
| PATCH | `/api/related-companies/{id}/whitelist` | Whitelist the related company; sets status=whitelisted |
| PATCH | `/api/related-companies/{id}/dismiss` | Set status=dismissed |
| POST | `/api/validate-form20` | Validate Form 20 directors against blacklist (warnings only) |
| GET | `/api/whitelist/companies` | List whitelisted companies |

---

## 5. Frontend Changes

### A. Blacklist Page - "Related Companies" Section
Polling every 30s via `useEffect` + `setInterval`

```
Blacklist Page:
├── Blacklisted Companies (existing)
├── Blacklisted Directors (existing)
└── ⚠ Related Companies (NEW)
    ├── Company A — Source: Blacklisted Co X
    │   ├── Shared Directors: [Dir1, Dir2]  ← THESE are blacklisted
    │   └── Actions: [Blacklist] [Whitelist] [Dismiss]
    └── Company B — Source: Blacklisted Co Y
        ├── Shared Directors: [Dir3]  ← THIS is blacklisted
        └── Actions: [Blacklist] [Whitelist] [Dismiss]
```

### B. Companies Table - Status Badges & Actions

| Company State | Badge | Blacklist Btn | Whitelist Btn |
|---------------|-------|---------------|---------------|
| Explicit Blacklisted | 🔴 "Blacklisted" | Disabled | Enabled |
| Whitelisted | 🟢 "Whitelisted" | **Enabled** (override) | Disabled |
| Related (highlighted) | ⚠ "Related to blacklisted" | Enabled | Enabled |
| Normal | — | Enabled | Enabled |

### C. Form 20 Integration (Existing Workflow)
- **NO new route/page/modal**
- In existing `UploadZone.jsx` / Form 20 extraction flow:
  1. After directors extracted, call `/api/validate-form20`
  2. Show warning banner with blacklisted directors highlighted
  3. Allow existing workflow to continue ("Proceed Anyway" / "Review Blacklist")
  4. **NO "Whitelist Company" action**

---

## 6. Key Logic Flows

### Blacklist Company
```
POST /api/companies/{id}/blacklist {reason, notes}
  1. Create BlacklistedCompany (is_explicit=True)
  2. For each director in company:
       director.is_blacklisted = True
       director.blacklist_company_name = company.name
       director.blacklist_reason = reason
       director.blacklist_notes = notes
  3. Find related companies (excluding whitelisted):
       SELECT DISTINCT c.* FROM companies c
       JOIN company_director cd ON c.id = cd.company_id
       WHERE cd.director_id IN (blacklisted_director_ids)
       AND c.name != blacklisted_company_name
       AND c.is_whitelisted = False
  4. For each related company:
       UPSERT RelatedCompany(
         company_name=related.name,
         source_company_name=blacklisted.name,
         shared_director_ids=[shared director IDs],
         status="highlighted"
       )
  5. Return company with related_companies
```

### Whitelist Company
```
POST /api/companies/{id}/whitelist {reason, notes}
  1. company.is_whitelisted = True, save reason/notes
  2. For RelatedCompany rows where company_name == this company:
       status = "whitelisted"
  3. Director blacklist status: UNCHANGED
```

### Blacklist Related Company
```
PATCH /api/related-companies/{id}/blacklist
  1. Get RelatedCompany row → related_company_name
  2. CALL blacklist_company(related_company_id, reason, notes)
     // Normal explicit blacklist flow: blacklist company → blacklist directors → highlight ITS related companies
  3. Update this RelatedCompany status = "dismissed"
```

### Form 20 Validation (Integrated into Existing Flow)
```
After PDF extraction in existing Form 20 workflow:
  POST /api/validate-form20 {company_name, directors: [{nic, name, ...}]}
  For each director NIC:
    hit = find_blacklisted_by_nic(db, nic)
  Return {blacklisted_directors: [...], warning_count, message}
  → Show warning banner in existing UI
  → Allow user to proceed with save
```

---

## 7. Migration Strategy

1. Add `is_whitelisted`, `whitelist_reason`, `whitelist_notes` to `companies` table via `_ensure_schema()`
2. Create `related_companies` table with unique constraint via `_ensure_schema()`
3. Deploy backend → Deploy frontend
4. No data migration needed

---

## 8. Phased Implementation

| Phase | Deliverables |
|-------|--------------|
| **1** | DB schema + `blacklist_company` (new flow) + `get_related_companies` + `validate_form20` |
| **2** | Whitelist company + related company actions (blacklist/whitelist/dismiss) |
| **3** | Frontend: Blacklist page Related Companies section with polling |
| **4** | Frontend: Companies table badges + whitelist button |
| **5** | Frontend: Form 20 validation integration into existing UploadZone workflow |
| **6** | Integration testing |

---

## Requirements Summary (Simple Language)

### What Changed
The blacklist system now works **company-first** instead of director-first:

1. **Blacklist a Company** → All its directors become blacklisted automatically
2. **Find Related Companies** → Other companies sharing those directors get **highlighted only** (not blacklisted)
3. **User Decides** → For each highlighted company: Blacklist / Whitelist / Dismiss
4. **Whitelist** → Removes highlight, doesn't touch director blacklist status
5. **Form 20** → Check directors against blacklist during existing upload, show warnings only