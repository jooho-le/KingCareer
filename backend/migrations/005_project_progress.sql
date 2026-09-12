ALTER TABLE projects ADD COLUMN interest INTEGER CHECK (interest BETWEEN 1 AND 5);
ALTER TABLE project_revisions ADD COLUMN interest INTEGER CHECK (interest BETWEEN 1 AND 5);
ALTER TABLE simulations ADD COLUMN updated_at TEXT;
UPDATE simulations SET updated_at=created_at WHERE updated_at IS NULL;
