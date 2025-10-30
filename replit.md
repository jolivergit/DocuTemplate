# DocBuilder - Google Docs Template Manager

## Overview
DocBuilder is a web application that enables users to build Google Documents from customizable templates. Templates use tagged sections (e.g., `<<section_scope>>`, `<<content_scope>>`) to mark replaceable content. Users can manage reusable content snippets, map them to template tags, reorder sections, and generate final documents in Google Drive.

## Project Status
**MVP Complete** - All core features implemented and tested

## Recent Changes
- Complete implementation of Google Docs Template Builder MVP
- Full CRUD operations for categories and content snippets
- Drag-and-drop functionality for reordering template sections
- Google Drive and Google Docs API integration
- Beautiful, professional UI with dark mode support
- Database schema with PostgreSQL

## Features

### Core Functionality
1. **Template Loading**: Browse and load Google Docs templates from Google Drive
2. **Template Parsing**: Automatically extract tagged sections from documents
3. **Content Library**: Store and categorize reusable content snippets
4. **Tag Mapping**: Map content snippets to template tags
5. **Section Reordering**: Drag-and-drop to rearrange sections
6. **Document Generation**: Create new Google Docs with mapped content

### User Interface
- Three-panel workspace layout (desktop)
  - Left: Template structure tree with drag-and-drop
  - Center: Content library with search and filtering
  - Right: Tag mapping panel
- Responsive design with mobile support
- Dark mode with theme toggle
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
- `client/src/pages/home.tsx` - Main application page
- `client/src/components/template-structure.tsx` - Draggable section tree
- `client/src/components/content-library.tsx` - Content snippet manager
- `client/src/components/tag-mapping-panel.tsx` - Tag to content mapper

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
- Template versioning and history
- Advanced content search and filtering
- Template preview before generation
- Conditional sections based on rules
- Collaboration features for team sharing
- Bulk operations for content management
