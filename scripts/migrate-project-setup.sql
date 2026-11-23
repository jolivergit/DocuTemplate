ALTER TABLE leads ADD COLUMN IF NOT EXISTS general_timeline text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS setup_version integer NOT NULL DEFAULT 1;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS team_version integer NOT NULL DEFAULT 1;
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS roles jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Old assignments intentionally retain empty role lists. Their access is unchanged.
