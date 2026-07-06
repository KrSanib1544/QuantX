import os
import sys

print("Starting script")
try:
    print("Injecting path")
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".venv", "Lib", "site-packages")))
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))
    
    print("Importing populate_db")
    import populate_db
    
    print("Calling populate()")
    populate_db.populate()
    print("Completed successfully!")
except Exception as e:
    print(f"Exception: {e}")
    import traceback
    traceback.print_exc()
