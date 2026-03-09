# Work Classification Record

## Document Control

- **Record ID:** WCR-CONSOLE-001
- **Date:** 2026-03-07
- **Work Request:** Build a guided wizard application (aieos-console) that walks users through AIEOS kit processes, collecting inputs, calling LLMs to generate artifacts, running validators, and tracking artifact state across layers.

---

## Classification Decision

| Field | Value |
|-------|-------|
| Primary Type | Feature |
| Confidence | High |
| Discovery Depth | Full |
| Route To | Product Intelligence Kit |

---

## Justification

This is net-new capability — no existing AIEOS tooling provides a guided execution interface. It introduces a new application with its own tech stack (Next.js), UI patterns (step wizard), LLM integration, and state management. The scope is broad (covers all layers, multiple user types, configurable LLM routing) and the user experience needs are not yet validated. Full discovery is warranted because the problem space (how users interact with AIEOS processes) has not been formally structured, and assumptions about user workflow, artifact generation UX, and LLM configurability need to be tested before committing to an architecture.

---

## Artifact Requirements

| Artifact | Required | Rationale |
|----------|----------|-----------|
| PFD | Yes | Problem space needs structuring — multiple user types, unclear interaction model |
| VH | Yes | Value hypotheses around guided execution vs manual prompt usage need definition |
| AR | Yes | Assumptions about LLM integration, user workflow, and single-user constraints need cataloging |
| EL | Yes | Key assumptions (e.g., wizard UX improves artifact quality) should be validated before build |
| DPRD | Yes | Engineering-ready requirements needed before handoff to EEK |

---

## Risk Flags

- Under-classification risk: Could be tempting to classify as Enhancement (adding UI to an existing system), but AIEOS has no existing execution interface — this is genuinely new capability, not an enhancement to an existing tool.

---

## Freeze Declaration

- [x] Classification reviewed and confirmed by initiative owner
- **Frozen:** 2026-03-07
