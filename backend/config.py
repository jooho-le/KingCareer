import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
ON_VERCEL = os.getenv("VERCEL") == "1"
if not ON_VERCEL:
    load_dotenv(ROOT / "backend" / ".env")
DATABASE_URL = os.getenv("KINGCAREER_DATABASE_URL", "")
if ON_VERCEL and not DATABASE_URL:
    raise RuntimeError("KINGCAREER_DATABASE_URL must be configured for Vercel; local SQLite is not a deployment database.")
POSTGRES_SCHEMA = os.getenv("KINGCAREER_DATABASE_SCHEMA", "kingcareer")
DATA_DIR = Path(os.getenv("KINGCAREER_DATA_DIR", str(ROOT / "backend" / "storage")))
if not DATA_DIR.is_absolute():
    DATA_DIR = ROOT / DATA_DIR
PUBLIC_ORIGIN = os.getenv("KINGCAREER_PUBLIC_ORIGIN", "http://127.0.0.1:8000").rstrip("/")
if ON_VERCEL and not PUBLIC_ORIGIN.startswith("https://"):
    raise RuntimeError("Set KINGCAREER_PUBLIC_ORIGIN to the public HTTPS deployment origin.")
ALLOWED_ORIGINS = {x.strip().rstrip("/") for x in os.getenv(
    "KINGCAREER_ALLOWED_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000,http://localhost:8000",
).split(",") if x.strip()}
ALLOWED_ORIGINS.add(PUBLIC_ORIGIN)
if ON_VERCEL:
    for name in ("VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"):
        if os.getenv(name):
            ALLOWED_ORIGINS.add("https://" + os.environ[name])
COOKIE_SECURE = ON_VERCEL or os.getenv("KINGCAREER_COOKIE_SECURE", "false").lower() == "true"
SESSION_SECONDS = max(1, min(30, int(os.getenv("KINGCAREER_SESSION_DAYS", "7")))) * 86400
COOKIE_NAME = "kingcareer_session"
AI_MODE = os.getenv("KINGCAREER_AI_MODE", "template")
AI_URL = os.getenv("KINGCAREER_AI_URL", "").rstrip("/")
AI_MODEL = os.getenv("KINGCAREER_AI_MODEL", "")
AI_KEY = os.getenv("KINGCAREER_AI_KEY", "")
AI_PROVIDER = os.getenv("KINGCAREER_AI_PROVIDER", "gemini")
