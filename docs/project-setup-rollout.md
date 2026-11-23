# Inline project setup: rollout and acceptance checks

## Scope

Normal `/projects/new` creation, saved inline identity/status, adjacent team and
companies, phases/fees/optional text timelines, and collapsed completed setup.
Project Admin / Project Manager / Designer support several people per role and
several roles per person. New creators are Project Admins, not newly promoted
firm Owners. Existing assignment access is retained without guessed roles.

Project Admins can manage only their assigned project's roster/setup and select
existing same-firm address records in that context. Firm membership/invitations,
global address-book writes and destructive financial/project actions remain
firm Owner-only. Managers/Designers keep ordinary assigned-project editing.

This setup is now integrated with the typed Work in motion running log and
tab-free Documents & billing sections. No project financial/Overview tabs
remain. Supporting forms expand in page, with financial drafts included in
setup/team-change guards; see `project-work-rollout.md` for the final layout
checks and the typed-log prerequisite.

## Apply safely

1. Confirm the database and authorization; do not aim development commands at
   production. Keep the current database provider.
2. For any separately authorized production rollout, first take an
   operator-managed recoverable backup/checkpoint.
3. Apply the workspace and project-work prerequisites if missing, then run
   `npm run db:migrate:project-setup`. It is transactional, serialized and
   repeatable. Production mode requires `CONFIRM_PROJECT_SETUP_MIGRATION=yes`,
   which is a safeguard, not authorization.
4. Start compatible code. The post-merge development setup applies migrations
   before schema push. No production migration/publish was performed here.
5. On older projects, an Owner explicitly assigns Project Admin responsibility.
   They need not configure all old projects at once to keep reading/editing.

The migration adds setup flags/versions, a general timeline and assignment role
arrays. It does not rewrite phase/task IDs, discussions, proposal snapshots,
invoices, contacts or company associations. It does not infer old roles.

## Verification

Automated: `npm run check`, `npm run test:project-setup`,
`npm run test:project-work`, `npm run test:workspaces`,
`npm run test:google`, `npm run build`.

Use fictional practice data in the intended development firm:

| Check | Expected |
| --- | --- |
| Create with name only, leave, return | A real Lead remains; setup is incomplete and expanded; creator is Project Admin. |
| Assign two people to each role; give one several roles | Both assignments and all roles survive save/reload without duplicate membership rows. |
| Configure a pre-role project | Existing access remains, unknown roles are labeled, and an Owner explicitly assigns responsibility. |
| Remove the last Project Admin using team/access/firm removal | Blocked; transfer responsibility first. Last firm Owner protection remains separate. |
| Sign in as an assigned Member who is Project Admin | Can manage this project's team/setup and choose firm companies/contacts; no firm member management, global address editing or unrelated-project access. |
| Sign in as Project Manager/Designer | Can edit ordinary assigned work; cannot change roster, promote self or mark setup complete. |
| Add repeated/custom company roles and linked company/contact | All rows and links survive later metadata-only saves. Foreign-firm references fail atomically. |
| Add an unpriced custom phase with no timeline, then one with `8–10 weeks` | Both save, reorder/archive/reopen correctly; no due date is guessed. |
| Save general timeline and complete setup | Summary stays compact on return; Edit setup reopens inline; missing optional details do not block. |
| Open two editors/sessions and save stale setup/team/phase data | Stale writes are rejected without silently replacing newer data or losing the local draft. |
| Change team while other project drafts are unsaved | Save/cancel drafts first; access refresh must not discard them silently. |
| Narrow viewport (about 390px) | Team/companies stack; all saves, roles and fees remain usable without horizontal page overflow. |
| Existing tasks, proposals and invoices | IDs, discussions and recorded financial snapshots remain intact. |

Record actual outcomes in `docs/uat-checklist.md`; do not mark manual checks as
passed based on API tests alone. Code rollback may retain these additive fields.
Do not drop assignment roles or reconstruct permissions from guessed values.
