import hashlib
import json
import secrets
import time
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import HTTPException, Request, Response
from .config import COOKIE_NAME, COOKIE_SECURE, SESSION_SECONDS
from .db import transaction

HASHER = PasswordHasher()
# Used for nonexistent accounts to avoid skipping the password work entirely.
DUMMY_HASH = HASHER.hash(secrets.token_urlsafe(24))


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def verify(password_hash, password):
    try:
        return HASHER.verify(password_hash, password)
    except VerificationError:
        return False


def user_for(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "로그인이 필요해요.")
    with transaction() as con:
        row = con.execute("SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?", (token_hash(token), time.time())).fetchone()
    if row is None:
        raise HTTPException(401, "로그인이 만료됐어요. 다시 로그인해 주세요.")
    return dict(row)


def profile_for(user):
    return {**json.loads(user["profile"]), "username": user["username"], "onboarded": True}


def create_session(con, user_id, request, response: Response):
    old = request.cookies.get(COOKIE_NAME)
    if old:
        con.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(old),))
    con.execute("DELETE FROM sessions WHERE expires_at<=?", (time.time(),))
    token = secrets.token_urlsafe(32)
    con.execute("INSERT INTO sessions VALUES (?,?,?)", (token_hash(token), user_id, time.time() + SESSION_SECONDS))
    response.set_cookie(COOKIE_NAME, token, max_age=SESSION_SECONDS, httponly=True,
                        secure=COOKIE_SECURE, samesite="lax", path="/")


def clear_cookie(response):
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, secure=COOKIE_SECURE, samesite="lax")


def check_login_rate(request, username):
    # No IP or username is stored in cleartext. Single-worker local deployment.
    key = token_hash(f"{request.client.host if request.client else 'unknown'}:{username.lower()}")
    blocked = False
    with transaction() as con:
        con.execute("DELETE FROM login_attempts WHERE expires_at<?", (time.time(),))
        record = con.execute("SELECT * FROM login_attempts WHERE key=?", (key,)).fetchone()
        if record and record["count"] >= 15:
            blocked = True
        elif record:
            con.execute("UPDATE login_attempts SET count=count+1 WHERE key=?", (key,))
        else:
            con.execute("INSERT INTO login_attempts VALUES (?,1,?)", (key, time.time() + 900))
    if blocked:
        raise HTTPException(429, "로그인 시도가 많아요. 15분 뒤 다시 시도해 주세요.")
    return key
