CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, profile TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS saved (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, career_id TEXT NOT NULL,
 PRIMARY KEY(user_id,career_id)
);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 career_id TEXT NOT NULL, kind TEXT NOT NULL, statement TEXT NOT NULL,
 evidence TEXT NOT NULL, created_at TEXT NOT NULL, source_key TEXT NOT NULL,
 UNIQUE(user_id,source_key)
);
CREATE INDEX IF NOT EXISTS events_user ON events(user_id,career_id);
CREATE TABLE IF NOT EXISTS activities (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 career_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL,
 source_key TEXT NOT NULL, UNIQUE(user_id,source_key)
);
CREATE TABLE IF NOT EXISTS diagnoses (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 career_id TEXT NOT NULL, answers TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS simulations (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 career_id TEXT NOT NULL, state TEXT NOT NULL, version INTEGER NOT NULL,
 completed INTEGER NOT NULL DEFAULT 0, checkpoint_version INTEGER NOT NULL DEFAULT -1,
 created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_simulation ON simulations(user_id,career_id) WHERE completed=0;
CREATE TABLE IF NOT EXISTS projects (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, career_id TEXT NOT NULL,
 answers TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
 PRIMARY KEY(user_id,career_id)
);
CREATE TABLE IF NOT EXISTS project_revisions (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, career_id TEXT NOT NULL,
 version INTEGER NOT NULL, answers TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,career_id,version)
);
CREATE TABLE IF NOT EXISTS requests (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL, body_hash TEXT NOT NULL, response TEXT NOT NULL,
 created_at TEXT NOT NULL, PRIMARY KEY(user_id,request_key)
);
CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at REAL NOT NULL);
