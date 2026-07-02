import os
import sys
import logging

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
import local_db_helper

logger = logging.getLogger("ai-prediction-service.database")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://quantx_user:quantx_password@localhost:5432/quantx_db")
engine, DATABASE_URL = local_db_helper.get_database_engine(DATABASE_URL, logger)
