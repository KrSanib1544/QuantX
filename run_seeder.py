import os
import sys

# Write output to log file immediately
with open("seeder_debug.log", "w", encoding="utf-8") as log_file:
    log_file.write("Starting wrapper...\n")
    try:
        log_file.write("Importing populate_db...\n")
        import backend.populate_db as pdb
        log_file.write("Import successful. Running pdb.populate()...\n")
        pdb.populate()
        log_file.write("Success!\n")
    except Exception as e:
        log_file.write(f"ERROR: {str(e)}\n")
        import traceback
        traceback.print_exc(file=log_file)
