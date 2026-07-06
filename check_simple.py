print("Importing populate_db...")
import sys
import os
sys.path.insert(0, r"c:\KrSanib\Resume Projects\QuantX\.venv\Lib\site-packages")
sys.path.insert(0, "backend")
import populate_db
print("Imported successfully! Calling populate()...")
populate_db.populate()
print("Populated successfully!")
