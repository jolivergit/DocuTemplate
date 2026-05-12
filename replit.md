# Studio PM — Project Pipeline Manager + Google Docs Template Generator

## Overview
Studio PM is a full project pipeline manager for Oliver Studios with three stages: **Lead → Proposal → Project**. It includes an integrated Google Docs template builder for generating client documents, and a Firm/Contact profile that syncs field values to the Doc Builder automatically.

### Pipeline Stages
- **Lead Management** (Complete): Track opportunities with status, probability, potential fee, square footage, and 6 associated company roles per lead
- **Proposal Management** (Complete): Create multi-phase proposals with fee breakdown by service category and discipline. Mark as Signed to advance lead to Active Project. "Load to Doc Builder" button pre-fills proposal + firm field values.
- **Project & Invoice Management** (Complete): Track invoices built on top of signed proposals, with hours entries, expense entries, and a project comments log. "Load to Doc Builder" button pre-fills invoice field values.

### Doc Builder
Generate Google Documents from customizable templates. Templates support:
- **Field Tags** `{{field_name}}` — Simple key-value data (firm_name → "Oliver Studios")
- **Content Tags** `<<content_name>>` — Rich text snippets (introductions, sections)

Standard field names auto-populated from the profile and from "Load to Doc Builder" actions:
- Firm: `firm_name`, `firm_phone`, `firm_email`, `firm_address`, `firm_city`, `firm_state`, `firm_zip`
- Contact: `firm_contact_name`, `firm_contact_title`
- Proposal: `proposal_name`, `proposal_total`, `proposal_date`, `project_name`
- Invoice: `invoice_number`, `invoice_date`, `invoice_grand_total`, `client_company`, `project_name`

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
- **proposals** — Proposals linked to leads (statuses: Draft, Sent, Revision, Signed, Declined)
- **proposalPhases** — Phases within a proposal (Phase 1, Phase 2 for Add Services, etc.)
- **proposalFeeLines** — Fee lines per phase: service category × discipline × feeType (Fixed/Hourly) × amount
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
- `/doc-builder` → Google Docs template builder
- `/profile/firm` → Firm info (name, phone, email, address) — Settings section
- `/profile/contact` → Primary contact (name, title) — Settings section

---

## UI Layout

### App Shell
- **Sidebar** (Shadcn `Sidebar`, fixed width `14rem`):
  - Header: "STUDIO PM" brand label
  - Main nav: Dashboard, Projects, Companies, Contacts, Doc Builder
  - Footer: Settings section with **Firm** and **Contact** nav items, then a separator, then avatar + user name + Sign out button
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

### Proposal Structure
- A lead can have multiple proposals (e.g., base scope + add services)
- Each proposal has: name, description, status, docUrl, dateSent, dateSigned
- **Fee Breakdown**: structured as Phase → Service Category → Discipline
  - Service Categories: Documentation | Bid & Permit | Construction Administration
  - Disciplines: Interior Design | MEP & FP | Structural
  - Each discipline line: feeType (Fixed or Hourly) and amount
- Signing a proposal automatically advances the parent lead to "Active Project"
- **"Load to Doc Builder"** button on the proposal detail panel: upserts `project_name`, `proposal_name`, `proposal_total`, `proposal_date`, plus all `firm_*` fields from the current profile, then navigates to `/doc-builder`

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
Invoice detail page has a "Load to Doc Builder" button that pre-populates field values (invoice_number, invoice_date, project_name, client_company, invoice_grand_total, etc.) then navigates to `/doc-builder`.

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
- `PATCH /api/proposals/:id` — Update proposal (optionally replaces phases)
- `POST /api/proposals/:id/sign` — Sign proposal (advances lead to Active Project)
- `POST /api/proposals/:id/decline` — Decline proposal
- `DELETE /api/proposals/:id` — Delete proposal

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

---

## Authentication
- Google OAuth via Passport.js
- Session stored in PostgreSQL (connect-pg-simple)
- All API routes protected by `requireAuth` middleware

---

## Project Detail Page — Tab Structure

Active Project / Completed leads get 5 tabs: **Overview | Proposals | Time & Exp | Invoices | Notes**. Lead / Proposal status leads get 3 tabs (Overview, Proposals, Notes). Time & Expenses and Invoices tabs are only visible when `status ∈ { "Active Project", "Completed" }`.

### Time & Expenses Tab
Displays all hours and expenses logged against a project (across all invoices and unattached). Each entry shows an "Invoice #N" badge if attached to an invoice, or "Unattached" if not. Inline forms let you add new hours and expenses directly at the project level (`POST /api/leads/:leadId/hours` and `POST /api/leads/:leadId/expenses`). Entries can be deleted any time. Invoice attachment is handled through the Invoice Builder.

### Invoice Builder — Attach Project Entries
When creating a new invoice, a collapsible "Attach Project Entries" section appears if there are any unattached hours or expenses on the project. Checking an entry's checkbox includes it in the invoice total and passes its ID as `existingHoursIds`/`existingExpenseIds` in the create payload. On save, those entries' `invoiceId` is updated to the new invoice — they're now "attached" and no longer appear as unattached.

---

## Deployment Notes
- **contacts-fk migration** (`scripts/migrate-contacts-fk.ts`): This migration backfills `contact_id` on legacy `lead_companies` rows from old inline contact fields, then drops those columns. It must be run **before** deploying any code that assumes the four inline columns are absent. Run with: `npx tsx scripts/migrate-contacts-fk.ts`. Fully idempotent — checks column existence before the SELECT, and uses `DROP COLUMN IF EXISTS` for the drops.
- **Company-only address book migration** (`POST /api/companies/migrate-from-lead-companies`): Backfills `company_id` on `lead_companies` rows that have a `company_name` but no `company_id` yet. Does **not** backfill contacts (use the script above for that). Safe to re-run.
- **Hours & expenses nullable migration** (`scripts/migrate-hours-expenses-nullable.ts`): Makes `invoice_id` nullable on `hours_entries` and `expense_entries` tables so entries can exist at the project level without being attached to an invoice. Run with: `npx tsx scripts/migrate-hours-expenses-nullable.ts`. Fully idempotent — checks `is_nullable` before altering.

---

## User Preferences
- Pure greyscale design — no color in the UI palette
- Uppercase + wide tracking typography throughout
- Compact, information-dense layouts — no redundant headers or duplicate controls
- "New" buttons live in the same toolbar row as the search bar, not as floating top-right buttons
- Page titles shown in the app header bar — not repeated inside page content
