# Director Registry System Documentation

## Overview
A brief overview of the Director Registry System, its purpose, and its key components.

## Table of Contents
- [Functionalities](#functionalities)
- [Database Models](#database-models)
- [API Endpoints](#api-endpoints)
- [Remaining Parts of the Project](#remaining-parts-of-the-project)

## Functionalities
- **Director Management**
  - Add, update, and delete directors.
  - Link directors to companies.
  - Manage blacklisting of directors.

- **Company Management**
  - Add, update, and delete companies.
  - Link companies to directors.
  - Manage blacklisting and whitelisting of companies.

- **PDF Extraction**
  - Extract company and director details from uploaded PDF files using AI models (OpenAI and Gemini).

- **Validation**
  - Validate director details against blacklist during form submissions.

## Database Models
### Director
- `id`: Unique identifier.
- `full_name`: Director's name.
- `nic_passport`: NIC or passport number.
- `is_blacklisted`: Status indicating if the director is blacklisted.
- Relationships with other models.

### Company
- `id`: Unique identifier.
- `name`: Company name.
- `is_blacklisted`: Status indicating if the company is blacklisted.
- Relationships with directors.

### Additional Models
- Related companies, blacklisted companies, etc.

## API Endpoints
- **/api/directors**
  - GET: List all directors.
  - POST: Create a new director.
  - PATCH: Update an existing director.
  - DELETE: Remove a director.
  
- **/api/companies**
  - GET: List all companies.
  - POST: Create a new company.
  - PATCH: Update an existing company.
  - DELETE: Remove a company.

- **/api/extract-pdf**
  - POST: Extract data from a PDF file.

## Remaining Parts of the Project
- Implement comprehensive testing for new features.
- Complete AI model integrations and optimize extraction results.
- Enhance validation mechanisms for directors and companies.

---
End of Documentation