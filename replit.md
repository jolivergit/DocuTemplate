# Studio PM — Project Pipeline Manager + Google Docs Template Generator

## Working agreement
- **Do not suggest follow-up tasks unless I ask.**

## Documentation and UAT
- Everyday instructions: `docs/studio-pm-user-guide.md`; printable/downloadable edition: `docs/studio-pm-user-guide.html`.
- Acceptance scenarios and blank result log: `docs/uat-checklist.md`; printable edition: `docs/uat-checklist.html`.
- Workspace access/migration reference: `docs/company-workspaces.md`. App-operator Google setup: `docs/google-oauth-setup.md`.
- Rebuild the printable documents with `python3 scripts/build-user-guide.py`. Edit the Markdown sources, not the generated HTML.
- Shared phase/task rollout and intentional legacy-note removal: `docs/project-work-rollout.md`.
- A documentation review or an implemented feature is not UAT sign-off. Record actual test results separately; do not treat planned or archived task titles as the current implementation.

## Overview
Studio PM is a full project pipeline manager for Oliver Studios with three stages: **Lead → Proposal → Project**. It includes an integrated Google Docs template builder for generating client documents, and a Firm/Contact profile that syncs field values to the Doc Builder automatically.

### Pipeline Stages
- **Lead Management** (Implemented): Track opportunities with status, probability, potential fee, square footage, and company/contact associations using suggested or custom roles.
- **Project Tasks and Shared Scope**: Project-owned phases support ad-hoc names, optional duration/range text, ordering/archive, and optional fee lines. Tasks on the project page have one eligible assignee, phase, priority, status, due date and attributed append-only notes. Task/phase edits use versions to reject stale writes; only project-authorized users can access them.
- **Proposal Management**: Standard proposals select shared project phases/fees without re-entry. Draft/Revision preparation uses current shared inputs; issued snapshots preserve agreed amounts for billing/contracts. Mark as Signed advances a Standard proposal's lead to Active Project. "Load to Doc Builder" pre-fills proposal + firm values and saves the generated doc URL back.
- **Additional Services Proposals** (Implemented): Separate proposal type with description-and-amount line items, not the Standard phase/consultant grid. "Load to Doc Builder" supports the `{{additional_services_table}}` tag.
- **Consultant Contracts** (Complete): Generate per-consultant Google Docs directly from a signed proposal's fee lines. Each contract record stores the generated doc URL.
- **Project & Invoice Management** (Complete): Track invoices built on top of signed proposals, with hours entries, expense entries, and a project comments log. "Load to Doc Builder" button pre-fills invoice field values. Invoice doc URLs are saved back automatically.

### Doc Builder
Generate Google Documents from customizable templates. Templates support:
- **Field Tags** `{{field_name}}` — Simple key-value data (firm_name → "Oliver Studios")
- **Content Tags** `<<content_name>>` — Rich text snippets (introductions, sections)
- **Special Tag** `{{additional_services_table}}` — Inserts a formatted phase × consultant fee table pulled from `_additional_services_json`

Standard field names auto-populated from the profile and from "Load to Doc Builder" actions:
- Firm: `firm_name`, `firm_phone`, `firm_email`, `firm_address`, `firm_city`, `firm_state`, `firm_zip`
- Contact: `firm_contact_name`, `firm_contact_title`
- Proposal: `proposal_name`, `proposal_total`, `proposal_date`, `project_name`
- Invoice: `invoice_number`, `invoice_date`, `invoice_grand_total`, `client_company`, `project_name`

### Doc URL Save-Back Pattern
When "Load to Doc Builder" is triggered from a specific record, a `returnTo` context is passed as URL query params (e.g. `/doc-builder?returnTo=proposal&returnToId=42`). After successful generation, `GenerateDocumentDialog` automatically PATCHes the originating record's `docUrl` field and invalidates the relevant query cache. The success screen confirms the save. Standalone doc builder usage (no query params) shows the URL in the dialog only — no save-back is attempted.

---

## Architecture

### Frontend Stack
- React with TypeScript
- Wouter for routing
- TanStack Query for data fetching
- Tailwind CSS + Shadcn UI (sidebar, tabs, collapsible, dialogs, etc.)
- Dark mode support (toggle in the main header bar, top-right)

### Backend Stack
- Express.js server
- PostgreSQL database (Neon)
- Drizzle ORM
- Google Drive API + Google Docs API integration

### Company workspaces and access
- A workspace is the studio's account, separate from the client Companies address book.
- **Create firm** below the sidebar selector creates another empty workspace, makes the creator Owner, and opens Firm settings. It is available to Members as well as Owners; roles remain independent in each firm.
- Creation is transactional and uses a creator-bound request ID for safe same-intent retries. Ownership comes from membership, not `legacyOwnerId`; that nullable unique marker identifies only the user's original workspace for migration/recovery.
- Owners manage all workspace projects, membership, assignments, address-book records, and firm details. Members see/edit only assigned projects and their child records, including financial data; project/proposal/invoice deletion is Owner-only.
- Each API request resolves active membership and `X-Workspace-Id`, then propagates a fail-closed request context. Never authorize workspace records by their original creator's `userId` alone.
- Personal snippets, categories, working field values, Google credentials, and primary contact remain user-owned. Google selected-file permissions are not company permissions.
- Workspace changes/permission revisions clear scoped client queries and remount open working UI. Server permissions take effect on the next request.
- Manual switching confirms unsaved edits will be discarded; creation requires acknowledgement. Opening an already-created firm is retried separately from creation. Browser-tab selection is not an account-wide preferred starting firm.
- Run `npm run db:migrate:workspaces` before starting this version on an unmigrated database. Development migration was recorded during the November 14, 2026 multi-firm verification; this documentation review did not inspect or change production. Confirm the destination schema before publishing. Migration, backup/rollback, access matrix, and reconciliation: `docs/company-workspaces.md`.
- Regression checks: `npm run test:workspaces` (synthetic DB fixtures) and `npm run test:google`.

### Database Schema
- **users** — Google OAuth accounts
- **categories** — Organize content snippets by color-coded category
- **contentSnippets** — Reusable rich text with embedded field detection
- **fieldValues** — Simple key-value pairs for field tags
- **profiles** — Personal document contact and legacy firm data. The API merges workspace-level firm details with personal contactName/contactTitle. Saving syncs the acting user's Doc Builder field values.
- **workspaces**, **workspaceMembers**, **workspaceInvitations**, **projectAssignments** — Studio firm data, Owner/Member membership, hashed expiring invitations, and assigned-project access. Projects/companies/contacts carry workspace ownership while retaining original creator IDs.
- **leads** — Project opportunities (serial PK for project numbers)
- **leadCompanies** — Project company entries with free-form roles, optional company/contact links and company/address snapshots
- **contacts** — Standalone address book entries (fullName, title, phone, email, companyName, notes). Independent from projects; shown in Contacts page alongside project-derived contacts.
- **proposals** — Proposals linked to leads (statuses: Draft, Sent, Revision, Signed, Declined). `proposalType` field: `"Standard"` | `"Additional Services"`. Stores `docUrl` for the generated Google Doc.
- **projectPhases / projectPhaseFees** — Shared project phases and fee inputs; optional timeline, ad-hoc names, stable identities used by tasks and proposal preparation.
- **projectTasks / projectTaskNotes** — Project-scoped work with status, priority, date-only due date, eligible user assignment, optimistic versioning and attributed discussion.
- **proposalPhases / proposalFeeLines** — Selected document/financial snapshots referencing shared phase identities. They preserve issued scope, not a second manual project-data editor. Additional Services retains its separate flat line items.
- **consultantContracts** — Per-consultant contract records on a signed proposal. Fields: proposalId, consultant (name), templateId, templateName, outputName, docUrl. Created when a consultant contract Google Doc is generated.
- **invoices** — Invoices for active projects, linked to signed proposals (statuses: Draft, Sent, Paid)
- **invoiceFeeLineSnapshots** — Snapshot of each fee line at invoice time: % complete, earned, previous billing, current billing
- **hoursEntries** — Additional time tracking entries per invoice
- **expenseEntries** — Expense entries per invoice (Mileage, Parking, Shipping, Printing)
- **projectComments** — Chronological comments log per project (lead)

### Key Routes
- `/` → Dashboard (pipeline strip + billing summary + recent projects — no in-page title)
- `/projects` → Projects list (pipeline)
- `/projects/new` → normal create page requiring a name only. `/projects/:id` → inline setup (identity, multi-person team roles/companies, phases/fees/optional timelines), followed by the Work in motion log (Task/Reminder/Meeting/Note). Secondary Overview | Proposals, plus Time & Expenses | Invoices for Active Project/Completed, remain until the later layout task. The old standalone Notes feature is retired.
- `/companies` → Companies address book
- `/contacts` → Contacts page (address book + project-derived contacts)
- `/doc-builder` → Google Docs template builder (accepts `?returnTo=proposal&returnToId=<id>` for auto save-back)
- `/profile/firm` → Firm info (name, phone, email, address) — Settings section
- `/profile/contact` → Primary contact (name, title) — Settings section
- `/settings/team` → Workspace naming, invitation links, roles and member removal — Owner only
- `/google-template-picker` → Standalone chooser opened by the app; returns a selected file to the original working page

---

## UI Layout

### App Shell
- **Sidebar** (Shadcn `Sidebar`, fixed width `14rem`):
  - Header: `studioarchheader` wide banner image (h-20, object-cover object-left) — swaps to `studioarchheaderdark` in dark mode
  - Workspace selector shows the active firm and role; **Create firm** is available below it
  - Main nav: Dashboard, Projects, Companies, Contacts
  - Footer: collapsible Settings section (defaults open) with **Firm**, **Contact**, **Doc Builder**, and owner-only **Team**, followed by identity and Sign out
- **Header bar** (h-14, border-b): sidebar toggle (left) | current page title in uppercase tracking-widest (center-left) | theme toggle (right)
- **Main content**: fills remaining space, each page manages its own scroll

### Page Layout Convention
All list pages (Projects, Companies, Contacts) use a **single compact toolbar row** at the top — no separate in-page title/subtitle block. The toolbar contains:
- Search input (flex-1, max-w-sm)
- Additional filters if applicable (e.g. status dropdown on Projects)
- "New ___" button (right side of the same row)

Profile pages (Firm, Contact) use a simple scrollable form layout with a page title + description only (no redundant toolbar).

### Design System
- Pure greyscale theme — 0% saturation on all HSL color tokens including destructive
- Typography: uppercase + wide tracking on all h1–h4 headings and sidebar nav labels, applied via `@layer base` in `index.css`
- Sidebar brand: `text-xs font-medium uppercase tracking-widest`
- Page title in header: `text-base font-semibold uppercase tracking-widest`

### Theme-Aware Logos
A `useTheme` hook (`client/src/hooks/use-theme.ts`) watches `document.documentElement` class changes via `MutationObserver` and returns `"light" | "dark"`. Used in `App.tsx` (AuthGate) and `app-sidebar.tsx` to swap logo assets at runtime with no page reload.

| Asset file | Used in | Mode |
|---|---|---|
| `studioarchheader_1778640146833.png` | Sidebar header, login left-col logo | Light |
| `studioarchheaderdark_1778640849637.png` | Sidebar header, login left-col logo | Dark |
| `studioarchsquare_1778640146834.png` | Loading spinner | Light |
| `studioarchsquaredark_1778640849637.png` | Loading spinner | Dark |
| `login_bg_architecture.png` | Login page right-column background | Both |

### Login Page Layout
No top header bar. Full-screen two-column split:
- **Left column** (`w-1/2`): centered wide banner logo + "Sign in to access your project pipeline." blurb + full-width "Sign in with Google" button. Theme toggle in top-right corner.
- **Right column** (`w-1/2`, hidden on mobile): greyscale AI-generated architectural skyscraper photo (`login_bg_architecture.png`) as full-bleed background with a dark gradient wash (`bg-gradient-to-t from-black/80`). Tagline text (`text-3xl tracking-widest text-shadow`) centered absolutely over the image.

---

## Lead Management

### Lead Fields
- `id` — Serial integer (the project number)
- `projectName`, `description`
- `squareFootage`, `potentialFee`
- `probability` — LOW | MEDIUM | HIGH
- `status` — Lead | Proposal | Active Project | Completed | Lost

### Lead Companies
Project company entries use free-form roles with common suggestions such as Contract Holder, Client, MEP Engineering and Structural Engineering. They can link company/contact address-book records; access follows the selected workspace and project assignment. Do not assume the suggestions impose a six-entry limit or that old inline contact columns still exist.

---

## Proposal Management

### Proposal Types
- **Standard** (`proposalType: "Standard"`) — Select shared project phases, with any custom name and optional timeline. Their consultant fee lines use Fixed/Hourly and applicable amounts. Edit shared inputs on the project, not in each proposal.
- **Additional Services** (`proposalType: "Additional Services"`) — Add-on scope with flat description-and-amount line items.

### Proposal Structure
- A lead can have multiple proposals (base + additional services)
- Each proposal has: name, description, status, proposalType, docUrl, dateSent, dateSigned
- Signing a Standard proposal advances the parent lead to "Active Project"; signing Additional Services does not perform that transition
- **"Load to Doc Builder"** button navigates to `/doc-builder?returnTo=proposal&returnToId=<id>`, pre-fills all field values, and after generation auto-saves the doc URL back to the proposal's `docUrl` field
- **Proposal detail panel** exposes the saved document through **View Document**; starting generation again can create a new copy

### Additional Services in Invoice Builder
When creating an invoice, if the project has signed Additional Services proposals, an AS billing section appears alongside the standard fee snapshot rows.

### Consultant Contracts (Signed Proposals Only)
The proposal detail panel exposes a "Consultant Contracts" section for signed proposals. Each unique consultant in the fee lines can have a contract generated as a separate Google Doc using any template. Generated contracts are stored in the `consultant_contracts` table with their doc URL and can be re-generated at any time.

### Proposal Statuses
Draft → Sent → Revision → Signed / Declined

---

## Project & Invoice Management

### Invoice Structure
- Invoices are linked to the signed proposal and capture a snapshot of percent-complete per fee line
- For Fixed fee lines: percentComplete → earned = baseFee × pct, previousBilling (from prior invoices), currentBilling = earned - previous
- For Hourly fee lines: hoursWorked × ratePerHour
- Additional hours entries (date, description, hours, rate) and expense entries (date, type, amount/miles) per invoice
- Invoice statuses: Draft → Sent → Paid

### Expense Types
- **Mileage**: miles × rate/mile (default $0.67/mile)
- **Parking, Shipping, Printing**: direct dollar amount

### Doc Builder Integration
Invoice detail page has a self-contained "Generate Doc" button that calls `/api/invoices/:id/doc-url` directly to save the URL back after generation. No `returnTo` pattern — invoice generation is handled entirely within the invoice panel.

---

## Firm Profile

### Purpose
Combines active-workspace firm information with the user's personal document contact. Saving syncs the acting user's Doc Builder fields; switching firms does not rewrite all personal working values, so load the correct record and review mappings before generation.

### API
- `GET /api/profile` — Return the active firm's details with the personal contact; falls back to the workspace name when no firm name is saved
- `PATCH /api/profile` — Upsert profile (creates or updates). Body matches `insertProfileSchema`.

### Pages
- `/profile/firm` — Firm name, phone, email, address (line 1, line 2, city, state, zip). Saves firm_* field values to Doc Builder.
- `/profile/contact` — Contact name and title. Saves firm_contact_name, firm_contact_title to Doc Builder.
- Each page fetches the full profile and merges only its own fields on save, so saving one page never wipes the other page's data.

---

## API Endpoints

### Profile
- `GET /api/profile` — Get current user's profile
- `PATCH /api/profile` — Upsert profile

### Proposals
- `GET /api/leads/:leadId/proposals` — List all proposals for a lead
- `POST /api/leads/:leadId/proposals` — Create a proposal; Standard uses `selectedPhaseIds` from shared project data, Additional Services uses its flat items
- `GET /api/proposals/:id` — Get proposal with all phases and fee lines
- `PATCH /api/proposals/:id` — Update document metadata and unissued Standard phase selection; issued scope is protected. Allowed fields include `docUrl`.
- `/api/leads/:leadId/work` — Shared phases/fees, tasks and eligible assignees; subroutes support reconciliation, phase reorder, task edits/archive, and task notes.
- `POST /api/proposals/:id/sign` — Sign proposal (advances lead to Active Project)
- `POST /api/proposals/:id/decline` — Decline proposal
- `DELETE /api/proposals/:id` — Delete proposal

### Consultant Contracts
- `GET /api/proposals/:id/consultant-contracts` — List all consultant contract records for a proposal
- `POST /api/proposals/:id/consultant-contracts/generate` — Generate a Google Doc for a specific consultant from the proposal's fee lines; saves docUrl to the contract record

### Invoices
- `GET /api/leads/:leadId/invoices` — List invoices for a project
- `POST /api/leads/:leadId/invoices` — Create invoice with fee snapshots, hours, expenses
- `GET /api/invoices/:id` — Get full invoice with all nested data
- `PATCH /api/invoices/:id/status` — Update invoice status
- `PATCH /api/invoices/:id/doc-url` — Save generated doc URL to invoice
- `DELETE /api/invoices/:id` — Delete invoice

### Hours & Expenses
- `POST /api/invoices/:id/hours` — Add hours entry
- `PATCH /api/hours/:id`, `DELETE /api/hours/:id`
- `POST /api/invoices/:id/expenses` — Add expense entry
- `PATCH /api/expenses/:id`, `DELETE /api/expenses/:id`

### Comments
- `GET /api/leads/:leadId/comments` — Get project comments
- `POST /api/leads/:leadId/comments` — Add comment
- `DELETE /api/leads/:leadId/comments/:commentId` — Delete comment

### Field Values
- `POST /api/field-values/upsert-by-name` — Upsert field value by name (used by invoice + proposal "Load to Doc Builder" and by profile save)
- `DELETE /api/field-values/by-prefix` — Delete all field values whose name starts with one of the provided prefixes (body: `{ prefixes: string[] }`). Called before "Load to Doc Builder" to clear stale proposal/invoice fields before writing fresh ones.

---

## Authentication
- Google OAuth via Passport.js
- Session stored in PostgreSQL (connect-pg-simple)
- Business/workspace API routes require an authenticated session and validated workspace membership
- Basic login requests identity only. Optional document access uses `drive.file` and Google Picker, not account-wide Drive/Docs access.
- Picker must not dismiss the parent dialog while its external frame takes focus. **Choose in separate window** offers a same-origin fallback; only validated file ID/name metadata returns to the original page.
- Blank Google thumbnails do not prove a file is inaccessible. Do not broaden Google scopes just to obtain previews; operator guidance is in `docs/google-oauth-setup.md`.

---

## Project Detail Page — Tab Structure

Every project opens with inline setup, then Work in motion. Setup is resumable and collapses when complete. **Project Admin**, **Project Manager**, and **Designer** are multi-person, multi-role project assignments, separate from firm Owner/Member. The creator is Project Admin; old assignments retain unknown roles. Project Admins manage their own project's roster/setup and select same-firm address records without firm-wide admin rights; keep a Project Admin once configured. Existing assigned-member work permissions remain. Optional general and phase timelines are text, not task scheduling. Secondary tabs are **Overview | Proposals**, plus **Time & Expenses | Invoices** when `status ∈ { "Active Project", "Completed" }`; only their tab-free replacement remains downstream.

Work in motion is a newest-first inline **Task / Reminder / Meeting / Note** log. One composer, inline editing/discussion, and explicit project-context draft prefilling replace the task sheet. Meetings/notes have no task status/priority/due date; reminders use To do/Done; metrics count active tasks/reminders only. Kind is immutable after creation. No notification delivery, calendar integration, guessed deadlines or automatic person selection. All task-era IDs/discussions/assignments/dates/archive states are preserved in place; the retired standalone Notes feature is not restored. The legacy `work.tasks` payload is Task-only compatibility, never a second rendered task list. New entry/discussion saves use stable per-intent retry IDs; version conflicts retain drafts with explicit reload. Treat pending saves as dirty work for team/access-refresh guards.

Running-log rollout and preservation rules: `docs/project-work-rollout.md`. Run `npm run db:migrate:project-log` after the prerequisite migrations and before compatible code. This additive migration was applied to development only; no production migration or publish is authorized by implementation. Include `npm run test:project-log` in the existing regression suite.

Inline setup rollout and role UAT: `docs/project-setup-rollout.md`. Run `npm run db:migrate:project-setup` before compatible app code on an unmigrated database; this additive migration preserves legacy assignments without inferring roles. Development only was migrated in this task. No production migration or publish was performed. Run `npm run test:project-setup` with the work/workspace/Google suites for regression checks.

### Proposals Tab
Displays all proposals for the project. A dropdown "New Proposal" button lets users create either a Standard or Additional Services proposal. Each proposal shows a type badge (Standard proposals have no badge; AS proposals show an "Additional Services" badge). Signed proposals expose a Consultant Contracts section.

### Time & Expenses Tab
Displays all hours and expenses logged against a project (across all invoices and unattached). Each entry shows an "Invoice #N" badge if attached to an invoice, or "Unattached" if not. Inline forms let you add new hours and expenses directly at the project level (`POST /api/leads/:leadId/hours` and `POST /api/leads/:leadId/expenses`). Entries can be deleted any time. Invoice attachment is handled through the Invoice Builder.

### Invoice Builder — Attach Project Entries
When creating a new invoice, a collapsible "Attach Project Entries" section appears if there are any unattached hours or expenses on the project. Checking an entry's checkbox includes it in the invoice total and passes its ID as `existingHoursIds`/`existingExpenseIds` in the create payload. On save, those entries' `invoiceId` is updated to the new invoice — they're now "attached" and no longer appear as unattached.

---

## Deployment Notes
- **contacts-fk migration** (`scripts/migrate-contacts-fk.ts`): This migration backfills `contact_id` on legacy `lead_companies` rows from old inline contact fields, then drops those columns. It must be run **before** deploying any code that assumes the four inline columns are absent. Run with: `npx tsx scripts/migrate-contacts-fk.ts`. Fully idempotent — checks column existence before the SELECT, and uses `DROP COLUMN IF EXISTS` for the drops.
- **Company-only address book migration** (`POST /api/companies/migrate-from-lead-companies`): Backfills `company_id` on `lead_companies` rows that have a `company_name` but no `company_id` yet. Does **not** backfill contacts (use the script above for that). Safe to re-run.
- **Hours & expenses nullable migration** (`scripts/migrate-hours-expenses-nullable.ts`): Makes `invoice_id` nullable on `hours_entries` and `expense_entries` tables so entries can exist at the project level without being attached to an invoice. Run with: `npx tsx scripts/migrate-hours-expenses-nullable.ts`. Fully idempotent — checks `is_nullable` before altering.
- **`consultant_contracts` table**: Created via Drizzle push during Task #47. No manual migration script needed if deploying fresh; if the table is absent on an existing deployment run `npx drizzle-kit push` to apply.
- **`proposals.proposal_type` column**: Added during Task #46. Defaults to `"Standard"` — existing rows are unaffected. Apply with `npx drizzle-kit push` if absent on an existing deployment.

---

## Historical Refactoring Notes

These describe prior refactoring, not a current code audit or UAT result. Verify paths and behavior against the current source before making changes; historical line counts are not implementation contracts.

**`server/routes/` — Split by domain** ✓
`server/routes.ts` was a single 2,060-line file. Now split into: `auth.ts`, `leads.ts`, `proposals.ts`, `invoices.ts`, `companies.ts`, `field-values.ts`, `doc-builder.ts`, and `index.ts` barrel.

**`client/src/pages/project-detail.tsx` — Tab extraction** ✓
Proposals, time/expenses, and invoices remain extracted under `client/src/components/tabs/`. The retired notes tab was removed; project work lives under `client/src/components/project-work/`.

**`server/storage.ts` — Domain repositories** ✓
The storage facade delegates to `server/repositories/leads.ts`, `proposals.ts`, `invoices.ts`, `companies.ts` and `doc-builder.ts`.

**Currency formatting** ✓
`formatCurrency(n)` lives in `client/src/lib/utils.ts`; `formatCurrency(n)` in `server/utils.ts`. No inline `Intl.NumberFormat` calls remain.

**`fetch` vs `apiRequest` standardization** ✓
Ordinary scoped mutations use `apiRequest` from `@/lib/queryClient`. Workspace bootstrapping/switching and short-lived Google credential flows also use explicit `fetch` with their own response, scope and cancellation checks; do not assume there are no raw-fetch exceptions.

**`client/src/components/lead-form-dialog.tsx` — Sub-component extraction** ✓
Four embedded helper components extracted to `client/src/components/lead-form/`: `types.ts` (schema + FormValues), `role-suggestion-picker.tsx`, `company-address-book-picker.tsx`, `contact-picker.tsx`, `company-entry.tsx`. Main dialog is ~220 lines.

**`server/html-to-google-docs.ts` — Sub-module split** ✓
Split into `server/html-parser/`: `types.ts` (all interfaces), `parse.ts` (HTML → FormattedBlock[]), `requests.ts` (FormattedBlock[] → Docs API requests). `html-to-google-docs.ts` is now a ~30-line public-API barrel.

**`any` types in server routes** ✓
All `catch (error: any)` → `catch (error)` with `(error as Error).message`. `fieldRequests: any[]` in proposals route replaced with an explicit inline type.

**`client/src/components/invoice-builder-panel.tsx` — Sub-component extraction** ✓
892-line monolith split into a thin 237-line parent + 7 sub-components under `client/src/components/invoice-builder/`.

---

## User Preferences
- Pure greyscale design — no color in the UI palette
- Uppercase + wide tracking typography throughout
- Compact, information-dense layouts — no redundant headers or duplicate controls
- "New" buttons live in the same toolbar row as the search bar, not as floating top-right buttons
- Page titles shown in the app header bar — not repeated inside page content
