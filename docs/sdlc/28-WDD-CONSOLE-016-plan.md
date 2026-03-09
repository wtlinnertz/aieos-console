# WDD-CONSOLE-016 — Implementation Plan

## Objective

Implement the root page (`/`) for the AIEOS Console that allows users to initialize a new project or view an existing one.

## Components

### 1. ProjectSetup (`src/components/ProjectSetup.tsx`)
- Client component with form for project initialization
- Fields: project directory, kit paths (comma-separated), LLM provider, model, API key env var
- Submits POST to `/api/project/initialize`
- Handles success (redirect), 409 (already initialized), and network errors

### 2. ProjectOverview (`src/components/ProjectOverview.tsx`)
- Client component displaying existing project state
- Shows project ID, kit configs (with links to `/flow/{kitId}`), and LLM configs
- Accepts `ProjectState` as prop

### 3. Root Page (`src/app/page.tsx`)
- Client component that fetches GET `/api/project` on mount
- Conditionally renders ProjectSetup (no project) or ProjectOverview (project exists)
- Shows loading state during fetch

## Dependencies

- Types from `src/lib/services/state-types.ts` (ProjectState, KitConfig, LlmConfig)
- API endpoints: GET `/api/project`, POST `/api/project/initialize` (consumed, not created here)

## Constraints

- No `any` types
- Plain HTML, no CSS frameworks
- All interactive components use `'use client'` directive
