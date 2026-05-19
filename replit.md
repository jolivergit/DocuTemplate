# Studio PM — Project Pipeline Manager + Google Docs Template Generator

## Overview
Studio PM is a full project pipeline manager for Oliver Studios with three stages: **Lead → Proposal → Project**. It includes an integrated Google Docs template builder for generating client documents, and a Firm/Contact profile that syncs field values to the Doc Builder automatically.

### Pipeline Stages
- **Lead Management** (Complete): Track opportunities with status, probability, potential fee, square footage, and 6 associated company roles per lead
- **Proposal Management** (Complete): Create multi-phase proposals with fee breakdown by service category and discipline. Mark as Signed to advance lead to Active Project. "Load to Doc Builder" button pre-fills proposal + firm field values and saves generated doc URL back to the proposal record.
- **Additional Services Proposals** (Complete): Separate proposal type on signed projects — phase × consultant fee grid. "Load to Doc Builder" stores `_additional_services_json` and supports `{{additional_services_table}}` doc tag.
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

### Database Schema
- **users** — Google OAuth accounts
- **categories** — Organize content snippets by color-coded category
- **contentSnippets** — Reusable rich text with embedded field detection
- **fieldValues** — Simple key-value pairs for field tags
- **profiles** — Studio firm + contact info (one record per user). Fields: name, phone, email, addressLine1, addressLine2, city, state, zip, contactName, contactTitle. Saving auto-syncs to Doc Builder field values.
- **leads** — Project opportunities (serial PK for project numbers)
- **leadCompanies** — 6 typed company associations per lead (ContractHolder, Client, MEP, Structural, EquipmentVendor, FurnitureVendor)
- **contacts** — Standalone address book entries (fullName, title, phone, email, companyName, notes). Independent from projects; shown in Contacts page alongside project-derived contacts.
- **proposals** — Proposals linked to leads (statuses: Draft, Sent, Revision, Signed, Declined). `proposalType` field: `"Standard"` | `"Additional Services"`. Stores `docUrl` for the generated Google Doc.
- **proposalPhases** — Phases within a proposal (Phase 1, Phase 2 for Add Services, etc.)
- **proposalFeeLines** — Fee lines per phase: service category × discipline × feeType (Fixed/Hourly) × amount. For Additional Services proposals: phase × consultant × feeType × amount.
- **consultantContracts** — Per-consultant contract records on a signed proposal. Fields: proposalId, consultant (name), templateId, templateName, outputName, docUrl. Created when a consultant contract Google Doc is generated.
- **invoices** — Invoices for active projects, linked to signed proposals (statuses: Draft, Sent, Paid)
- **invoiceFeeLineSnapshots** — Snapshot of each fee line at invoice time: % complete, earned, previous billing, current billing
- **hoursEntries** — Additional time tracking entries per invoice
- **expenseEntries** — Expense entries per invoice (Mileage, Parking, Shipping, Printing)
- **projectComments** — Chronological comments log per project (lead)

### Key Routes
- `/` → Dashboard (pipeline strip + billing summary + recent projects — no in-page title)
- `/projects` → Projects list (pipeline)
- `/projects/:id` → Project detail page with tabs: Overview | Proposals | Project
- `/companies` → Companies address book
- `/contacts` → Contacts page (address book + project-derived contacts)
- `/doc-builder` → Google Docs template builder (accepts `?returnTo=proposal&returnToId=<id>` for auto save-back)
- `/profile/firm` → Firm info (name, phone, email, address) — Settings section
- `/profile/contact` → Primary contact (name, title) — Settings section

---

## UI Layout

### App Shell
- **Sidebar** (Shadcn `Sidebar`, fixed width `14rem`):
  - Header: `studioarchheader` wide banner image (h-20, object-cover object-left) — swaps to `studioarchheaderdark` in dark mode
  - Main nav: Dashboard, Projects, Companies, Contacts
  - Footer: collapsible Settings section (defaults open) with **Firm**, **Contact**, and **Doc Builder** nav items, then a separator, then avatar + user name + Sign out button
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
Each lead can have up to 6 companies by role: ContractHolder, Client, MEP, Structural, EquipmentVendor, FurnitureVendor. Each has: companyName, address, contactFullName, contactTitle, contactPhone, contactEmail.

---

## Proposal Management

### Proposal Types
- **Standard** (`proposalType: "Standard"`) — Base scope proposals. Phase → Service Category → Discipline fee grid (Documentation | Bid & Permit | Construction Administration) × (Interior Design | MEP & FP | Structural). Each discipline line: feeType (Fixed or Hourly) and amount.
- **Additional Services** (`proposalType: "Additional Services"`) — Add-on proposals on active projects. Phase × Consultant fee grid; each line has a consultant name, feeType, and amount.

### Proposal Structure
- A lead can have multiple proposals (base + additional services)
- Each proposal has: name, description, status, proposalType, docUrl, dateSent, dateSigned
- Signing a proposal automatically advances the parent lead to "Active Project"
- **"Load to Doc Builder"** button navigates to `/doc-builder?returnTo=proposal&returnToId=<id>`, pre-fills all field values, and after generation auto-saves the doc URL back to the proposal's `docUrl` field
- **Proposal detail panel** shows the saved `docUrl` as a clickable "Open Document" link with a "Regenerate" affordance

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
Stores the studio's firm info and primary contact. On save, automatically syncs to Doc Builder field values so `{{firm_name}}`, `{{firm_contact_name}}`, etc. are always current in generated documents.

### API
- `GET /api/profile` — Fetch current user's profile (404 if not yet created)
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
- `POST /api/leads/:leadId/proposals` — Create a proposal (with phases and fee lines)
- `GET /api/proposals/:id` — Get proposal with all phases and fee lines
- `PATCH /api/proposals/:id` — Update proposal (optionally replaces phases; allowed fields include `docUrl`)
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
- All API routes protected by `requireAuth` middleware

---

## Project Detail Page — Tab Structure

Active Project / Completed leads get 5 tabs: **Overview | Proposals | Time & Exp | Invoices | Notes**. Lead / Proposal status leads get 3 tabs (Overview, Proposals, Notes). Time & Expenses and Invoices tabs are only visible when `status ∈ { "Active Project", "Completed" }`.

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

## Refactoring Opportunities

Documented here for future sprints. None of these are blocking — they are quality-of-life improvements.

### High Priority

**`server/routes.ts` — Split by domain (2,060 lines)**
The single-file route registration has grown to include auth, leads, proposals, invoices, comments, field values, doc generation, and consultant contracts. Each domain should become its own module (e.g. `server/routes/proposals.ts`, `server/routes/documents.ts`) with a barrel `server/routes/index.ts`. The heavy Google Docs manipulation helpers (`insertPhaseTable`, `insertAdditionalServicesTable`, `importHtmlContent`) should move to a `server/services/google-docs.ts` service layer.

**`client/src/pages/project-detail.tsx` — Extract tab components (1,436 lines)**
All four tabs (Proposals, Time & Expenses, Invoices, Notes) are rendered inline in one giant component. Each should become its own file under `client/src/components/tabs/` (e.g. `proposals-tab.tsx`, `time-expenses-tab.tsx`). The parent page would become a thin shell managing route params and shared lead state only.

**`server/storage.ts` — Split into repositories (1,409 lines)**
The monolithic `DatabaseStorage` class handles every table. Splitting into domain repositories (`LeadRepository`, `ProposalRepository`, `InvoiceRepository`, `DocBuilderRepository`) would make each file digestible and independently testable.

### Medium Priority

**Currency formatting — centralize in shared utils**
`new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })` appears in at least 9 files. A single `formatCurrency(n: number): string` helper in `client/src/lib/utils.ts` (and a mirrored one in `server/utils.ts` for route-level formatting) would eliminate the duplication.

**Standardize `fetch` vs `apiRequest`**
Several components bypass the `apiRequest` helper from `queryClient.ts` and use raw `fetch` with manual `if (!r.ok) throw` guards. All data mutations should go through `apiRequest` for consistent error handling and credential passing.

**`client/src/components/lead-form-dialog.tsx` (918 lines) and similar large dialogs**
`LeadFormDialog`, `CompanyFormDialog`, and `ContactFormDialog` share nearly identical Zod schema + `useForm` + mutation boilerplate. A shared `useCrudDialog` hook or a higher-order form wrapper could cut the per-dialog footprint significantly.

### Low Priority

**`server/html-to-google-docs.ts` (1,035 lines)**
The HTML → Google Docs parser is focused but large. Breaking it into smaller strategy files by node type (text runs, tables, lists) would improve readability without changing the public API.

**`any` types in `server/routes.ts`**
Several Express handler callbacks are typed as `any` (e.g. session user, Passport profile). Replacing with proper Passport + Express type augmentation would close the TypeScript gaps.

**`client/src/components/invoice-builder-panel.tsx` (910 lines)**
The fee snapshot grid, AS billing section, hours/expense attach section, and summary footer are all inline. Extracting sub-components would make this easier to extend.

---

## User Preferences
- Pure greyscale design — no color in the UI palette
- Uppercase + wide tracking typography throughout
- Compact, information-dense layouts — no redundant headers or duplicate controls
- "New" buttons live in the same toolbar row as the search bar, not as floating top-right buttons
- Page titles shown in the app header bar — not repeated inside page content
