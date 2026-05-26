# Company Director Registry

A full-stack web app for Sri Lankan **Form 1** PDFs (Application for Registration of a Company). It extracts company and director details with an LLM, stores them in PostgreSQL, and lets you browse, search, and edit the registry.

## Features

- **PDF upload** — Extract company and director fields from Form 1 PDFs (preview before saving).
- **Registry review** — For each director from the PDF, see other companies they are linked to in your database.
- **Companies & directors** — Expandable tables with search (directors), multi-company highlighting, and delete.
- **Edit** — Update company or director details in a modal (PATCH API).
- **Deduplication** — Re-uploads match existing companies by name and directors by NIC, email, or fuzzy name.

## Tech stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend  | FastAPI (Python 3.12+)              |
| Database | PostgreSQL 16                       |
| AI       | OpenAI or Google Gemini (PDF extraction) |
| Dev DB   | Docker Compose (PostgreSQL only)    |

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Python 3.12+](https://www.python.org/)
- [Docker](https://www.docker.com/) (optional, for PostgreSQL)
- An **OpenAI** and/or **Google Gemini** API key

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/company-director-app.git
cd company-director-app
```

### 2. Start PostgreSQL

Docker Compose runs **only the database**:

```bash
docker compose up -d
```

Default connection:

`postgresql://postgres:password@localhost:5432/company_registry`

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: DATABASE_URL and at least one LLM API key
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in values.

| Variable         | Description |
|------------------|-------------|
| `DATABASE_URL`   | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key (used when set) |
| `OPENAI_MODEL`   | Default: `gpt-4o` |
| `GEMINI_API_KEY` | Gemini key (or `GOOGLE_API_KEY`) |
| `GEMINI_MODEL`   | Default: `gemini-2.5-flash` |
| `LLM_PROVIDER`   | Optional: `openai` or `gemini` to force a provider |

**Do not commit `.env` files** — they are listed in `.gitignore`.

## Project structure

```
company-director-app/
├── backend/
│   ├── app/
│   │   ├── main.py       # API routes, LLM extraction
│   │   ├── models.py     # SQLAlchemy models
│   │   ├── schemas.py    # Pydantic schemas
│   │   ├── crud.py       # DB operations
│   │   └── database.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/        # Home, Companies, Directors
│   │   ├── components/   # UploadZone, tables, Modal, Layout
│   │   └── api/client.js
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── README.md
```

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/extract-pdf` | Upload PDF, return preview + extraction payload |
| POST | `/api/save-extraction` | Persist previewed extraction |
| GET | `/api/companies` | List companies with directors |
| PATCH | `/api/companies/{id}` | Update company |
| DELETE | `/api/companies/{id}` | Delete company |
| GET | `/api/directors` | List directors with companies |
| PATCH | `/api/directors/{id}` | Update director |
| DELETE | `/api/directors/{id}` | Delete director |
| GET | `/api/health` | Health check |

## Publishing to GitHub

From the project root (after creating a repo on GitHub):

```bash
git init
git add .
git commit -m "Initial commit: Company Director Registry"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/company-director-app.git
git push -u origin main
```

Confirm `backend/.env` is **not** staged (`git status` should not list it). Only `.env.example` is tracked.

## Notes

- Designed for Sri Lankan **Form 1** PDFs; similar forms may work.
- Scanned/image PDFs are supported when using multimodal LLM extraction.
- LLM usage is billed by your provider ([OpenAI](https://openai.com/pricing), [Google AI](https://ai.google.dev/pricing)).

## License

Add a license file if you plan to open-source this project (e.g. MIT).
