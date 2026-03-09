# Tests — WDD-CONSOLE-003 (Flow Definition Parser)

## Test Plan

### Acceptance Tests

**AT-1 (AC1): Valid flow.yaml produces correctly typed FlowDefinition**
- Given: A complete valid `flow.yaml` string with kit metadata, steps array (all step types), four_files, required_inputs, produces, freeze_gate, and handoff section
- When: `parseFlowDefinition(content)` is called
- Then: Returns a `FlowDefinition` with:
  - `kit.name`, `kit.id`, `kit.version` correctly mapped
  - Each `FlowStep` has all fields mapped from snake_case to camelCase
  - `stepType` is a valid enum value
  - `fourFiles` has spec, template, prompt (string|null), validator
  - `requiredInputs` is array of `{ path, role }`
  - `produces` has `artifactIdPrefix` and `outputFilename`
  - `freezeGate` is boolean
  - `handoff` has `targetKit`, `artifactPlacement` with `sourceStep`, `targetPath`, `acceptanceCheck`

**AT-2 (AC2): Missing required field throws FlowDefinitionParseError**
- Given: A `flow.yaml` string with `steps` field missing
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError` with message identifying `steps` as the missing field

**AT-3 (AC3): Invalid dependency reference throws FlowDefinitionParseError**
- Given: A `flow.yaml` with a step whose `dependencies` contains `"nonexistent-step"`
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError` identifying the invalid dependency reference

### Failure Tests

**FT-1: Missing kit section throws FlowDefinitionParseError**
- Given: A `flow.yaml` with no `kit` section
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError` with message identifying `kit`

**FT-2: Missing required step fields throws FlowDefinitionParseError**
- Given: A `flow.yaml` where a step is missing `id`
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError` with message identifying the missing field

**FT-3: Invalid stepType throws FlowDefinitionParseError**
- Given: A `flow.yaml` where a step has `step_type: "invalid-type"`
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError` identifying the invalid step type

**FT-4: Duplicate step IDs throws FlowDefinitionParseError**
- Given: A `flow.yaml` with two steps both having `id: "step-1"`
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError` identifying the duplicate step ID

**FT-5: Malformed YAML throws FlowDefinitionParseError**
- Given: Syntactically invalid YAML content (e.g., `"kit:\n  name: test\n  : broken"`)
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError`

### Edge Case Tests

**EC-1: Optional handoff absent**
- Given: A valid `flow.yaml` with no `handoff` section
- When: `parseFlowDefinition(content)` is called
- Then: Returns a `FlowDefinition` with `handoff` as `undefined`

**EC-2: Empty dependencies array**
- Given: A valid step with `dependencies: []`
- When: Parsed
- Then: `step.dependencies` is an empty array

**EC-3: prompt is null in four_files**
- Given: A step where `four_files.prompt` is `null`
- When: Parsed
- Then: `step.fourFiles.prompt` is `null`

**EC-4: Empty required_inputs array**
- Given: A step with `required_inputs: []`
- When: Parsed
- Then: `step.requiredInputs` is an empty array

**EC-5: Multiple steps with valid cross-references**
- Given: Step B depends on Step A, and both exist
- When: Parsed
- Then: Both steps present, dependency validates without error

**EC-6: Missing kit.name throws FlowDefinitionParseError**
- Given: `kit` section exists but `name` is missing
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError` identifying `kit.name`

**EC-7: Missing kit.id throws FlowDefinitionParseError**
- Given: `kit` section exists but `id` is missing
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError` identifying `kit.id`

**EC-8: Missing step.four_files throws FlowDefinitionParseError**
- Given: Step is missing `four_files`
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError`

**EC-9: Missing step.name throws FlowDefinitionParseError**
- Given: Step is missing `name`
- When: `parseFlowDefinition(content)` is called
- Then: Throws `FlowDefinitionParseError`

**EC-10: Steps is empty array**
- Given: `steps: []`
- When: `parseFlowDefinition(content)` is called
- Then: Returns FlowDefinition with empty steps array (valid — no steps to validate)

**EC-11: freeze_gate defaults or maps correctly**
- Given: A step with `freeze_gate: true` and another with `freeze_gate: false`
- When: Parsed
- Then: Both map correctly to boolean `freezeGate`

## Test Count Summary
- Acceptance: 3
- Failure: 5
- Edge cases: 11
- **Total: 19 tests**
