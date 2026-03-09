# Tests — WDD-CONSOLE-005 (Step Input Assembly)

## Test Plan

### Acceptance Tests

**AT-1 (AC1): Four-file content and required_inputs returned with correct roles**
- Given: Step with spec, template, prompt, validator, and 2 required_inputs; all files exist
- When: `getStepInputs(kitPath, stepId, projectDir)` called
- Then: Returns StepInputs with all 4 four-file contents and 2 named required inputs

**AT-2 (AC2): Upstream frozen artifacts included**
- Given: Step depends on 2 upstream steps, both frozen with artifactPath set
- When: `getStepInputs` called
- Then: `upstreamArtifacts` contains 2 NamedInput entries with correct content

**AT-3 (AC3): Missing required_input throws InputFileNotFoundError**
- Given: Step declares a required_input whose file doesn't exist
- When: `getStepInputs` called
- Then: Throws `InputFileNotFoundError` identifying the missing file

### Failure Tests

**FT-1: StepNotFoundError for non-existent stepId**
- Given: stepId "missing-step" not in flow definition
- When: `getStepInputs` called
- Then: Throws `StepNotFoundError`

**FT-2: Upstream artifact not frozen (no artifactPath)**
- Given: Step depends on upstream step that is not yet frozen (artifactPath undefined)
- When: `getStepInputs` called
- Then: Throws `InputFileNotFoundError` or similar error

### Edge Case Tests

**EC-1: Null prompt in four-files**
- Given: Step with `fourFiles.prompt = null`
- When: `getStepInputs` called
- Then: Returns StepInputs with `prompt: null`

**EC-2: Empty required_inputs**
- Given: Step with `requiredInputs: []`
- When: `getStepInputs` called
- Then: `requiredInputs` is empty array

**EC-3: Step with no dependencies**
- Given: Step with `dependencies: []`
- When: `getStepInputs` called
- Then: `upstreamArtifacts` is empty array

**EC-4: Four-file paths resolved relative to kit directory**
- Given: Step with `fourFiles.spec = "docs/specs/prd-spec.md"` and kitPath "/kits/pik"
- When: `getStepInputs` called
- Then: `readFile` called with "/kits/pik/docs/specs/prd-spec.md"

## Test Count Summary
- Acceptance: 3
- Failure: 2
- Edge cases: 4
- **Total: 9 tests**
