"""Short-lived distributed leases for model requests; no DB lock over network I/O."""
import secrets
import threading
import time
from .config import DATABASE_URL
from .db import transaction


class OperationLock:
    def __init__(self, key):
        self.key = key
        self.local = threading.Lock()
        self.owner = threading.local()

    def acquire(self, blocking=False):
        if not DATABASE_URL:
            return self.local.acquire(blocking=blocking)
        token, timestamp = secrets.token_hex(24), time.time()
        with transaction() as con:
            con.execute("DELETE FROM operation_leases WHERE key=? AND expires_at<?", (self.key, timestamp))
            if con.execute("SELECT 1 FROM operation_leases WHERE key=?", (self.key,)).fetchone():
                return False
            con.execute("INSERT INTO operation_leases VALUES (?,?,?)", (self.key, token, timestamp + 120))
        self.owner.token = token
        return True

    def release(self):
        if not DATABASE_URL:
            return self.local.release()
        token = getattr(self.owner, "token", None)
        if token:
            with transaction() as con:
                con.execute("DELETE FROM operation_leases WHERE key=? AND token=?", (self.key, token))
            self.owner.token = None
