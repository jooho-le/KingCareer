CREATE TABLE users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE CHECK (username = lower(username)),
 password_hash TEXT NOT NULL, profile TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE saved (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, career_id TEXT NOT NULL,
 PRIMARY KEY(user_id,career_id)
);
CREATE TABLE events (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 career_id TEXT NOT NULL, kind TEXT NOT NULL, statement TEXT NOT NULL,
 evidence TEXT NOT NULL, created_at TEXT NOT NULL, source_key TEXT NOT NULL,
 UNIQUE(user_id,source_key)
);
CREATE INDEX events_user ON events(user_id,career_id);
CREATE TABLE activities (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 career_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL,
 source_key TEXT NOT NULL, UNIQUE(user_id,source_key)
);
CREATE TABLE diagnoses (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 career_id TEXT NOT NULL, answers TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX diagnoses_user ON diagnoses(user_id);
CREATE TABLE simulations (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 career_id TEXT NOT NULL, state TEXT NOT NULL, version INTEGER NOT NULL,
 completed INTEGER NOT NULL DEFAULT 0, checkpoint_version INTEGER NOT NULL DEFAULT -1,
 created_at TEXT NOT NULL, variant TEXT NOT NULL DEFAULT 'classic', updated_at TEXT
);
CREATE UNIQUE INDEX one_active_simulation ON simulations(user_id,career_id,variant) WHERE completed=0;
CREATE TABLE projects (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, career_id TEXT NOT NULL,
 answers TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
 scene TEXT, interest INTEGER CHECK (interest BETWEEN 1 AND 5), PRIMARY KEY(user_id,career_id)
);
CREATE TABLE project_revisions (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, career_id TEXT NOT NULL,
 version INTEGER NOT NULL, answers TEXT NOT NULL, created_at TEXT NOT NULL,
 scene TEXT, interest INTEGER CHECK (interest BETWEEN 1 AND 5), PRIMARY KEY(user_id,career_id,version)
);
CREATE TABLE requests (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL, body_hash TEXT NOT NULL, response TEXT NOT NULL,
 created_at TEXT NOT NULL, PRIMARY KEY(user_id,request_key)
);
CREATE TABLE login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at DOUBLE PRECISION NOT NULL);
CREATE TABLE career_reviews (
 activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 data TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX career_reviews_user ON career_reviews(user_id, updated_at);
CREATE TABLE operation_leases (key TEXT PRIMARY KEY, token TEXT NOT NULL, expires_at DOUBLE PRECISION NOT NULL);
