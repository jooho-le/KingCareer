"""Local SQLite or Supabase PostgreSQL with cross-instance transaction serialization."""
from contextlib import closing, contextmanager
from datetime import datetime, timezone
import json
import sqlite3
import threading
from .config import DATA_DIR, ROOT, DATABASE_URL, POSTGRES_SCHEMA
import psycopg
from psycopg.rows import dict_row
from psycopg import sql as pgsql

WRITE_LOCK = threading.RLock()
INTEGRITY_ERRORS = (sqlite3.IntegrityError, psycopg.IntegrityError)
PG_SCHEMA_VERSION = 1
# The MVP intentionally serializes short DB transactions across all instances.
# Model/network calls remain outside transactions. No session advisory locks:
# transaction-scoped locks work through Supabase's transaction pooler.
TRANSACTION_LOCK = 704296831


class Record(dict):
    def __getitem__(self, key):
        return list(self.values())[key] if isinstance(key, int) else super().__getitem__(key)


class Cursor:
    def __init__(self, cursor):
        self.cursor = cursor

    def fetchone(self):
        row = self.cursor.fetchone()
        return Record(row) if row is not None else None

    def fetchall(self):
        return [Record(row) for row in self.cursor.fetchall()]

    def __iter__(self):
        return (Record(row) for row in self.cursor)


def pg_parameters(statement):
    """Translate application qmark parameters, preserving quoted SQL literals."""
    result, quoted, i = [], False, 0
    while i < len(statement):
        char = statement[i]
        if char == "'":
            if quoted and i + 1 < len(statement) and statement[i + 1] == "'":
                result.append("''")
                i += 2
                continue
            quoted = not quoted
        result.append("%s" if char == "?" and not quoted else "%%" if char == "%" else char)
        i += 1
    return "".join(result)


class PostgresConnection:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, statement, parameters=()):
        return Cursor(self.connection.execute(pg_parameters(statement), parameters))

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def close(self):
        self.connection.close()


def postgres_connection(url=None):
    # prepare_threshold=None is required for transaction-mode Supavisor.
    return psycopg.connect(url or DATABASE_URL, row_factory=dict_row,
                           prepare_threshold=None, connect_timeout=10)


def configure_postgres(connection):
    connection.execute(pgsql.SQL("SET LOCAL search_path TO {}, pg_catalog").format(pgsql.Identifier(POSTGRES_SCHEMA)))
    connection.execute("SET LOCAL statement_timeout = '20s'")
    connection.execute("SET LOCAL lock_timeout = '10s'")


def now():
    return datetime.now(timezone.utc).isoformat()


def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def connect():
    connection = sqlite3.connect(DATA_DIR / "kingcareer.db", timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA busy_timeout=15000")
    return connection


@contextmanager
def transaction():
    if DATABASE_URL:
        with postgres_connection() as connection:
            configure_postgres(connection)
            connection.execute("SELECT pg_advisory_xact_lock(%s)", (TRANSACTION_LOCK,))
            yield PostgresConnection(connection)
        return
    with WRITE_LOCK:
        con = connect()
        try:
            con.execute("BEGIN IMMEDIATE")
            yield con
            con.commit()
        except BaseException:
            con.rollback()
            raise
        finally:
            con.close()


def initialize():
    if DATABASE_URL:
        # Migrations are an explicit release step, never run on cold starts.
        with postgres_connection() as con:
            configure_postgres(con)
            row = con.execute("SELECT MAX(version) AS version FROM schema_migrations").fetchone()
            if row["version"] != PG_SCHEMA_VERSION:
                raise RuntimeError("Run python -m backend.migrate_postgres before starting the API.")
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as con, con:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
        applied = {row[0] for row in con.execute("SELECT version FROM schema_migrations")}
        for migration in sorted((ROOT / "backend" / "migrations").glob("*.sql")):
            version = int(migration.name.split("_")[0])
            if version not in applied:
                con.executescript("BEGIN IMMEDIATE;\n" + migration.read_text(encoding="utf-8"))
                con.execute("INSERT INTO schema_migrations VALUES (?,?)", (version, now()))
                con.commit()
