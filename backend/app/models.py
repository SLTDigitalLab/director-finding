from sqlalchemy import Boolean, Column, Integer, String, Table, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

company_director = Table(
    "company_director",
    Base.metadata,
    Column("company_id", Integer, ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True),
    Column("director_id", Integer, ForeignKey("directors.id", ondelete="CASCADE"), primary_key=True),
)


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    company_type = Column(String, nullable=True)
    registered_address = Column(String, nullable=True)
    name_approval_number = Column(String, nullable=True)

    directors = relationship("Director", secondary=company_director, back_populates="companies")


class Director(Base):
    __tablename__ = "directors"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True, nullable=False)
    nic_passport = Column(String, unique=True, nullable=True)
    id_type = Column(String, nullable=True)  # NIC | PASSPORT
    id_country = Column(String, nullable=True)
    residential_address = Column(String, nullable=True)
    email = Column(String, nullable=True)

    is_blacklisted = Column(Boolean, default=False, index=True, nullable=False)
    blacklist_company_name = Column(String, nullable=True)
    blacklist_reason = Column(String, nullable=True)
    blacklist_notes = Column(String, nullable=True)
    blacklist_auto = Column(Boolean, default=False, nullable=False)

    companies = relationship("Company", secondary=company_director, back_populates="directors")


class BlacklistedCompany(Base):
    __tablename__ = "blacklisted_companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    reason = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    is_explicit = Column(Boolean, default=False, nullable=False)

