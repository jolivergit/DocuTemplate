-- Additive shared phase/task model. Legacy proposal rows remain issued snapshots.
CREATE TABLE IF NOT EXISTS project_work_setup (
  lead_id integer PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  source_proposal_id varchar,
  initialized_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_phases (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id integer NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name text NOT NULL,
  timeline text,
  sort_order integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS project_phases_lead_idx ON project_phases(lead_id);
CREATE TABLE IF NOT EXISTS project_phase_fees (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id varchar NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  consultant text NOT NULL,
  fee_type text NOT NULL DEFAULT 'Fixed',
  amount numeric(12,2),
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS project_phase_fees_phase_idx ON project_phase_fees(phase_id);
ALTER TABLE proposal_phases ADD COLUMN IF NOT EXISTS project_phase_id varchar REFERENCES project_phases(id) ON DELETE SET NULL;
ALTER TABLE proposal_phases ADD COLUMN IF NOT EXISTS timeline text;
CREATE TABLE IF NOT EXISTS project_tasks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id integer NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  phase_id varchar REFERENCES project_phases(id),
  assignee_id varchar REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low','Normal','High','Urgent')),
  status text NOT NULL DEFAULT 'To do' CHECK (status IN ('To do','In progress','Blocked','Done')),
  due_date text,
  archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_tasks_lead_idx ON project_tasks(lead_id);
CREATE TABLE IF NOT EXISTS project_task_notes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id varchar NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author_id varchar REFERENCES users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  content text NOT NULL,
  request_id varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_task_notes_task_idx ON project_task_notes(task_id);
CREATE UNIQUE INDEX IF NOT EXISTS project_task_note_request_unique ON project_task_notes(task_id,request_id);
-- Delete the retired feature's data once, never touch task discussions.
CREATE TABLE IF NOT EXISTS app_data_migrations (name text PRIMARY KEY, applied_at timestamp NOT NULL DEFAULT now());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_data_migrations WHERE name = 'retire-project-comments') THEN
    DELETE FROM project_comments;
    INSERT INTO app_data_migrations(name) VALUES ('retire-project-comments');
  END IF;
END $$;
