# Company workspaces: access and migration

## Access policy

Workspaces are the studio's account, not entries in the Companies address book.
Each authenticated account can belong to multiple workspaces and selects one at
a time. Google accounts and refresh tokens remain personal.

## Create and switch firms

1. Click **Create firm** below the workspace selector in the sidebar.
2. Enter a firm name (1–100 characters). This creates an independent studio
   workspace, not a client/vendor entry on the Companies page.
3. Save any edits in the current page before continuing. Acknowledge the warning
   that opening another firm discards unsaved page edits, then click **Create and
   open**.
4. The creator becomes **Owner**, and the new firm opens at **Settings → Firm**.
   Complete its profile there; use **Settings → Team** to invite coworkers.
5. Use the workspace selector to switch back. Saved records stay with their
   original firm, and switching asks for confirmation before discarding edits.

Members of another firm can also create their own independent firm. This never
promotes them in the firm they joined. New firms do not inherit projects,
companies, contacts, invitations, teammates or firm profile values; the new
workspace name is displayed until its firm profile is completed. Personal
contact information, snippets and working field values remain personal.

Creation and opening are separate recoverable operations. Retrying the same
creation intent returns the existing firm rather than duplicating it. If the
firm was created but opening it failed, **Open firm** retries switching without
creating another firm. Recovery metadata is kept in the current browser tab,
bound to the signed-in account; it contains no Google credentials.

| Action | Owner | Member |
| --- | --- | --- |
| List/search projects, Dashboard totals | All in selected workspace | Assigned projects only |
| Read/edit proposals, invoices, notes, time and expenses | Yes | Assigned projects only, including financial information |
| Create project | Yes | Yes, automatically assigned to creator |
| Create a separate firm | Yes; creator owns the new firm | Yes; no role change in the current firm |
| Delete project, proposal or invoice | Yes | No |
| Read company/contact address book | All in workspace | Only directly linked to assigned projects; nested links filtered |
| Create/edit/delete address-book records | Yes | No |
| Change project company associations | Accessible workspace records | Only already-visible records |
| Read firm details | Yes | Yes |
| Change firm details | Yes | No |
| Primary contact, content library, working field values | Personal | Personal |
| Invite, assign projects, manage team/roles | Yes | No |

There must always be at least one Owner. Invitations only add Member access;
an Owner may explicitly promote another member. Secure links are single-use,
expire after seven days, and require matching verified Google email. Creating a
new invitation for the same address invalidates earlier pending ones in that
workspace. Removing a member invalidates their pending invitations too.
No invitation emails are automatically sent.

Requests use `X-Workspace-Id`. Missing headers default to the account's original
workspace (or an available membership if that access was transferred). Supplied
inaccessible workspace IDs are rejected, never silently switched. Active
membership is checked on every protected request, rather than trusted from a
long-lived login session. Server request context propagates through repository
calls; project predicates enforce workspace membership and assignment. This
context must never be synthesized from request body ownership fields.

Revocation blocks the **next** request; it cannot undo a completed download or
an already-authorized operation in flight. The UI refreshes membership/revision
on focus and every 15 seconds, clearing scoped caches and remounting forms when
access changes. Requests remain server-protected during that interval.

## Migration and startup

The existing PostgreSQL provider and connection configuration are unchanged.
Before starting this version against any database that has not received the
migration, run:

```sh
npm run db:migrate:workspaces
```

Run with that environment's existing database configuration. Do not point this
command at production until the owner approves the migration and has confirmed
a recoverable backup with their database provider. This task applied the
migration to development only; production was not changed or published.

The SQL migration:
- Runs in one transaction with an advisory lock.
- Adds tables/columns without dropping original data.
- Creates one owned workspace per existing account.
- Copies the existing firm details into that workspace.
- Backfills projects, companies, and contacts without changing record IDs,
  child records, linked document URLs, or personal Google/content data.
- Checks missing workspace ownership before committing.
- Is repeatable and does not merge records between accounts.
- Allows additional firms without changing the unique marker for the original
  workspace, and never gives those firms migration-created members.

Migration memberships are created only for original workspaces with no members; rerunning must not
restore a deliberately removed owner when other members remain. Never use this
migration as a way to reconstruct or reset an existing team's access.

New users get their own workspace lazily on first protected request. Existing
users' email verification starts false; a fresh real Google sign-in populates it
from Google's verified identity before they may accept an invitation. Knowing an
invited email or belonging to its domain does not suffice.

## Verification and reconciliation

```sh
npm run db:migrate:workspaces
npm run check
npm run test:workspaces
npm run test:google
npm run build
```

Workspace tests use synthetic users and records, clean them up, and also run the
legacy migration twice in an isolated schema inside a rolled-back transaction.
They do not call Google or email external recipients.

After a merge into another environment, apply the same migration before
restarting its managed application workflow. Confirm expected project counts,
firm information, and document links using the original owner's account. Then
check an invited member with no assignments and with one assignment.

## Rollback considerations

Before migration, save a database backup and record relevant row counts using
the provider's supported tooling. If the transaction fails, it rolls back
automatically; resolve the reported constraint/setup problem before retrying.
Do not delete records or recreate the database to force migration success.

After users begin collaborating, reverting to the old per-user authorization
would incorrectly hide or expose workspace-owned records. Stop writes and use
an approved backup/forward repair plan instead of dropping workspace columns or
blindly reverting application code. Any restore after new writes risks losing
those writes and requires the owner's informed approval.

## Google and content boundaries

Members must use their own Google document connection and Google Picker.
Workspace membership is not Google Drive sharing. Removing a member from
Studio PM cannot remove their independently granted Drive access or copies they
already made. The owner must manage Google sharing separately when offboarding.
No broader Google scopes or company-wide credentials were introduced.

Personal content snippets and categories stay private, as do saved working field
values. Existing field values are user-owned, not a permanent company record.
Company firm details are read from the active workspace for proposal, invoice,
and consultant document generation; the primary contact remains personal.
Users must load the correct project data and review templates before generating.
