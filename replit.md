# DocBuilder - Google Docs Template Manager

## Overview
DocBuilder is a web application that enables users to build Google Documents from customizable templates. Templates support two types of reusable content:
- **Field Tags** `{{field_name}}` - For simple key-value data (company_name → "Acme Corp")
- **Content Tags** `<<content_name>>` - For rich text snippets (introductions, sections, descriptions)

Users can manage reusable content snippets and field values, map them to template tags, reorder sections, and generate final documents in Google Drive.

## Project Status
**MVP Complete** - All core features implemented and tested

## Recent Changes (December 05, 2025)
- **Simplified field model**: Replaced complex Profile objects with simple FieldValue key-value pairs - each field tag `{{name}}` maps to one value
- **New field management dialogs**: Added FieldValueDialog for creating/editing field values, ManageFieldValuesDialog for managing all values
- **Updated Tags Panel**: Replaced profile-related logic with fieldValue handling, using Variable icon for field tags
- **Document/Fields tab split**: TagsPanel now has two tabs - Document tab shows content tags only (`<<...>>`), Fields tab shows field tags only (`{{...}}`)
- **Resizable panels**: Template Tags and Content Library panels have a draggable divider for custom sizing
- **Embedded field detection**: Content snippets automatically detect `{{field}}` tags within their content
- **Visual indicator for embedded fields**: Content Library shows a badge when snippets contain embedded field tags
- **Nested field resolution**: Document generation now resolves field tags embedded within content snippets
- **Implemented dual tag syntax**: Field tags use `{{...}}` and content tags use `<<...>>` to distinguish field values from content snippets
- **Context-aware Content Library**: Automatically switches to Field Values tab when a field tag is selected, Snippets tab for content tags

## Previous Changes (November 26, 2025)
- **Added delete functionality**: Delete content snippets (trash icon on hover) and categories (via Settings > Manage Categories) with confirmation dialogs
- **Simplified UI to two-panel layout**: Replaced overwhelming 3-panel design with intuitive 2-panel collapsible layout (Template Tags + Content Library)
- **Added collapsible panels**: Both panels can collapse to a thin rail (40px) to maximize workspace, with proper space reclamation via `flex-none`
- **Added recursive tag search**: Search filters sections and tags, preserving ancestor sections when descendants match
- **Updated color palette**: Warm neutral grays with terracotta accent — designed to complement a black and white logo
- **Updated font**: Switched to Outfit for a rounded, approachable feel

## Previous Changes (October 31, 2025)
- **Fixed document generation to preserve template formatting**: Now uses Drive API `files.copy()` to duplicate the template, then applies `replaceAllText` via Docs API to replace tags while maintaining all original fonts, colors, heading styles, bold/italic, and formatting
- Fixed template loading error: Updated `apiRequest` to return parsed JSON instead of raw Response object
- Complete implementation of Google Docs Template Builder MVP
- Full CRUD operations for categories and content snippets
- Drag-and-drop UI for section reordering (backend implementation pending)
- Google Drive and Google Docs API integration with OAuth token refresh handling
- Beautiful, professional UI with dark mode support
- Multi-tenant PostgreSQL database with userId-based data isolation

## Features

### Core Functionality
1. **Template Loading**: Browse and load Google Docs templates from Google Drive
2. **Template Parsing**: Automatically extract tagged sections from documents
3. **Content Library**: Store and categorize reusable content snippets
4. **Tag Mapping**: Map content snippets to template tags
5. **Section Reordering**: Drag-and-drop UI for rearranging sections (visual only - backend reordering pending)
6. **Document Generation**: Create new Google Docs with mapped content while preserving all formatting

### User Interface
- Two-panel collapsible workspace layout (desktop)
  - Left: Template Tags panel with drag-and-drop section reordering and tag mapping indicators
  - Right: Content Library panel with search, categories, and snippet management
  - Both panels collapse to thin rails (40px) for maximum workspace flexibility
- Recursive tag search that preserves ancestor sections when filtering
- Responsive design with mobile support (bottom navigation for panel switching)
- Dark mode with theme toggle
- Warm neutral color palette with terracotta accent, Outfit font
- Professional productivity-focused design
- Loading, empty, and error states throughout

## Architecture

### Frontend Stack
- React with TypeScript
- Wouter for routing
- TanStack Query for data fetching
- @dnd-kit for drag-and-drop
- Tailwind CSS + Shadcn UI components
- Dark mode support

### Backend Stack
- Express.js server
- PostgreSQL database (Neon)
- Drizzle ORM
- Google Drive API integration
- Google Docs API integration

### Database Schema
- **categories**: Organize content snippets by category with colors
- **contentSnippets**: Store reusable text content with usage tracking

## API Endpoints

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create new category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Content Snippets
- `GET /api/content-snippets` - List all content snippets
- `POST /api/content-snippets` - Create new snippet
- `PATCH /api/content-snippets/:id` - Update snippet
- `DELETE /api/content-snippets/:id` - Delete snippet

### Google Drive & Docs
- `GET /api/google-drive/files` - List Google Docs from Drive
- `POST /api/templates/parse` - Parse template and extract tags
- `POST /api/documents/generate` - Generate final document

## Development Guidelines

### Running the Project
```bash
npm run dev
```
This starts both the Express server and Vite dev server on port 5000.

### Database Migrations
```bash
npm run db:push
```
Use Drizzle Kit to push schema changes to PostgreSQL.

### Code Organization
- `/client/src/pages` - Page components
- `/client/src/components` - Reusable UI components
- `/server` - Backend API and business logic
- `/shared` - Shared types and schemas

### Design System
- Follow design guidelines in `design_guidelines.md`
- Use Shadcn UI components for consistency
- Maintain proper spacing and typography hierarchy
- Ensure all interactive elements have `data-testid` attributes

## Integration Setup

### Google Drive & Docs
The app uses Replit's Google Drive and Google Docs integrations for authentication and API access. These handle OAuth and token management automatically.

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- Replit connector environment variables (managed automatically)

## Key Files

### Frontend
- `client/src/pages/home.tsx` - Main application page with two-panel layout
- `client/src/components/collapsible-panel.tsx` - Collapsible panel wrapper component
- `client/src/components/tags-panel.tsx` - Template tags with drag-and-drop and search
- `client/src/components/content-library.tsx` - Content snippet manager with categories and field values
- `client/src/components/field-value-dialog.tsx` - Dialog for creating/editing field values
- `client/src/components/manage-field-values-dialog.tsx` - Dialog for managing all field values
- `client/src/components/template-structure.tsx` - Legacy draggable section tree

### Backend
- `server/routes.ts` - API endpoint definitions
- `server/storage.ts` - Database operations
- `server/google-drive-client.ts` - Google Drive integration
- `server/google-docs-client.ts` - Google Docs integration

### Shared
- `shared/schema.ts` - Database models and TypeScript types

## User Workflow

1. **Load Template**: Click "Load Template" to browse Google Docs
2. **Parse Template**: Select a document to extract its tagged sections
3. **Create Content**: Add reusable content snippets with categories
4. **Map Tags**: Click tags in the structure tree, then select content to map
5. **Reorder Sections**: Drag sections to rearrange document structure
6. **Generate Document**: Click "Generate Document" to create final output in Google Drive

## Future Enhancements
- **Section reordering in generated documents**: Implement named ranges/bookmarks to physically reorder sections while preserving formatting (complex Google Docs API operation)
- Template versioning and history
- Advanced content search and filtering
- Template preview before generation
- Conditional sections based on rules
- Collaboration features for team sharing
- Bulk operations for content management
