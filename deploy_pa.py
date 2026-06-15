import subprocess, os, sys
from pathlib import Path

PROJECT = Path.home() / "Inventario-it"
WSGI_PATH = Path("/var/www/derbydx_pythonanywhere_com_wsgi.py")

if not WSGI_PATH.exists():
    print(f"WSGI file not found: {WSGI_PATH}")
    sys.exit(1)

os.chdir(PROJECT)

result = subprocess.run(["git", "pull", "origin", "WebProduction"], capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print(result.stderr)
if result.returncode != 0:
    print("Git pull failed")
    sys.exit(1)

WSGI_PATH.touch()
print("Web app reload triggered")
