# Discovery PRD

## 1. Document Control

| Field | Value |
|-------|-------|
| Artifact ID | DPRD-CONSOLE-001 |
| Version | 1.0 |
| Date | 2026-03-07 |
| Author | AI-generated, human-reviewed |
| Status | Frozen |
| Upstream PFD | PFD-CONSOLE-001 |
| Upstream VH | VH-CONSOLE-001 |
| Upstream AR | AR-CONSOLE-001 |
| Upstream EL | EL-CONSOLE-001 |
| Governance Model Version | 1.0 |
| Prompt Version | 1.0 |

---

## 2. Problem Statement

Teams and organizations attempting to use AIEOS must manually navigate 6 kits containing 33+ artifact types, each governed by four files (spec, template, prompt, validator), while tracking artifact dependencies, sequencing, and freeze state across sessions. This creates a high barrier to entry that prevents non-expert users — particularly product managers and other non-technical stakeholders — from operating the framework independently, and makes even experienced technical users slow and error-prone. This problem requires attention now because the framework has reached structural maturity but has no adoption interface, and the initiative owner's observation is that no comparable guided governance execution tooling exists in the market.

Source: PFD-CONSOLE-001

---

## 3. Goals (What "Success" Means)

| Goal ID | Goal | Success Criterion | VH Trace |
|---------|------|-------------------|----------|
| G-1 | Reduce process navigation overhead for technical users | Process navigation consumes less than 20% of total artifact generation time | HYP-1 |
| G-2 | Enable non-technical users to operate AIEOS discovery processes independently | ≥ 50% of non-technical test users complete a PIK discovery flow without assistance within 60 minutes | HYP-2 |
| G-3 | Improve artifact quality through integrated validation | Average validation-rework cycles per artifact ≤ 2 | HYP-3 |
| G-4 | Enable faster AIEOS adoption evaluation | ≥ 60% of evaluators can accurately describe AIEOS artifact flow after one guided session of ≤ 90 minutes | HYP-4 |

---

## 4. Non-Goals (Hard Exclusions)

The following are explicitly excluded from this initiative. These are enforceable constraints on all downstream artifacts.

- **NG-1:** Kit authoring or modification — the console is for running AIEOS processes, not building or editing kits (specs, templates, prompts, validators). Rationale: different problem space; extending into kit authoring before the running experience is solid risks scope creep (PFD §8).
- **NG-2:** Multi-user concurrent access — the system supports single-user operation with a lock file to prevent concurrent access. Rationale: multi-user adds significant complexity (state sync, conflict resolution, auth); single-user is sufficient for initial adoption (PFD §8, AR ASM-7).
- **NG-3:** Authentication and authorization — the system runs as an internal tool on a trusted network. Rationale: auth is not needed for single-user local deployment; can be added later (PFD §8).
- **NG-4:** Non-happy-path flows — re-entry, escalation, cross-initiative conflict resolution, and iteration patterns are excluded. Rationale: start with the nominal forward flow to validate the core experience before adding complexity (PFD §8).
- **NG-5:** Cloud deployment — the system runs locally only. Rationale: local deployment is sufficient for initial use and evaluation (PFD §8).

---

## 5. Users / Personas

| PFD Reference | User / Persona | Context for Engineering |
|---------------|---------------|----------------------|
| UG-1 | Engineers and Architects | Need to generate artifacts in correct sequence, with right inputs assembled, validators run automatically, and artifact state tracked across sessions. Comfortable with terminal and browser interfaces. |
| UG-2 | Product Managers | Need to fill intake forms, review generated artifacts, and approve freezes without navigating kit file structures or setting up AI sessions manually. Browser-only users. |
| UG-3 | Team/Org Leaders Evaluating Adoption | Need to see the AIEOS process in action through a guided walkthrough to form an informed adoption decision. Browser-only users. |

---

## 6. Requirements

### Functional Requirements

**FR-1:** The system SHALL present the AIEOS artifact flow as a guided sequence of steps, showing the user which step they are on, which steps are complete, and which steps remain.
- VH Trace: HYP-1

**FR-2:** The system SHALL enforce freeze-before-promote by preventing the user from starting generation of a downstream artifact until all upstream artifacts are frozen.
- VH Trace: HYP-1

**FR-3:** The system SHALL automatically assemble the required inputs for each artifact generation step (spec, template, prompt, upstream frozen artifacts) by reading them from the configured kit directory.
- VH Trace: HYP-1

**FR-4:** The system SHALL call a configured LLM to generate artifacts using the appropriate AIEOS prompt and assembled inputs, and present the generated artifact to the user for review.
- VH Trace: HYP-1, HYP-2

**FR-5:** The system SHALL call a configured LLM to run the appropriate AIEOS validator against a generated artifact and present the PASS/FAIL result with any blocking issues and warnings to the user.
- VH Trace: HYP-3

**FR-6:** The system SHALL allow the user to review, edit, and approve a generated artifact before freezing it.
- VH Trace: HYP-1, HYP-2

**FR-7:** The system SHALL track artifact state (draft, validated, frozen) persistently across sessions, stored in the project directory.
- VH Trace: HYP-1

**FR-8:** The system SHALL support the full PIK-through-EEK happy path: Work Classification → Discovery Intake → PFD → VH → AR → EL → DPRD → (handoff to EEK) → PRD acceptance → ACF → SAD → DCF → TDD → WDD → Execution Plan → per-work-item execution (Tests → Plan → Code → Review) → ORD.
- VH Trace: HYP-1, HYP-4

**FR-17:** The system SHALL guide users through the per-work-item execution cycle in execution plan order, presenting each work item's context and running the four execution phases sequentially: Tests (test-prompt.md → human approves test specs), Plan (plan-prompt.md → human approves plan), Code (code-prompt.md → tests pass), Review (review-prompt.md → human approves).
- VH Trace: HYP-1

**FR-18:** The system SHALL track execution progress per work item and per work group, showing which items are complete, in progress, and remaining within the execution plan.
- VH Trace: HYP-1

**FR-9:** The system SHALL allow the user to configure which LLM provider and model to use, with the ability to set different providers per artifact type.
- VH Trace: HYP-1

**FR-10:** The system SHALL provide a project configuration mechanism that specifies the project directory, kit directory paths, and LLM settings.
- VH Trace: HYP-1

**FR-11:** The system SHALL create and update the Engagement Record as artifacts are frozen, maintaining the appropriate layer section with artifact IDs and freeze dates.
- VH Trace: HYP-1

**FR-12:** The system SHALL provide a browser-based interface accessible to both technical and non-technical users.
- VH Trace: HYP-2, HYP-4

**FR-13:** The system SHALL present intake forms (Discovery Intake, Architecture Context, Design Context) as guided form experiences that map to the template structure, rather than requiring the user to edit raw markdown.
- VH Trace: HYP-2

**FR-14:** The system SHALL display the underlying AIEOS process at each step — which kit is active, which artifact type is being generated, which spec/prompt/validator files are being used — so the user understands what is happening and why.
- VH Trace: HYP-4

**FR-15:** The system SHALL implement a lock file mechanism to prevent multiple users from operating on the same project simultaneously.
- VH Trace: Cross-cutting (NG-2 constraint implementation)

**FR-16:** The system SHALL track and display LLM usage per artifact (tokens consumed, provider used) so that cost can be monitored.
- VH Trace: Cross-cutting (PFD §8 constraint — cost is an adoption factor)

### Non-Functional Requirements

**NFR-1:** The system SHALL store all project state as files within the project directory, readable and inspectable without the console application.
- VH Trace: Cross-cutting (PFD §8 — must not hide the process; transparency requirement)

**NFR-2:** The system SHALL be deployable as a local application via Docker with no external service dependencies beyond the configured LLM provider.
- VH Trace: Cross-cutting (PFD §8 constraint)

**NFR-3:** The system SHALL read kit structures dynamically from the configured kit directories rather than hardcoding artifact types, so that changes to kits do not require console code changes.
- VH Trace: HYP-1 (AR ASM-3 mitigation — kit structure stability)

**NFR-4:** The system SHALL implement state access through a service layer abstraction, enabling future replacement of file-based storage with database-backed storage without rewriting business logic.
- VH Trace: Cross-cutting (future multi-user extensibility)

**NFR-5:** The system SHALL support configuration of at least one LLM provider at initial release, with the architecture supporting additional providers without structural changes.
- VH Trace: HYP-1 (AR ASM-4 — build for one, architect for many)

**NFR-6:** The system SHALL render generated artifacts as readable, formatted content in the browser — not as raw markdown source.
- VH Trace: HYP-2 (non-technical user experience)

---

## 7. Constraints (Hard Guardrails)

- **C-1:** The console must not hide the underlying AIEOS process. Users must be able to see which files are being used, which step they are on, and what governance rules apply. — Source: PFD §8
- **C-2:** The console must not automatically complete steps without user awareness and approval. Users approve at freeze points, review generated artifacts, and make decisions. — Source: PFD §8
- **C-3:** The console must consume existing kit file structures as-is. Kits do not adapt to the console; the console adapts to kits. — Source: PFD §8
- **C-4:** The system must be architecturally prepared for multi-provider LLM support even though initial release targets a single provider. — Source: AR ASM-4, EL EXP-3 (build for one, architect for many)
- **C-5:** The system must be architecturally prepared for multi-user operation even though initial release is single-user. State access through a service layer. — Source: AR ASM-7, PFD §8

---

## 8. Assumptions

| ID | Assumption | Validation Status | Impact if False | AR Source | EL Source |
|----|-----------|------------------|----------------|-----------|-----------|
| A-1 | The manual process is the primary adoption barrier for external teams | Partially Confirmed | If other barriers dominate, the console has standalone value for existing users but adoption impact may be smaller than expected | ASM-1 | EXP-1 |
| A-2 | Non-technical users (PMs) want self-service AIEOS access | Partially Confirmed | If PMs prefer mediated access, UG-2 features have lower priority but do not invalidate the console for UG-1 | ASM-2 | EXP-2 |
| A-3 | The four-file system structure is stable enough for tooling | Untested | If kit structure changes significantly, the console needs updating; mitigated by NFR-3 (dynamic kit reading) | ASM-3 | — |
| A-4 | AIEOS prompts produce adequate output across LLM providers | Partially Confirmed | If cross-provider quality varies significantly, prompt tuning per provider may be needed; mitigated by NFR-5 (single provider initially, multi-provider architecture) | ASM-4 | EXP-3 |
| A-5 | A guided interface is the right interaction model | Partially Confirmed | If users prefer alternatives (chat, IDE plugin), the interaction model may need to evolve; acceptable risk for initial release | ASM-5 | EXP-5 |
| A-6 | Validators provide sufficient quality signal | Partially Confirmed | If validators are too lenient or strict, the integrated validation loop provides false confidence or unnecessary friction | ASM-6 | EXP-4 |
| A-7 | Single-user operation is sufficient for initial adoption | Untested | If teams require collaboration from day one, single-user is insufficient; mitigated by NFR-4 (service layer abstraction) | ASM-7 | — |

---

## 9. Out of Scope by Default

Anything not explicitly listed in §3 (Goals) and §6 (Requirements) is out of scope by default. This is not a list of exclusions — it is the default rule. Specific exclusions are listed in §4 (Non-Goals).

Notable items that are out of scope despite potential expectation:
- Real-time collaboration or multi-user editing
- Integration with project management tools (Jira, Linear, etc.)
- Custom prompt editing or prompt engineering within the console
- Automated CI/CD integration or Git operations
- Mobile interface

---

## 10. Open Questions

All questions resolved. Open questions from upstream artifacts (PFD OQ-1, OQ-2, OQ-3; VH OQ-1, OQ-2; EL OQ-1, OQ-2) have been resolved through the discovery process or incorporated into requirements and constraints.

---

## 11. Acceptance / Success Criteria

| ID | Criterion | Measurement Method | VH Metric Trace |
|----|----------|-------------------|-----------------|
| AC-1 | Process navigation consumes less than 20% of total artifact generation time for UG-1 users | User self-report or observation during artifact generation sessions; compare against manual baseline | SM-1 |
| AC-2 | ≥ 50% of non-technical test users complete a PIK discovery flow (intake through PFD review) without assistance within 60 minutes of first use | Observed task completion during usability testing with product manager participants | SM-2 |
| AC-3 | Average number of generation-validation-rework cycles per artifact ≤ 2 | Count of validation runs per artifact as recorded by the console | SM-3 |
| AC-4 | ≥ 60% of evaluators can accurately describe the AIEOS artifact flow after one guided session of ≤ 90 minutes | Post-session structured interview or questionnaire | SM-4 |

---

## 12. Freeze Declaration

| Field | Value |
|-------|-------|
| Frozen | Yes |
| Freeze Date | 2026-03-07 |
| Approved By | Initiative Owner |

This Discovery PRD has been validated, reviewed, and approved. It is now the authoritative requirements document for the aieos-console initiative and the handoff artifact to the Engineering Execution Kit. It will be placed as docs/sdlc/01-prd.md in the consuming project for EEK acceptance.
