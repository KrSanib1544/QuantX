import sys
import os

# Set sys.path so we can import backend packages
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".venv", "Lib", "site-packages")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

print("Wrapper: sys.path initialized")
import populate_db
print("Wrapper: populate_db imported successfully")

try:
    print("Wrapper: Calling populate_db.populate()...")
    populate_db.populate()
    print("Wrapper: populate() executed successfully!")
except Exception as e:
    print(f"Wrapper: Exception occurred: {e}")
    import traceback
    traceback.print_exc()
