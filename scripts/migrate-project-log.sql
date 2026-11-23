-- Evolve existing rows in place: never copy tasks or their discussions.
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'Task';
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS meeting_date text;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS meeting_time text;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS author_id varchar REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS creation_request_id varchar;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS creation_fingerprint text;
ALTER TABLE project_tasks ALTER COLUMN priority DROP NOT NULL;
ALTER TABLE project_tasks ALTER COLUMN status DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS project_entry_creation_unique ON project_tasks(lead_id,creation_request_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='project_tasks'::regclass AND conname='project_entries_shape_check') THEN
    ALTER TABLE project_tasks ADD CONSTRAINT project_entries_shape_check CHECK (
      (entry_type='Task' AND priority IS NOT NULL AND status IS NOT NULL AND meeting_date IS NULL AND meeting_time IS NULL)
      OR (entry_type='Reminder' AND priority IS NULL AND status IN ('To do','Done') AND status IS NOT NULL AND meeting_date IS NULL AND meeting_time IS NULL)
      OR (entry_type IN ('Meeting','Note') AND priority IS NULL AND status IS NULL AND due_date IS NULL
        AND (entry_type='Meeting' OR (meeting_date IS NULL AND meeting_time IS NULL)))
    );
  END IF;
END $$;
-- Legacy author attribution is deliberately unknown. No old notes are restored,
-- no task IDs/dates/assignments/archives/financial links/discussions are changed.
