# Company Director Registry

A full-stack web app for Sri Lankan **Form 1** PDFs (Application for Registration of a Company). It extracts company and director details with an LLM, stores them in PostgreSQL, and lets you browse, search, edit, and blacklist entries in the registry.

**Repository:** [github.com/SLTDigitalLab/director-finding](https://github.com/SLTDigitalLab/director-finding)

## Features

- **PDF upload** — Extract company and director fields from Form 1 PDFs (preview before saving).
- **Registry review** — For each director from the PDF, see other companies they are linked to in your database.
- **Companies & directors** — Expandable tables with search (directors), multi-company highlighting, and delete.
- **Edit** — Update company or director details in a modal (PATCH API).
- **Deduplication** — Re-uploads match existing companies by name and directors by NIC, email, or fuzzy name.
- **Blacklist management** — Blacklist/unblacklist companies and directors with cascade rules; audit view on the Blacklist page.

## Tech stack

| Layer      | Technology                                       |
| ---------- | ------------------------------------------------ |
| Frontend   | React 18, Vite, Tailwind CSS, React Router       |
| Backend    | FastAPI (Python 3.12+)                           |
| Database   | PostgreSQL 16                                    |
| AI         | OpenAI or Google Gemini (PDF extraction)         |
| Dev/Deploy | Docker Compose (frontend + backend + PostgreSQL) |

## Prerequisites

- [Docker](https://www.docker.com/) + Docker Compose
- An **OpenAI** and/or **Google Gemini** API key

## Quick start (Docker)

### 1. Clone the repository

```bash
git clone https://github.com/SLTDigitalLab/director-finding.git
cd director-finding
```

### 2. Create backend environment file

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your API key(s):

```env
# Uncomment and set ONE provider:
# OPENAI_API_KEY=your-key-here
# GEMINI_API_KEY=your-key-here
```

`DATABASE_URL` can stay as-is — Docker Compose overrides it internally for the backend container.

### 3. Build and run all services

```bash
docker compose up --build -d
```

### 4. Open the app

| Service        | URL                              |
| -------------- | -------------------------------- |
| Frontend (UI)  | http://localhost                 |
| API docs       | http://localhost:8000/docs       |
| Health check   | http://localhost:8000/api/health |

## Docker commands

**Check running services:**

```bash
docker compose ps
```

**View logs:**

```bash
docker compose logs -f              # all services
docker compose logs -f backend        # backend only
docker compose logs -f frontend       # frontend only
docker compose logs -f db             # database only
```

**Restart services:**

```bash
docker compose restart
```

**Stop everything:**

```bash
docker compose down
```

**Stop and remove database data:**

```bash
docker compose down -v
```

**Rebuild after code changes:**

```bash
docker compose up --build -d
```

## Docker services

| Service    | Description                                      | Port |
| ---------- | ------------------------------------------------ | ---- |
| `frontend` | Nginx — serves React build, proxies `/api` to backend | 80   |
| `backend`  | FastAPI API server                               | 8000 |
| `db`       | PostgreSQL 16 (persistent volume `pgdata`)        | 5432 |

## Local development (without Docker for frontend/backend)

Use this when you want hot reload during development.

**Terminal 1 — database only:**

```bash
docker compose up -d db
```

**Terminal 2 — backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # if not already done
uvicorn app.main:app --reload --port 8000
```

**Terminal 3 — frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (Vite dev server proxies `/api` to the backend).

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in values.

| Variable         | Description                                    |
| ---------------- | ---------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string                   |
| `OPENAI_API_KEY` | OpenAI API key (used when set)                 |
| `OPENAI_MODEL`   | Default: `gpt-4o`                              |
| `GEMINI_API_KEY` | Gemini key (or `GOOGLE_API_KEY`)               |
| `GEMINI_MODEL`   | Default: `gemini-2.5-flash`                    |
| `LLM_PROVIDER`   | Optional: `openai` or `gemini` to force a provider |

**Do not commit `.env` files** — they are listed in `.gitignore`. Only `.env.example` (with empty placeholders) should be tracked.

## Project structure

```
director-finding/
├── backend/
│   ├── app/
│   │   ├── main.py         # API routes, LLM extraction
│   │   ├── models.py       # SQLAlchemy models
│   │   ├── schemas.py      # Pydantic schemas
│   │   ├── crud.py         # DB operations, blacklist cascade
│   │   └── database.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/          # Home, Companies, Directors, Blacklist
│   │   ├── components/     # UploadZone, tables, Modal, Layout
│   │   └── api/client.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── README.md
```

## API endpoints

### PDF extraction

| Method | Endpoint               | Description                                     |
| ------ | ---------------------- | ----------------------------------------------- |
| POST   | `/api/extract-pdf`     | Upload PDF, return preview + extraction payload |
| POST   | `/api/save-extraction` | Persist previewed extraction                    |

### Companies

| Method | Endpoint                                      | Description              |
| ------ | --------------------------------------------- | ------------------------ |
| GET    | `/api/companies`                              | List companies with directors |
| PATCH  | `/api/companies/{id}`                         | Update company           |
| DELETE | `/api/companies/{id}`                         | Delete company           |
| DELETE | `/api/companies/{id}/directors/{director_id}` | Unlink director from company |
| PATCH  | `/api/companies/{id}/blacklist`               | Blacklist company        |
| PATCH  | `/api/companies/{id}/unblacklist`             | Unblacklist company      |

### Directors

| Method | Endpoint                        | Description                    |
| ------ | ------------------------------- | ------------------------------ |
| GET    | `/api/directors`                | List directors (`?status=all\|active\|blacklisted`) |
| POST   | `/api/directors`                | Create director manually       |
| PATCH  | `/api/directors/{id}`           | Update director                |
| DELETE | `/api/directors/{id}`           | Delete director                |
| PATCH  | `/api/directors/{id}/blacklist` | Blacklist director             |
| PATCH  | `/api/directors/{id}/unblacklist` | Unblacklist director         |

### Blacklist

| Method | Endpoint                            | Description                          |
| ------ | ----------------------------------- | ------------------------------------ |
| GET    | `/api/blacklist/companies`          | List blacklisted companies           |
| GET    | `/api/blacklist/directors`          | List blacklisted directors           |
| GET    | `/api/blacklist/suggest-companies`  | Company name suggestions for a NIC   |

### Health

| Method | Endpoint       | Description  |
| ------ | -------------- | ------------ |
| GET    | `/api/health`  | Health check |

## Notes

- Designed for Sri Lankan **Form 1** PDFs; similar forms may work.
- Scanned/image PDFs are supported when using multimodal LLM extraction.
- LLM usage is billed by your provider ([OpenAI](https://openai.com/pricing), [Google AI](https://ai.google.dev/pricing)).
- Auto-blacklisted directors cannot be unblacklisted directly — unblacklist the source company or director first.

## License

Add a license file if you plan to open-source this project (e.g. MIT).
