# DocBuilder - Project Pipeline Manager + Google Docs Template Generator

## Overview
DocBuilder is a full project pipeline manager with three stages: **Lead → Proposal → Project**. It also includes an integrated Google Docs template builder for generating client documents.

### Pipeline Stages
- **Lead Management** (Complete): Track opportunities with status, probability, potential fee, square footage, and 6 associated company roles per lead
- **Proposal Management** (Complete): Create multi-phase proposals with fee breakdown by service category and discipline. Mark as Signed to advance lead to Active Project.
- **Project & Invoice Management** (Complete): Track invoices built on top of signed proposals, with hours entries, expense entries, and a project comments log.

### Doc Builder
Generate Google Documents from customizable templates. Templates support:
- **Field Tags** `{{field_name}}` — Simple key-value data (company_name → "Acme Corp")
- **Content Tags** `<<content_name>>` — Rich text snippets (introductions, sections)

## Architecture

### Frontend Stack
- React with TypeScript
- Wouter for routing
- TanStack Query for data fetching
- Tailwind CSS + Shadcn UI (sidebar, tabs, collapsible, dialogs, etc.)
- Dark mode support

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
- **profiles** — Legacy (kept for migration)
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
- `/` → Dashboard
- `/projects` → Projects list (pipeline)
- `/projects/:id` → Project detail page with tabs: Overview | Proposals | Project
- `/contacts` → Contacts page (address book + project-derived contacts)
- `/doc-builder` → Google Docs template builder

## Lead Management

### Lead Fields
- `id` — Serial integer (the project number)
- `projectName`, `description`
- `squareFootage`, `potentialFee`
- `probability` — LOW | MEDIUM | HIGH
- `status` — Lead | Proposal | Active Project | Completed | Lost

### Lead Companies
Each lead can have up to 6 companies by role: ContractHolder, Client, MEP, Structural, EquipmentVendor, FurnitureVendor. Each has: companyName, address, contactFullName, contactTitle, contactPhone, contactEmail.

## Proposal Management

### Proposal Structure
- A lead can have multiple proposals (e.g., base scope + add services)
- Each proposal has: name, description, status, docUrl, dateSent, dateSigned
- **Fee Breakdown**: structured as Phase → Service Category → Discipline
  - Service Categories: Documentation | Bid & Permit | Construction Administration
  - Disciplines: Interior Design | MEP & FP | Structural
  - Each discipline line: feeType (Fixed or Hourly) and amount
- Signing a proposal automatically advances the parent lead to "Active Project"

### Proposal Statuses
Draft → Sent → Revision → Signed / Declined

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
Invoice detail page has a "Load to Doc Builder" button that pre-populates field values (invoice_number, invoice_date, project_name, client_company, invoice_grand_total, etc.) so the user can generate an invoice document from their template library.

## API Endpoints

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
- `POST /api/field-values/upsert-by-name` — Upsert field value by name (used for invoice doc pre-population)

## Authentication
- Google OAuth via Passport.js
- Session stored in PostgreSQL (connect-pg-simple)
- All API routes protected by `requireAuth` middleware
