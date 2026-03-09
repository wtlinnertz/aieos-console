# Discovery Intake Form

## Document Control

- **Date:** 2026-03-07
- **Author:** Initiative Owner
- **Initiative Name:** aieos-console
- **Governance Model Version:** 1.0
- **Prompt Version:** N/A

---

## Problem Context

### What is the problem?
AIEOS defines structured processes across 6 kits with 33+ artifact types, each governed by specs, templates, prompts, and validators. Currently, using AIEOS requires a user to manually navigate between markdown files, understand artifact dependencies, know which prompt to run next, set up AI sessions correctly, and track which artifacts are drafted vs. frozen. This creates a high barrier to entry — users must internalize the playbook before they can be productive.

### Who experiences this problem?
- **Engineers and architects** — must context-switch between kit docs, manually sequence artifacts, and track state across sessions. They can do it but it's slow and error-prone.
- **Non-technical users (product managers, stakeholders)** — need to participate in discovery and review but cannot navigate the kit file structure or run AI sessions independently. They are effectively locked out of self-service usage.

### Why does this matter now?
- AIEOS has reached structural maturity (6 kits built, governance model stable) but has no adoption interface beyond reading markdown files
- Without a guided interface, adoption depends on someone who already knows the system — this limits scaling
- The initiative owner's observation is that this type of guided governance execution tooling is missing in the market
- The framework is being tested now (this initiative is itself a test) — building the console validates the framework while producing the tool that makes it accessible

### What evidence do we have?
- Direct observation: using AIEOS currently requires reading multiple files per artifact type (spec, template, prompt, validator, playbook), understanding cross-references, and manually tracking state — this is the lived experience of operating the framework
- An early end-to-end test of the Engineering Execution Kit was completed to build a simple CLI, confirming the artifact flow works but the manual process is labor-intensive
- This initiative itself is evidence — the decision to build a console was driven specifically by the difficulty of broader adoption without one
- Confidence level: High for the usability problem (direct experience); Medium for the market gap claim (personal observation, not validated research)

---

## Users and Stakeholders

### Primary users
- **Engineers and architects** — use AIEOS to move from product intent to execution-ready work. Currently navigate kit files manually, run AI sessions, and track artifact state by hand. Need guided sequencing, automated state tracking, and integrated LLM generation.
- **Product managers** — participate in discovery (intake forms, problem framing, value hypotheses) and review/approve artifacts at freeze points. Currently cannot self-serve because the process requires navigating markdown file structures and understanding artifact dependencies.

### Secondary users
- **Team/org leaders evaluating AIEOS adoption** — need to see the process in action before committing. The console serves as a demonstration surface that makes AIEOS tangible without requiring deep framework knowledge.

### Sponsor
- Initiative owner

---

## Opportunity

### How big is this opportunity?
- AIEOS provides structured governance for AI-native software teams, but without an execution interface it requires framework expertise to operate. A guided console removes that barrier, making AIEOS accessible to teams who would otherwise not adopt it.
- The market observation is that no comparable guided governance execution tool exists — structured artifact generation with validation gates, cross-layer traceability, and configurable LLM integration in a single interface.
- If the console makes AIEOS usable by teams without framework expertise, it transforms AIEOS from a documentation system into an operational platform.

### What is uncertain about this estimate?
- Whether the market gap is real or whether teams solve this differently (custom scripts, existing workflow tools, or simply not governing AI-assisted work)
- Whether a guided wizard UX is the right interaction model vs. other approaches (chat-based, IDE plugins, CLI-only)

### Strategic alignment
- Directly enables AIEOS adoption beyond its creator — the console is the primary path to making the framework usable by others

---

## Current State

### How is the problem handled today?
- Users read kit playbooks, manually open spec/template/prompt/validator files, copy prompts into AI sessions, and track artifact state mentally or in notes
- No automation exists for sequencing, state tracking, or validation orchestration
- The process works but requires significant AIEOS knowledge upfront

### What has been tried before?
- An early test of the Engineering Execution Kit was completed to build a simple CLI — this validated that the artifact flow works but confirmed the manual process is labor-intensive
- No guided interface has been attempted

### Existing system context
- AIEOS kits exist as markdown file repositories with well-defined structure (specs, templates, prompts, validators)
- The four-file system and playbook sequences are already machine-readable patterns that a console could consume
- No API or programmatic interface currently exists

---

## Scope and Boundaries

### What is in scope?
- A guided interface for running AIEOS processes starting at Layer 2 (PIK) through the full happy path
- Artifact generation with integrated LLM calls
- Validator execution with PASS/FAIL results surfaced to the user
- Artifact state tracking (draft/frozen) with freeze-before-promote enforcement
- Configurable LLM selection (per artifact type and at runtime)
- Usable by both technical users (comfortable with terminals) and non-technical users (browser only)
- Project configuration (kit paths, LLM settings, project directory location)
- Engagement Record creation and updates as artifacts freeze

### What is explicitly out of scope?
- Kit authoring or modification (building/editing specs, templates, prompts, validators) — future extension after the running experience is solid
- Multi-user concurrent access — single-user to start
- Authentication and authorization — internal tool on trusted network initially
- Non-happy-path flows (re-entry, escalation, cross-initiative conflict) — start with nominal forward flow

### Known constraints
- Must not hide the underlying AIEOS process — the interface guides and automates but the user must see what's happening and why
- Must not "magically complete" steps — the user approves at freeze points, reviews generated artifacts, and makes decisions
- LLM cost should be trackable — even if cost optimization is not an immediate priority, other teams/orgs will care about this as an adoption factor
- Must consume existing kit file structures as-is — the console adapts to kits, not the other way around

---

## Assumptions and Risks

### What are we assuming to be true?
- The existing four-file system (spec, template, prompt, validator) is stable enough to build tooling against — kit structure won't change fundamentally
- A guided interface is the right interaction model for users who are not AIEOS experts
- LLM-generated artifacts from prompts will be good enough to pass validators without excessive rework cycles
- Single-user operation is sufficient for initial adoption

### What could go wrong?
- Kit structure may need changes that break the console's assumptions about file layout and naming
- The chosen interaction model may be too rigid for experienced users who want to jump around the process
- LLM output quality may vary significantly across providers, making "configurable per artifact type" more complex than expected (prompt tuning per provider)
- Scope creep into kit authoring features before the running experience is solid

---

## Additional Context

### Reference documents
- AIEOS Governance Model (aieos-governance-foundation/governance-model.md)
- Kit Structure Standard (aieos-governance-foundation/docs/kit-structure-standard.md)
- Initiative Presets (aieos-governance-foundation/docs/initiative-presets.md)

### Related initiatives
- This is the first AIEOS initiative being run through the full AIEOS process — it serves as both a product build and a framework validation exercise

---

## Completeness Checklist

- [x] Problem is clearly described in concrete terms
- [x] At least one affected user group is identified
- [x] "Why now" rationale is provided
- [x] Some evidence basis exists (even if limited)
- [x] Scope boundaries are stated (in scope and out of scope)
- [x] Known constraints are listed
