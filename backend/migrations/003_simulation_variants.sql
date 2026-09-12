ALTER TABLE simulations ADD COLUMN variant TEXT NOT NULL DEFAULT 'classic';
UPDATE simulations SET variant='fieldwork' WHERE json_type(state, '$.fieldwork')='object';
DROP INDEX one_active_simulation;
CREATE UNIQUE INDEX one_active_simulation ON simulations(user_id,career_id,variant) WHERE completed=0;
