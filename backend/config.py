import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "backend" / ".env")
DATA_DIR = Path(os.getenv("KINGCAREER_DATA_DIR", str(ROOT / "backend" / "storage")))
if not DATA_DIR.is_absolute():
    DATA_DIR = ROOT / DATA_DIR
PUBLIC_ORIGIN = os.getenv("KINGCAREER_PUBLIC_ORIGIN", "http://127.0.0.1:8000").rstrip("/")
ALLOWED_ORIGINS = {x.strip().rstrip("/") for x in os.getenv(
    "KINGCAREER_ALLOWED_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000,http://localhost:8000",
).split(",") if x.strip()}
ALLOWED_ORIGINS.add(PUBLIC_ORIGIN)
COOKIE_SECURE = os.getenv("KINGCAREER_COOKIE_SECURE", "false").lower() == "true"
SESSION_SECONDS = max(1, min(30, int(os.getenv("KINGCAREER_SESSION_DAYS", "7")))) * 86400
COOKIE_NAME = "kingcareer_session"
AI_MODE = os.getenv("KINGCAREER_AI_MODE", "template")
AI_URL = os.getenv("KINGCAREER_AI_URL", "").rstrip("/")
AI_MODEL = os.getenv("KINGCAREER_AI_MODEL", "")
AI_KEY = os.getenv("KINGCAREER_AI_KEY", "")
