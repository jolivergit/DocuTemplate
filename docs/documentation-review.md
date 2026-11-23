# Documentation review for UAT

## Project-work update — November 22, 2026

The guide and UAT checklist now cover task-first project pages, shared phases and fees, custom/ad-hoc phases, optional duration ranges, task assignees/status/priority/due dates, attributed task discussions, archive/restore, conflict recovery, and proposal preparation without duplicate entry. The legacy Notes tab and its data are deliberately retired; no old-note archive is promised.

See `docs/project-work-rollout.md` for the migration's destructive effect, explicit legacy-source reconciliation, issued financial snapshots, and environment boundaries. Printable HTML has been regenerated, and its internal links checked. The checklist's added cases remain **Not run** until someone records user-acceptance results; engineering checks are not UAT acceptance.

The earlier documentation-only review below is historical. Its feature descriptions and referenced Notes component reflect the app at that time, not the current task-based workflow.

## Historical review — November 14, 2026

## Scope and outcome

This was a read-only review of implemented app behavior followed by documentation
edits. Application features, permissions, Google settings, user records and
production configuration were not changed. No migration, new browser UAT run,
security audit or live Google generation test was performed for this refresh.

The canonical collaboration instruction is now prominent in `replit.md`:
**Do not suggest follow-up tasks unless I ask.** The temporary duplicate memory
topic was removed after that instruction was saved. No follow-up tasks were
created or suggested.

## Material corrections

| Topic | What was checked and corrected |
| --- | --- |
| Firm creation | Added the actual Create firm → acknowledgement → Create and open flow, automatic Owner membership, empty records, safe same-intent retry and separate Open firm recovery. |
| Firm selection | Explained differing roles in multiple firms, browser-tab selection, unsaved-edit warnings, active-save protection and separation from address-book companies. |
| Teams and assignments | Matched Owner-only Team/Project access controls, manual email-bound invitation links, Member assignment checkboxes, automatic access for Owners and last-owner protection. |
| Personal information | Removed the suggestion that the content library is firm-shared. Clarified personal contact/library/working values versus active-firm business records. |
| Google choosing | Separated connection from file selection, documented the standalone chooser, blocked/cancelled popups and return to the original working page. |
| Google previews | Distinguished blank thumbnails from missing file entries, without claiming a specific Google failure or suggesting wider scopes. |
| Proposal shape | Corrected the project instructions' obsolete service-category/discipline grid and Additional Services phase-grid claims: current Standard uses phases/consultants; Additional Services uses flat line items. |
| Record lifecycle | Reconciled project tabs, Standard-signing transition, invoice prerequisites, cumulative fee example, editable time/expenses, notes and document-link button names. |
| Owner setup | Distinguished firm Owners from the app operator who controls Google Cloud/database settings; changed unqualified production claims to a dated record and an explicit verification boundary. |
| Printable material | Regenerated the everyday guide and new UAT checklist from Markdown, preserving the existing printable HTML approach and deriving footer dates from their sources. |

## Source coverage

The review used targeted code/label checks, not task titles as proof of features:

- Navigation, Create firm and switching: `client/src/components/app-sidebar.tsx`,
  `client/src/components/create-firm-dialog.tsx`,
  `client/src/lib/workspace.tsx` and `server/workspaces.ts`.
- Team/project access and tabs: `client/src/pages/project-detail.tsx`, the
  implemented team page and the existing workspace access reference.
- Address-book form boundary: `client/src/components/contact-form-dialog.tsx`.
  The current contact form still has no full personal mailing-address form;
  database columns or older task titles do not prove otherwise.
- Proposal/Additional Services/consultant presentation:
  `client/src/components/proposal-form-dialog.tsx`,
  `client/src/components/additional-services-form-dialog.tsx` and
  `client/src/components/proposal-detail-panel.tsx`.
- Time, expenses, notes and invoice prerequisites:
  `client/src/components/tabs/time-expenses-tab.tsx`,
  `notes-tab.tsx`, `invoices-tab.tsx` and
  `server/repositories/proposals.ts` / `invoices.ts`.
- Document selection, linking and special tables:
  `client/src/components/google-docs-picker.tsx`,
  `generate-document-dialog.tsx`, `invoice-detail-panel.tsx` and
  `server/services/doc-generation.ts`.

## Verification boundary

Earlier November 14 development work recorded a successful migration, type check
and production build, 17 workspace tests, 24 Google/request-isolation tests and a
focused synthetic-account browser journey for multi-firm creation, uncertain
response retry, configuration, invitation links, switching and isolation.
Those checks were not repeated merely to change the docs and do not constitute
all-app UAT.

Earlier Google browser lifecycle checks used an explicit test double; the user
then reported the real chooser working. That does not prove all real template
parsing, rich-text/table formatting, invoice/consultant generation or record-link
saving combinations with fresh grants. Those remain cases to record in UAT.

For this refresh, the document generator, source/output consistency, contents
anchors and readable HTML rendering are checked independently of the app.
The UAT checklist starts with every result **Not run** and provides a blank
acceptance summary; no live provider or production result is inferred.

## Delivered references

- Everyday guide: `docs/studio-pm-user-guide.md` and its `.html` edition.
- UAT checklist/result log: `docs/uat-checklist.md` and its `.html` edition.
- Company permissions/migration reference: `docs/company-workspaces.md`.
- Google operator setup/recovery: `docs/google-oauth-setup.md`.
- Project instructions and documentation index: `replit.md`.
- Rebuild both printable documents: `python3 scripts/build-user-guide.py`.
