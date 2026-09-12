"""Run from the repository root: python -m backend.scripts.init_db"""
from backend.db import initialize

if __name__ == "__main__":
    initialize()
    print("KingCareer SQLite migrations applied. No sample students or activity records created.")
