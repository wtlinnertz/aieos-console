# Plan — WDD-CONSOLE-003 (Flow Definition Parser)

## Files to Create

1. **`src/lib/services/flow-types.ts`** — TypeScript interfaces: `FlowDefinition`, `FlowStep`, `HandoffDefinition`
2. **`src/lib/services/flow-parser.ts`** — `parseFlowDefinition(content: string): FlowDefinition` function with YAML parsing and schema validation
3. **`src/lib/services/__tests__/flow-parser.test.ts`** — 19 unit tests per test plan

## Files to Modify

4. **`src/lib/services/errors.ts`** — Add `FlowDefinitionNotFoundError` and `FlowDefinitionParseError` error types

## Implementation Sequence

1. Add error types to `errors.ts`
2. Create `flow-types.ts` with exported TypeScript interfaces
3. Create `flow-parser.ts` implementing:
   - YAML parse via `yaml` library (already in dependencies)
   - Validate kit section (name, id, version required)
   - Validate steps array (each step: id, name, artifact_type, step_type, four_files, required_inputs, produces, freeze_gate)
   - Validate step_type enum
   - Validate unique step IDs
   - Validate dependency references resolve to existing step IDs
   - Map snake_case YAML fields to camelCase TypeScript fields
   - Optional handoff section validation
4. Create test file with all 19 tests

## Design Decisions

- **Separate types file:** `flow-types.ts` keeps interfaces importable without pulling in parser logic or `yaml` dependency
- **No new npm dependencies:** Uses existing `yaml` package from package.json
- **Error messages include field names:** Per AC2, errors identify which field is missing/invalid
- **Empty steps array is valid:** An empty `steps: []` is structurally valid — there are no steps to validate references against
- **snake_case → camelCase mapping:** Done explicitly field-by-field (not generic converter) for type safety and readability per DCF §2

## Constraints
- No `any` types (DCF §3)
- Cyclomatic complexity ≤10 per function, max nesting 3
- Parser does not read files — accepts string input only (single responsibility)
