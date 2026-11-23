# Project work and running-log rollout

## Scope and destructive effect

The project is the source of shared phases and fee inputs. Tasks use stable project-phase identities; proposal-owned phase/fee rows are document/financial snapshots, not independently maintained project phases.

The user approved replacing standalone Project Notes without keeping its data. The project-work migration **deletes all old project_comments rows once in the target database**. It does not convert or archive them, and never deletes project_task_notes. The old note routes return 410.

Development migration was applied during implementation. This is not production rollout authorization, a production data inspection, or UAT sign-off.

## Typed running log

Work in motion now uses the existing task table in place for **Task**, **Reminder**,
**Meeting** and **Note**. It does not create task/log copies. Task-era IDs, dates,
assignments, archive/version state and discussion relationships remain intact.
Legacy author attribution stays unknown; new entries record their actual author.
The running-log migration never deletes/restores standalone notes or discussions.

Apply `npm run db:migrate:project-log` after the existing workspace, project-work
and project-setup prerequisites, before starting compatible code. The migration
adds kind, meeting date/time, author and retry metadata and allows non-actionable
entries to have null task fields. It is transactional and repeatable. Production
mode additionally requires `CONFIRM_PROJECT_LOG_MIGRATION=yes`, not a substitute
for explicit rollout authorization and a recoverable backup. Development only
was migrated here; no production migration/publish was performed.

New entry creation requires a persistent per-intent request ID. Repeating the
same request returns the existing entry, even if later edited. Reusing it with
different content/author is a conflict, not an overwrite. Discussions retain
their own retry keys and author snapshots. The old task endpoints remain
task-only; they cannot expose/mutate meetings, notes or reminders. Legacy create
clients can supply `requestId`; older clients omitting it cannot safely assume
that independently repeated POSTs are the same intent.

Kind is immutable after saving. Task/reminder metrics exclude meetings/notes;
meeting date/time and project duration estimates never become task due dates.
Project-context prefilling is explicit, reviewable draft text, never an automatic
event, assignee selection, notification or calendar invitation.

## Final single-page project layout

The project page now follows identity/status, team/companies, phases/fees/optional
timeline, Work in motion, then progressively disclosed Documents & billing.
Project tabs and routine record dialogs are replaced by in-page sections and
editors. Delete/loss confirmations and actual Google authorization/file-selection
windows remain justified exceptions.

This final presentation step requires no additional database migration. Keep the
workspace, shared-work, setup and typed-log prerequisites above; installing this
UI on an unmigrated database is not supported. Only development was exercised.
Production backup, prerequisites, migration approval and publishing remain
separate operator decisions; none is authorized by completing development work.

Financial repositories and issued snapshots are not replaced. Additional
Services client requests must match the existing accepted input names, and
previews must subtract previous billing using the server's existing rules.
Time/expense attachment remains single-use; archived/saved data is not recreated
when a section opens. Billing-context failures must be visible, not defaulted to
zero previous billing. Draft/active-save guards also cover team-access refresh
and real navigation exits.

Required checks include `npm run check`, `npm run build`,
`npm run test:project-work` (signed snapshot/cumulative/attachment boundaries) and
`npm run test:project-page` (same-tab navigation versus safe reading links).
Financial drafts must remain mounted if live project status becomes ineligible;
pause writes with an explanatory warning, keep Cancel/Return, and permit setup
to restore the stage. Do not turn ordinary disclosure/read actions into loss
confirmations.

Same-document browser history requires router-level protection: accepted route
snapshots remain on the project during cancelled Back/Forward restoration.
Track entries at bootstrap, preserve existing history state, and test both
directions plus asynchronous rollback. Link-click/beforeunload warnings alone
do not cover this. Standard/AS saves expose a separate pending mutation channel;
internal Return/type-switch/record-selection must block until settlement, even
when a user would otherwise confirm discarding a dirty editor.

## Apply

1. Confirm the target database/environment and authorization. Do not point development tooling at production.
2. Before an authorized production rollout, take an operator-managed recoverable database backup/checkpoint and record the release. The code rollback alone cannot recover deliberately deleted notes.
3. Run the existing workspace migration if needed, then `npm run db:migrate:project-work`. It is transactional, serialized, and repeatable. The migration runner refuses a production-mode run without explicit `CONFIRM_PROJECT_WORK_MIGRATION=yes`; setting this flag does not itself grant authorization.
4. Deploy compatible application code and restart its workflow. The post-merge development setup runs the migration before schema push. Review production schema application separately; no production changes are performed by the development task.
5. Existing projects with proposal phases show an explicit source-selection screen. Review source names/phase totals and choose the intended proposal, or deliberately start empty. The operation is transactional and same-choice retries do not duplicate data. Conflicting proposals are not merged by name or summed.
6. New projects can add phases/fees before a proposal exists. Standard proposal forms select shared phase IDs; legacy clients sending editable phase copies receive an error.

## Financial compatibility

- Existing proposal phase/fee IDs and amounts are retained. Selecting a legacy source adds shared records and a reference from its existing phase snapshots without altering recorded values.
- Unissued Draft/Revision views reuse current shared values for selected mapped phases. An explicit scope selection is required for unresolved legacy drafts; document URL-only updates do not erase legacy scope.
- Preparing/refreshing an unissued scope and issuing/signing it materialize current inputs into stable proposal-owned financial snapshots. An issued proposal cannot be put back into Draft/Revision to bypass protection; create a new draft instead.
- Sent/Signed and other issued/closed proposal snapshots and already generated documents stay unchanged when shared project data is edited. Existing invoices and consultant contracts continue using their recorded proposal/fee IDs.
- Existing invoices or consultant contracts also lock a legacy proposal's financial basis even if an older app version put its status back into Draft/Revision.
- An empty document selection stays empty during refresh, signing and status changes; newly created project phases are never selected implicitly. Metadata-only edits omit scope changes. Unmapped legacy proposals keep their original fee breakdown until the user deliberately selects replacement scope; their refresh action refuses to guess.
- Deleting a proposal document cannot cascade into project-owned phases, project fees, or tasks. Phase archive retains task/financial references.
- Timeline is optional display information, not fee arithmetic, invoice scheduling, or a task due-date calculation.

## Verify and recover

Run `npm run check`, `npm run test:project-log`, `npm run test:project-work`, `npm run test:project-setup`, `npm run test:workspaces`, `npm run test:google`, and `npm run build`. Follow the log/phase UAT sections using fictional authorized practice data. Record actual outcomes, not assumed passes.

If application rollback is required, prefer rolling back code while retaining the additive work tables and snapshot links. Do not drop shared phases while tasks reference them. Original legacy proposal financial rows remain available; restore deleted standalone notes only from an authorized pre-migration backup if the business reverses its decision. Re-running the migration does not undo note deletion or delete new task notes.
