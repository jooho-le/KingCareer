CREATE TABLE career_reviews (
 activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 data TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX career_reviews_user ON career_reviews(user_id, updated_at);
