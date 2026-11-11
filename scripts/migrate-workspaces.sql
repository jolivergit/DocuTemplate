-- Repeatable, additive migration. Execute as a single transaction.
SELECT pg_advisory_xact_lock(731173);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS workspaces (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 legacy_owner_id varchar NOT NULL UNIQUE REFERENCES users(id),
 firm jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS workspace_members (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'Member' CHECK (role IN ('Owner','Member')),
 CONSTRAINT workspace_member_unique UNIQUE(workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS workspace_invitations (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 email text NOT NULL, token_hash text NOT NULL UNIQUE, expires_at timestamp NOT NULL, consumed_at timestamp
);
CREATE TABLE IF NOT EXISTS project_assignments (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id integer NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
 member_id varchar NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
 CONSTRAINT project_assignment_unique UNIQUE(lead_id,member_id)
);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS workspace_id varchar REFERENCES workspaces(id);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS workspace_id varchar REFERENCES workspaces(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS workspace_id varchar REFERENCES workspaces(id);
INSERT INTO workspaces (name,legacy_owner_id,firm)
SELECT COALESCE(p.name, u.name || '''s workspace'),u.id,
 jsonb_build_object('name',p.name,'phone',p.phone,'email',p.email,'addressLine1',p.address_line_1,
 'addressLine2',p.address_line_2,'city',p.city,'state',p.state,'zip',p.zip)
FROM users u LEFT JOIN LATERAL (SELECT * FROM profiles WHERE user_id=u.id ORDER BY created_at LIMIT 1) p ON true
ON CONFLICT (legacy_owner_id) DO NOTHING;
-- Never re-add someone to an existing workspace after intentional removal.
INSERT INTO workspace_members (workspace_id,user_id,role)
SELECT w.id,w.legacy_owner_id,'Owner' FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id)
ON CONFLICT DO NOTHING;
UPDATE leads l SET workspace_id=w.id FROM workspaces w WHERE l.user_id=w.legacy_owner_id AND l.workspace_id IS NULL;
UPDATE companies c SET workspace_id=w.id FROM workspaces w WHERE c.user_id=w.legacy_owner_id AND c.workspace_id IS NULL;
UPDATE contacts c SET workspace_id=w.id FROM workspaces w WHERE c.user_id=w.legacy_owner_id AND c.workspace_id IS NULL;
ALTER TABLE leads ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE companies ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE contacts ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS leads_workspace_idx ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS companies_workspace_idx ON companies(workspace_id);
CREATE INDEX IF NOT EXISTS contacts_workspace_idx ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id);
