# Design Guidelines: Google Docs Template Builder

## Design Approach

**Selected Approach:** Design System + Reference-Based Hybrid
- **Primary Inspiration:** Linear (clean productivity interface) and Notion (document/content management patterns)
- **Supporting System:** Material Design principles for information hierarchy
- **Rationale:** This is a utility-focused productivity application requiring efficient workflows for managing complex hierarchical data. The interface prioritizes clarity, organization, and rapid task completion over visual flair.

## Core Design Principles

1. **Information Clarity:** Dense data displays with clear visual hierarchy
2. **Efficient Workflows:** Minimize clicks and cognitive load for common actions
3. **Spatial Organization:** Distinct zones for different tasks (template structure, content library, preview)
4. **Professional Restraint:** Clean, uncluttered interface that focuses attention on content

## Typography System

**Font Stack:**
- Primary: Inter (Google Fonts) - for UI elements, labels, and body text
- Monospace: JetBrains Mono (Google Fonts) - for template tags like `<<section_scope>>`

**Hierarchy:**
- Page Titles: text-2xl font-semibold (24px)
- Section Headers: text-lg font-medium (18px)
- Card Titles: text-base font-medium (16px)
- Body Text: text-sm (14px)
- Labels/Meta: text-xs font-medium uppercase tracking-wide (12px)
- Template Tags: text-xs font-mono (12px monospace)

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 3, 4, 6, and 8 exclusively
- Component padding: p-4 or p-6
- Section margins: mb-6 or mb-8
- Tight spacing: gap-2 or gap-3
- Comfortable spacing: gap-4 or gap-6

**Application Structure:**

**Header Bar** (fixed top, h-14):
- Logo/app name (left)
- Template name/breadcrumb (center)
- Action buttons: "Load Template", "Generate Document", user menu (right)
- Horizontal padding: px-6

**Main Content Area** (below header):
Three-column split-panel layout with resizable dividers:

1. **Left Panel - Template Structure** (w-80, min-w-64):
   - Hierarchical tree view of template sections
   - Drag handles on each node
   - Expand/collapse controls
   - Visual indicators for tag types
   - Sticky search/filter bar at top

2. **Center Panel - Content Library** (flex-1, min-w-96):
   - Top toolbar: Category filters, search, "Add Content" button
   - Content cards in vertical list
   - Each card shows: title, category tag, preview text, action buttons
   - Pagination or infinite scroll

3. **Right Panel - Preview/Details** (w-96, min-w-80):
   - Live preview of selected section
   - Tag mapping interface
   - Content replacement controls
   - "Apply to Template" action

**Responsive Behavior:**
- Desktop (>1280px): Three-column layout
- Tablet (768-1279px): Stack panels with tabs to switch between Structure/Library/Preview
- Mobile (<768px): Full-screen single panel with bottom navigation

## Component Library

### Navigation & Controls

**Primary Action Buttons:**
- Height: h-9
- Padding: px-4
- Typography: text-sm font-medium
- Border radius: rounded-md
- States: Include disabled state with reduced opacity

**Secondary Buttons:**
- Same dimensions as primary
- Different visual treatment (outline or ghost style)

**Icon Buttons:**
- Size: w-8 h-8
- Icon size: 16px
- Border radius: rounded

**Tab Navigation:**
- Height: h-10
- Active indicator: bottom border (border-b-2)
- Spacing: gap-6 between tabs

### Data Display

**Tree View Nodes:**
- Height per node: h-8
- Indentation per level: pl-4
- Components per node:
  - Expand/collapse icon (left, 16px)
  - Drag handle (6 vertical dots, 16px)
  - Tag type indicator (colored dot or icon, 12px)
  - Node label (text-sm)
  - Action menu (right, 16px)
- Hover state: Subtle background change
- Selected state: Distinct background treatment

**Content Cards:**
- Padding: p-4
- Border: border rounded-lg
- Spacing between cards: gap-2
- Card structure:
  - Header row: Category tag (left) + action buttons (right)
  - Title: text-base font-medium, mb-2
  - Preview text: text-sm, line-clamp-2
  - Footer: metadata (date, usage count) in text-xs

**Category Tags:**
- Padding: px-2 py-1
- Typography: text-xs font-medium
- Border radius: rounded
- Visual variants for different categories

### Forms & Inputs

**Search Inputs:**
- Height: h-9
- Padding: px-3
- Icon: Search icon (16px) positioned left with pl-9
- Border radius: rounded-md
- Placeholder: text-sm

**Dropdown Selects:**
- Height: h-9
- Padding: px-3
- Border radius: rounded-md
- Chevron icon (right)

**Text Areas (for content editing):**
- Padding: p-3
- Min height: min-h-32
- Border radius: rounded-md
- Resize: resize-y

### Modals & Overlays

**Modal Dialog:**
- Max width: max-w-2xl
- Padding: p-6
- Border radius: rounded-lg
- Header: mb-6 with title (text-xl font-semibold) and close button
- Content area: mb-6
- Footer: flex justify-end gap-3 for action buttons

**Dropdown Menus:**
- Min width: min-w-48
- Padding: py-2
- Border radius: rounded-md
- Menu items: px-3 py-2 text-sm
- Dividers: border-t my-2

### Status & Feedback

**Loading States:**
- Skeleton screens for content cards (h-24, rounded-lg, animated pulse)
- Spinner for button actions (16px inline spinner)

**Empty States:**
- Center-aligned text and icon
- Illustration or large icon (48px)
- Heading: text-lg font-medium, mb-2
- Description: text-sm, mb-4
- Call-to-action button

**Toast Notifications:**
- Fixed position: bottom-right
- Width: w-96
- Padding: p-4
- Border radius: rounded-lg
- Auto-dismiss after 5s
- Include icon (16px), message, and dismiss button

## Icons

**Icon Library:** Heroicons (outline style for most UI, solid for emphasis)
- Access via CDN: https://cdn.jsdelivr.net/npm/heroicons@2.0.18/
- Consistent sizing: 16px for inline, 20px for standalone, 24px for large

**Common Icons:**
- Template structure: DocumentTextIcon
- Content library: ArchiveBoxIcon
- Drag handle: Bars3Icon
- Expand/collapse: ChevronDownIcon/ChevronRightIcon
- Search: MagnifyingGlassIcon
- Add content: PlusIcon
- Delete: TrashIcon
- Edit: PencilIcon
- Generate document: SparklesIcon

## Interactive Patterns

**Drag and Drop:**
- Visual feedback: Reduce opacity to 60% while dragging
- Drop zones: Show border-2 border-dashed
- Drop indicator: Horizontal line showing insertion point

**Expandable Sections:**
- Smooth transitions (transition-all duration-200)
- Rotate chevron icon 90deg when expanded

**Content Mapping:**
- Click content card → highlights in preview
- Drag content onto template tag → replaces placeholder
- Visual connection line during drag (optional enhancement)

## Accessibility

- All interactive elements: min-h-9 (44px touch target)
- Focus indicators: ring-2 ring-offset-2 on keyboard focus
- ARIA labels for icon-only buttons
- Keyboard shortcuts for common actions (display in tooltips)
- Skip links for main navigation areas

## Animation Philosophy

**Minimal, Purposeful Motion:**
- Transitions: 150-200ms for state changes
- Easing: ease-in-out for most transitions
- Avoid: Page load animations, decorative effects, scroll-triggered animations
- Use only for: Dropdown menus, modal appearance, drag feedback, loading states

This design creates a professional, efficient workspace optimized for document template management with clear information hierarchy and streamlined workflows.