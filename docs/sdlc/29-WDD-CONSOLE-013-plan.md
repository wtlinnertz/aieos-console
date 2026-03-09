# WDD-CONSOLE-013 — Implementation Plan

## Objective

Implement step detail view components for LLM-generated and acceptance-check step types, including generation streaming via SSE, validation result display, and freeze approval with artifact ID input.

## Components

### 1. StepView (`src/components/StepView.tsx`)
- Client component dispatching to appropriate view based on `step.stepType`
- LLM-generated: Generate button (in-progress), GenerationStream, Validate button (draft)
- Human-intake: placeholder message for WDD-CONSOLE-014
- Acceptance-check: source artifact path display and Validate button
- Consistency-check: placeholder comparison view
- Freeze section with artifact ID input when validated-pass
- Includes ProcessTransparency for all step types

### 2. GenerationStream (`src/components/GenerationStream.tsx`)
- Connects to SSE endpoint `GET /api/flow/{kitId}/step/{stepId}/generate`
- Uses native EventSource API
- Renders content progressively as plain text (ACF §3: no dangerouslySetInnerHTML)
- States: connecting, streaming, done, error
- Retry button on error

### 3. ValidationResultView (`src/components/ValidationResultView.tsx`)
- Renders PASS/FAIL status badge with color coding
- Summary text, completeness score with progress bar
- Hard gates table with per-gate PASS/FAIL
- Blocking issues list with gate names and locations
- Warnings list

### 4. ProcessTransparency (`src/components/ProcessTransparency.tsx`)
- Collapsible section showing four-file paths
- Shows "N/A" for null prompt path
- Lists required inputs with paths and roles

## Dependencies

- Types from `src/lib/services/flow-types.ts` (FlowStep)
- Types from `src/lib/services/state-types.ts` (ArtifactState, ValidationResult, ArtifactStatus)
- API endpoints: GET `.../generate` (SSE), POST `.../validate`, POST `.../freeze` (consumed, not created here)

## Constraints

- No `any` types
- Plain HTML, no CSS frameworks
- All components use `'use client'` directive
- ACF §3: LLM content displayed as plain text only
- ACF §8: No auto-advancing; each action requires explicit user click
