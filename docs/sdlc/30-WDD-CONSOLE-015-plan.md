# WDD-CONSOLE-015 — Implementation Plan

## Objective

Implement ArtifactViewer (sanitized Markdown rendering) and ArtifactEditor (text editing with save and re-validation tracking) components, plus ArtifactToggle for switching between modes.

## Components

### 1. ArtifactViewer (`src/components/ArtifactViewer.tsx`)
- Client component rendering sanitized HTML from Markdown content
- Uses async `sanitizeContent()` via useEffect/useState pattern
- Shows loading state while sanitization is in progress
- Displays "Frozen" badge when isFrozen prop is true
- Uses dangerouslySetInnerHTML (safe because content passes through sanitization pipeline per ACF section 3)

### 2. ArtifactEditor (`src/components/ArtifactEditor.tsx`)
- Client component with textarea for Markdown editing
- Tracks dirty state by comparing current text to original content prop
- Save button disabled when not dirty or when saving is in progress
- Shows "Saving..." label during save operations
- Shows "Re-validation needed" indicator when needsRevalidation is true

### 3. ArtifactToggle (`src/components/ArtifactToggle.tsx`)
- Client component toggling between ArtifactViewer and ArtifactEditor
- View/Edit toggle buttons
- When frozen, only View mode available (Edit button not rendered)

## Dependencies

- `sanitizeContent` from `src/lib/sanitize.ts` (async Markdown-to-sanitized-HTML pipeline)
- Types from `src/lib/services/state-types.ts` (ArtifactState, ArtifactStatus)

## Constraints

- No `any` types
- Plain HTML with inline styles, no CSS frameworks
- All components use `'use client'` directive
- Async sanitization handled with useEffect/useState pattern with cancellation
