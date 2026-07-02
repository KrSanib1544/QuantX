import sys
import os
import pytest
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))
from init_db import init_postgres_db

def test_postgres_db_initialization():
    # Use a temporary file-based SQLite database for persistence
    db_file = "test_init.db"
    test_db_url = f"sqlite:///{db_file}"
    
    if os.path.exists(db_file):
        os.remove(db_file)
        
    try:
        # Run the initialization
        init_postgres_db(test_db_url)
        
        # Verify tables are created
        import sqlalchemy
        engine = sqlalchemy.create_engine(test_db_url)
        with engine.connect() as conn:
            res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';")).fetchall()
            table_names = [r[0] for r in res]
            
        print(f"Created tables: {table_names}")
        
        # Assert key tables defined in schema.sql exist
        assert "assets" in table_names
        assert "prices" in table_names
        assert "signals" in table_names
        assert "trades" in table_names
    finally:
        # Clean up the file
        if os.path.exists(db_file):
            try:
                os.remove(db_file)
            except Exception:
                pass
