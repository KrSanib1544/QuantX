import os
import logging
from sqlalchemy import text
import sys

sys.path.insert(0, os.path.dirname(__file__))
import local_db_helper

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("quantx.db_initializer")

def init_postgres_db(database_url: str):
    logger.info(f"Initializing PostgreSQL database: {database_url}")
    engine, _ = local_db_helper.get_database_engine(database_url, logger)
    
    schema_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../infrastructure/postgres/schema.sql"))
    if not os.path.exists(schema_path):
        logger.error(f"PostgreSQL schema SQL file not found at: {schema_path}")
        raise FileNotFoundError(f"Schema SQL file not found at: {schema_path}")
        
    with open(schema_path, "r") as f:
        schema_sql = f.read()
        
    with engine.begin() as conn:
        logger.info("Executing DDL schema SQL...")
        # Split by semicolon to execute commands individually
        # Strip out comments and empty statements
        statements = []
        current_stmt = []
        for line in schema_sql.split("\n"):
            line_stripped = line.strip()
            if not line_stripped or line_stripped.startswith("--"):
                continue
            current_stmt.append(line)
            if line_stripped.endswith(";"):
                statements.append("\n".join(current_stmt))
                current_stmt = []
                
        for stmt in statements:
            stmt_stripped = stmt.strip()
            if stmt_stripped:
                # Adjust PostgreSQL-specific constructs when running on SQLite dialect for tests
                if conn.dialect.name == "sqlite":
                    if "CREATE EXTENSION" in stmt_stripped.upper():
                        logger.info(f"Skipping PG-specific command on SQLite: {stmt_stripped}")
                        continue
                    stmt_stripped = stmt_stripped.replace("DEFAULT uuid_generate_v4()", "")
                    stmt_stripped = stmt_stripped.replace("UUID", "TEXT")
                    stmt_stripped = stmt_stripped.replace("WITH TIME ZONE", "")
                conn.execute(text(stmt_stripped))
                
    logger.info("PostgreSQL database tables and indexes initialized successfully.")

if __name__ == "__main__":
    url = os.getenv("DATABASE_URL", "postgresql://quantx_user:quantx_password@localhost:5432/quantx_db")
    init_postgres_db(url)
