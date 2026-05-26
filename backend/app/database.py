import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


def _sqlalchemy_postgresql_url(url: str) -> str:
    """Use psycopg v3 driver; bare postgresql:// defaults to psycopg2 in SQLAlchemy."""
    if "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if scheme == "postgresql":
        return f"postgresql+psycopg://{rest}"
    return url


DATABASE_URL = _sqlalchemy_postgresql_url(
    os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/company_registry",
    )
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
