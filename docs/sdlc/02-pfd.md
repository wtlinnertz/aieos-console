# Problem Framing Document

## 1. Document Control

| Field | Value |
|-------|-------|
| Artifact ID | PFD-CONSOLE-001 |
| Version | 1.0 |
| Date | 2026-03-07 |
| Author | AI-generated, human-reviewed |
| Status | Frozen |
| Governance Model Version | 1.0 |
| Prompt Version | 1.0 |

---

## 2. Problem Statement

Teams and organizations attempting to use AIEOS must manually navigate 6 kits containing 33+ artifact types, each governed by four files (spec, template, prompt, validator), while tracking artifact dependencies, sequencing, and freeze state across sessions. This creates a high barrier to entry that prevents non-expert users from operating the framework independently and makes even experienced users slow and error-prone. This problem requires attention now because the framework has reached structural maturity (6 kits, stable governance model) but has no adoption interface — scaling beyond the framework's creator depends on making the process accessible without requiring users to internalize the full kit file structure and playbook sequences first.

---

## 3. User Landscape

### Primary Users

**UG-1: Engineers and Architects**
- **Who they are:** Technical practitioners who use AIEOS to move from product intent through to execution-ready work
- **What they do:** Generate artifacts (PRDs, architecture contexts, design documents, work decompositions), run validators, track artifact state, and follow kit playbooks across multiple layers
- **How the problem affects them:** Must context-switch between kit documentation files, manually identify the next artifact in the sequence, locate and read the correct spec/template/prompt/validator files, set up AI sessions with the right inputs, and track which artifacts are in draft vs. frozen state. The process works but is slow, requires significant framework knowledge, and is prone to sequencing errors or missed validation steps.

**UG-2: Product Managers**
- **Who they are:** Non-technical users who participate in product discovery and review/approve artifacts at freeze points
- **What they do:** Fill intake forms, review problem framing and value hypotheses, approve artifacts for freeze, and provide domain context during generation
- **How the problem affects them:** Cannot self-serve because operating the framework requires navigating markdown file structures, understanding four-file system relationships, and running AI sessions with correct prompt inputs. They are effectively locked out of independent usage and must rely on someone with framework expertise to drive the process.

### Secondary Users

**UG-3: Team and Organization Leaders Evaluating AIEOS Adoption**
- **Who they are:** Decision-makers considering AIEOS for their teams or organizations
- **What they do:** Evaluate whether the framework fits their needs, assess adoption cost, and decide whether to commit
- **How the problem affects them:** Cannot see the process in action without deep framework knowledge. Evaluating AIEOS currently requires reading extensive documentation and mentally simulating the artifact flow, which is a high barrier to an adoption decision.

---

## 4. Pain Points and Impact

**PP-1: High Knowledge Prerequisite**
- **Problem behavior:** Before a user can produce their first artifact, they must read and understand the playbook, the relevant spec, template, prompt, and validator files, plus the governance model rules for sequencing and freeze semantics. There is no guided entry point.
- **Frequency:** Every new user encounters this on first use. Returning users must re-familiarize with the file structure and process flow for artifact types they haven't used recently.
- **Impact:** Adoption is limited to users who are willing to invest significant time learning the framework before getting any value from it. Non-technical users cannot participate without a guide.
- **Evidence basis:** Known (direct observation from operating the framework and from completing an early end-to-end test of the Engineering Execution Kit)

**PP-2: Manual Artifact Sequencing**
- **Problem behavior:** Users must manually determine which artifact comes next, verify that upstream artifacts are frozen, locate the correct prompt and input files, and assemble the right context for each AI session. The playbook documents the sequence, but the user must execute it step by step with no automation.
- **Frequency:** Every artifact generation step across every initiative
- **Impact:** Risk of generating artifacts out of order, using unfrozen upstream inputs, or skipping validation steps. Errors are caught only if the user remembers to run the validator.
- **Evidence basis:** Known (direct experience producing artifacts through the early CLI test)

**PP-3: No State Tracking**
- **Problem behavior:** There is no mechanism to track which artifacts exist for an initiative, what their current status is (draft, validated, frozen), or which step in the flow the user is on. Users track this mentally or in separate notes.
- **Frequency:** Ongoing across every initiative session
- **Impact:** Risk of losing track of progress, particularly across sessions or when multiple people are involved. No way to resume a partially completed flow without reconstructing state from the artifact files.
- **Evidence basis:** Known (direct observation — the framework produces files but does not track their lifecycle state)

**PP-4: Non-Technical User Exclusion**
- **Problem behavior:** Product managers and other non-technical stakeholders cannot operate the framework independently. The process requires navigating file directories, reading markdown specs, and setting up AI sessions with specific file inputs.
- **Frequency:** Every interaction where a non-technical user needs to participate
- **Impact:** Non-technical users are dependent on a technical guide, which creates bottlenecks and limits when and how they can contribute. This narrows the potential user base and slows the discovery process.
- **Evidence basis:** Believed (based on the nature of the current interface — markdown files in a repository — and the typical technical comfort level of product managers)

---

## 5. Opportunity Sizing

Addressing the usability barrier transforms AIEOS from a documentation framework that requires expert operation into an accessible platform that teams can adopt independently. The opportunity has two dimensions:

**Internal adoption:** Enables the framework creator and early users to operate AIEOS more efficiently, reducing time spent on file navigation, sequencing, and state tracking. Based on direct experience, the manual overhead adds significant friction to every artifact generation cycle.

**External adoption:** Removes the primary barrier to adoption by other teams and organizations. Without a guided interface, every potential adopter must invest in learning the framework's file structure and process rules before getting value. A guided interface makes AIEOS evaluable and usable without that upfront investment.

**Basis:** Internal assessment based on direct framework operation experience. The market gap observation (no comparable guided governance execution tooling exists) is based on personal observation, not validated market research.

**Uncertainty acknowledgment:** Whether the market gap is real — teams may solve governance differently or may not govern AI-assisted work at all. Whether the usability barrier is the primary adoption blocker or whether other factors (framework maturity, trust, organizational fit) dominate.

---

## 6. Strategic Alignment

> **Advisory section** — Required by template structure; evaluated qualitatively. No hard gate applies.

Enabling AIEOS adoption beyond its creator is a prerequisite for the framework to have impact. The console is the primary path to making the framework usable by others, which aligns with the goal of establishing AIEOS as an operational platform for AI-native software teams.

**Strategic objectives supported:**
- Make AIEOS accessible to teams without framework expertise
- Validate the AIEOS process by using it to build the console itself (framework self-test)

---

## 7. Current State

### How the Problem Is Currently Handled

- Users read kit playbooks to understand the artifact sequence for each layer
- For each artifact, users manually locate and open the spec, template, prompt, and validator files
- Users copy prompt content into AI sessions, providing the required input files as context
- Artifact state (draft/frozen) is tracked mentally or in separate notes
- The process works end-to-end but requires significant AIEOS knowledge and manual effort at every step

### What Has Been Tried Before

- An early end-to-end test of the Engineering Execution Kit was completed to build a simple CLI. This confirmed that the artifact flow works but also confirmed that the manual process is labor-intensive and requires deep familiarity with the kit file structure.
- No guided interface has been attempted.

### Existing System Context

- AIEOS kits exist as markdown file repositories with well-defined, consistent structure across all 6 kits
- The four-file system (spec, template, prompt, validator) and playbook sequences are standardized patterns that could be consumed programmatically
- No API, programmatic interface, or state management layer currently exists
- The governance model defines structural rules that are consistent across all kits, providing a stable foundation for tooling

---

## 8. Constraints and Boundaries

### Known Constraints
- Must not hide the underlying AIEOS process — the interface must make the process visible and understandable, not abstract it away
- Must not automatically complete steps without user awareness and approval — users approve at freeze points, review generated artifacts, and make decisions
- Must consume existing kit file structures as-is — the console adapts to kits, kits do not adapt to the console
- LLM cost should be trackable — cost is a known adoption factor for other teams and organizations, even if not an immediate constraint
- Single-user operation initially — concurrent multi-user access is not in scope for the initial problem framing

### Problem Space Boundaries
- Kit authoring and modification (building/editing specs, templates, prompts, validators) is excluded — this problem framing addresses running AIEOS processes, not extending the framework
- Non-happy-path flows (re-entry, escalation, cross-initiative conflict resolution) are excluded — the problem is scoped to the nominal forward flow through the layers
- Authentication, authorization, and multi-tenancy concerns are excluded from this problem framing

---

## 9. Open Questions

**OQ-1: What interaction model best serves mixed technical and non-technical users?**
- **Category:** Non-blocking (does not block problem framing; will be explored as an assumption in the AR and tested in the EL)
- **Owner / Resolution plan:** To be addressed during Value Hypothesis and Assumption Register stages

**OQ-2: How well do existing AIEOS prompts perform across different LLM providers?**
- **Category:** Non-blocking (the prompts were designed to be provider-agnostic, but output quality variance across providers has not been tested)
- **Owner / Resolution plan:** To be addressed as an assumption in the AR with validation in the EL

**OQ-3: Is the four-file system structure stable enough to build tooling against?**
- **Category:** Non-blocking (the governance model is at v1.0 and no changes are planned, but the framework is relatively new)
- **Owner / Resolution plan:** To be addressed as a dependency assumption in the AR; mitigated by designing the console to read kit structure dynamically rather than hardcoding artifact types

---

## 10. Freeze Declaration

| Field | Value |
|-------|-------|
| Frozen | Yes |
| Freeze Date | 2026-03-07 |
| Approved By | Initiative Owner |

This Problem Framing Document has been validated, reviewed, and approved. It is now the authoritative problem definition for the aieos-console initiative and the required input for Value Hypothesis generation.
