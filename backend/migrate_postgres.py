"""Explicit release migration: python -m backend.migrate_postgres.

Use KINGCAREER_DATABASE_URL, preferably a session/direct connection. No DSN is logged.
The private schema is not exposed to Supabase's browser Data API.
"""
from .config import DATABASE_URL, POSTGRES_SCHEMA, ROOT
from .db import configure_postgres, now, postgres_connection, TRANSACTION_LOCK
from psycopg import sql


def migrate():
    if not DATABASE_URL:
        raise RuntimeError("Set KINGCAREER_DATABASE_URL in the server environment first.")
    with postgres_connection() as con:
        con.execute("SELECT pg_advisory_xact_lock(%s)", (TRANSACTION_LOCK,))
        con.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(POSTGRES_SCHEMA)))
        con.execute(sql.SQL("REVOKE ALL ON SCHEMA {} FROM PUBLIC").format(sql.Identifier(POSTGRES_SCHEMA)))
        configure_postgres(con)
        con.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
        applied = {row["version"] for row in con.execute("SELECT version FROM schema_migrations")}
        for migration in sorted((ROOT / "backend" / "postgres").glob("*.sql")):
            version = int(migration.name.split("_")[0])
            if version not in applied:
                con.execute(migration.read_text(encoding="utf-8"), prepare=False)
                con.execute("INSERT INTO schema_migrations VALUES (%s,%s)", (version, now()))
        tables = con.execute("SELECT tablename FROM pg_tables WHERE schemaname=%s", (POSTGRES_SCHEMA,)).fetchall()
        for row in tables:
            con.execute(sql.SQL("ALTER TABLE {}.{} ENABLE ROW LEVEL SECURITY").format(sql.Identifier(POSTGRES_SCHEMA), sql.Identifier(row["tablename"])))
        # Supabase roles exist in hosted projects, but not on ordinary PostgreSQL.
        for role in ("anon", "authenticated"):
            if con.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,)).fetchone():
                con.execute(sql.SQL("REVOKE ALL ON SCHEMA {} FROM {}").format(sql.Identifier(POSTGRES_SCHEMA), sql.Identifier(role)))
                con.execute(sql.SQL("REVOKE ALL ON ALL TABLES IN SCHEMA {} FROM {}").format(sql.Identifier(POSTGRES_SCHEMA), sql.Identifier(role)))
    print("KingCareer PostgreSQL migrations applied. Student records were not imported.")


if __name__ == "__main__":
    try:
        migrate()
    except Exception as error:
        raise SystemExit(f"Migration failed ({type(error).__name__}); verify the private connection settings and permissions.") from None
