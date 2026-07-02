import os
import sys
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Add backend folder to sys.path to import local_db_helper
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
import local_db_helper

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://quantx_user:quantx_password@localhost:5432/quantx_db")

# In case we run without Docker/Postgres, fallback to SQLite.
engine, DATABASE_URL = local_db_helper.get_database_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
