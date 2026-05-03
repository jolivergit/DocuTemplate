# DocBuilder - Project Pipeline Manager + Google Docs Template Generator

## Overview
DocBuilder is a full project pipeline manager with three stages: **Lead → Proposal → Project**. It also includes an integrated Google Docs template builder for generating client documents.

### Pipeline Stages
- **Lead Management** (Task #1 — Complete): Track opportunities with status, probability, potential fee, square footage, and 6 associated company roles per lead
- **Proposal Management** (Task #2 — Planned): Generate proposals from Google Docs templates using lead data
- **Project & Invoice Management** (Task #3 — Planned): Manage active projects and generate invoices

### Doc Builder
Generate Google Documents from customizable templates. Templates support:
- **Field Tags** `{{field_name}}` — Simple key-value data (company_name → "Acme Corp")
- **Content Tags** `<<content_name>>` — Rich text snippets (introductions, sections)

## Architecture

### Frontend Stack
- React with TypeScript
- Wouter for routing
- TanStack Query for data fetching
- Tailwind CSS + Shadcn UI (sidebar, collapsible, resizable, etc.)
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

### Key Routes
- `/` → Leads list page (pipeline dashboard)
- `/leads/:id` → Lead detail page (company info, status management)
- `/doc-builder` → Google Docs template builder

## Lead Management

### Lead Fields
- `id` — Serial integer (the project number)
- `projectName`, `description`
- `squareFootage`, `potentialFee`
- `probability` — LOW / MEDIUM / HIGH
- `status` — Lead → Proposal → Active Project → Completed | Lost

### Company Roles (6 per Lead)
Each role has: company name, full address, and a primary contact (name, title, phone, email)
- Contract Holder
- Client
- MEP Engineering
- Structural Engineering
- Equipment Vendor
- Furniture Vendor

## API Endpoints

### Leads
- `GET /api/leads` — List all leads with companies
- `GET /api/leads/:id` — Get single lead with companies
- `POST /api/leads` — Create lead (with nested companies)
- `PATCH /api/leads/:id` — Update lead (with optional company upsert)
- `DELETE /api/leads/:id` — Delete lead

### Categories
- `GET /api/categories`, `POST`, `PATCH /:id`, `DELETE /:id`

### Content Snippets
- `GET /api/content-snippets`, `POST`, `PATCH /:id`, `DELETE /:id`

### Field Values
- `GET /api/field-values`, `POST`, `PATCH /:id`, `DELETE /:id`

### Google Drive & Docs
- `GET /api/google-drive/files` — List Google Docs from Drive
- `POST /api/templates/parse` — Parse template and extract tags
- `POST /api/documents/generate` — Generate final document

## Key Files

### Frontend
- `client/src/App.tsx` — SidebarProvider layout, AuthGate, routing
- `client/src/components/app-sidebar.tsx` — Navigation sidebar
- `client/src/pages/leads.tsx` — Leads list with search/filter
- `client/src/pages/lead-detail.tsx` — Lead detail with company sections, status progression
- `client/src/components/lead-form-dialog.tsx` — Create/edit lead dialog (all 6 company sections)
- `client/src/pages/home.tsx` — Doc Builder page (template tags + content library)

### Backend
- `server/routes.ts` — All API endpoints
- `server/storage.ts` — Database operations (DatabaseStorage class)
- `server/google-drive-client.ts` — Google Drive integration
- `server/google-docs-client.ts` — Google Docs integration
- `server/html-to-google-docs.ts` — HTML to Docs API conversion

### Shared
- `shared/schema.ts` — All database models, enums, and TypeScript types

## Running the Project
```bash
npm run dev
```
Starts Express + Vite on port 5000.

## Database Notes
- Tables created directly via SQL (drizzle-kit push is interactive and not used)
- Use `executeSql` in code_execution for schema changes
- All data is user-isolated (userId foreign key on every table)

## Design System
- Warm neutral color palette, Outfit font, terracotta accent
- Shadcn UI components throughout (sidebar, card, badge, collapsible, etc.)
- All interactive elements have `data-testid` attributes
- Dark mode supported

## Google Docs API Notes
- Template is copied (Drive `files.copy()`) to preserve formatting
- Field tags use `replaceAllText` (inherits surrounding styles)
- Content tags convert HTML to Docs API batch requests
- Google Docs API has no `updateListProperties` — nested list styles use separate-list workaround
