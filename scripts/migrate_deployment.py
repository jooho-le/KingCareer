"""Load ignored deployment settings without printing credentials; migrate only."""
import os
from pathlib import Path
import subprocess
import sys
from dotenv import dotenv_values

root = Path(__file__).resolve().parents[1]
settings = dotenv_values(root / "deployment.env")
url = settings.get("KINGCAREER_DATABASE_URL", "")
if not url or "YOUR-" in url or "PASSWORD" in url:
    raise SystemExit("Fill in the private deployment.env connection settings first.")
environment = dict(os.environ)
environment.update({key: value for key, value in settings.items() if value is not None})
# Prevent local backend/.env from supplying unrelated AI credentials.
environment["KINGCAREER_AI_MODE"] = "template"
environment["KINGCAREER_AI_KEY"] = ""
result = subprocess.run([sys.executable, "-m", "backend.migrate_postgres"], cwd=root, env=environment)
raise SystemExit(result.returncode)
