# Release Context File

Organizational release policy that governs all releases within its stated scope. Defines deployment standards, exposure standards, authorization model, communication requirements, and monitoring requirements.

The RCF is reusable across multiple release engagements. It is not regenerated per release.

---

## 1. Document Control

| Field | Value |
|-------|-------|
| RCF ID | RCF-AIEOS-001 |
| Owner | AIEOS Framework Team |
| Version | 1.0 |
| Date | 2026-03-08 |
| Status | Frozen |
| Applicability Scope | All AIEOS tooling applications deployed as local Docker containers for single-user operation. Covers aieos-console and any future AIEOS local tools. Does not cover shared infrastructure, cloud-hosted services, or multi-user platforms. |
| Governance Model Version | 1.0 |
| Prompt Version | 1.0 |

---

## 2. Deployment Standards

### System Risk Tiers

| Tier | Name | Criteria |
|------|------|----------|
| 1 | User-Facing with External Integration | Application has user-facing UI AND integrates with external APIs (e.g., LLM providers) that incur cost or transmit user content. Failures may result in data loss, unintended API charges, or corrupted project state. |
| 2 | User-Facing Local Only | Application has user-facing UI but does not integrate with external APIs. Failures affect only the local user's workflow; no external side effects. |

### Permitted Strategies by Tier

| Tier | Permitted Strategies | Notes |
|------|---------------------|-------|
| 1 | direct-full | Single-user local deployment; no traffic splitting infrastructure exists. Canary, blue-green, and rolling are not applicable — there is one container serving one user. Risk is mitigated through pre-deployment verification and rollback procedure, not progressive traffic exposure. |
| 2 | direct-full | Same rationale as Tier 1. |

**Strategies not permitted:** Canary, blue-green, and rolling are not prohibited on policy grounds — they are not applicable to single-user local Docker deployments where no load balancer, traffic router, or multiple instances exist.

### Verification Requirements

**Direct-full deployment verification:**
1. Docker image must build successfully (`docker build` exit 0)
2. Container must start and pass health check (`/api/health` returns HTTP 200)
3. Application must accept and process at least one functional request (e.g., project initialization)
4. State persistence must survive container restart (stop → start → verify state loads)
5. Docker logs must confirm application startup without errors
6. All verification steps must be automated in a verification script and produce observable output

**Canary deployment verification:** Not applicable — strategy not used in scope.

**Blue-green deployment verification:** Not applicable — strategy not used in scope.

**Rolling deployment verification:** Not applicable — strategy not used in scope.

---

## 3. Exposure Standards

### Progressive Delivery Requirements

| Tier | Progressive Exposure Required? | Conditions |
|------|-------------------------------|-----------|
| 1 | No | Single-user local deployment — progressive exposure is not applicable. There is one user; exposure is binary (deployed or not deployed). Risk mitigation is through pre-deployment verification and rollback, not staged exposure. |
| 2 | No | Same rationale as Tier 1. |

### Rollout Constraints

- **Maximum exposure increment per stage:** 100 percentage points — single-user deployment; exposure is binary (0% or 100%)
- **Minimum observation period between stages:** Not applicable — no staged rollout. The release owner must observe the application for a minimum of 1 hour after deployment before declaring the release successful.
- **Direct-full exposure permitted for Tier 1:** Yes — single-user local deployment makes progressive exposure technically impossible. Direct-full is the only applicable strategy. Risk is mitigated through the verification script and rollback procedure.

### Feature Flag Governance

- **Flag lifecycle stages:** inactive → active → removed. Percentage rollout and segment targeting stages are not applicable (single user).
- **Cleanup date requirement:** Flags must be removed within 30 days of reaching full exposure.
- **Maximum simultaneous active flags per system:** 3 — to prevent interaction effects even in single-user tools.
- **Flag naming convention:** `{FEATURE}_{BEHAVIOR}` in all caps with underscores (e.g., `STREAMING_ENABLED`, `MULTI_KIT_SUPPORT`).

---

## 4. Release Authorization Model

### Authorization Levels

| Level | Role / Title | Authorized Up To | Escalation Required Above |
|-------|-------------|-----------------|--------------------------|
| 1 | Contributor | Tier 2 systems only, 100% exposure | Any Tier 1 system release |
| 2 | Initiative Owner | Tier 1 and Tier 2 systems, 100% exposure | — (highest level for local tools) |

### Escalation Triggers

The following conditions require escalating to the next authorization level:
- Any release of a Tier 1 system (external API integration) must be authorized by an Initiative Owner (Level 2)
- Any release that changes external API integration behavior (provider, model, request format)
- Any release that changes filesystem write patterns or path validation logic
- Any rollback event during a release requires Initiative Owner review before re-release

### Emergency Release Procedure

For releases that cannot follow normal planning steps (e.g., critical security patch):

1. A named release owner must be identified (emergency does not waive accountability)
2. The rollback procedure must be confirmed functional before the emergency deployment begins
3. The emergency release must be deployed using the standard verification script (`scripts/verify-docker.sh` or equivalent)
4. A Release Record must be completed within 48 hours of the emergency release documenting what was released, why the emergency path was taken, and what verification was performed

_Emergency releases require a named release owner and a documented rollback procedure. Emergency authorization does not waive accountability._

### Cross-Boundary Releases

For releases that affect multiple AIEOS tools or shared components (e.g., changes to governance-model.md that affect both aieos-console and a future tool): both affected tool owners must authorize the release independently. Each tool produces its own Release Plan and Release Record. Shared component changes must be released to all affected tools within 7 days or documented as a tracked exception.

---

## 5. Communication Requirements

### Internal Stakeholder Notifications

| Audience | Notification Stage | Content | Channel |
|----------|-------------------|---------|---------|
| AIEOS Framework Team | Before release begins | Release scope, release type, expected timeline, known risks | Project communication channel (e.g., chat, email) |
| AIEOS Framework Team | At release completion | Release outcome (success/rollback), final state, any post-release observations | Project communication channel |

### Customer-Facing Communication Triggers

Customer notification is required when the release involves any of the following:
- Breaking changes to kit flow definition format (affects existing project directories)
- Changes to state.json schema that require migration
- Changes to the Docker deployment model (new environment variables, changed volume mount requirements)
- Removal of previously supported features

_Note: For the current scope (single-user local tools), "customer" is the tool operator. Notification is via release notes in the project repository._

### Partner / API Consumer Notification

Not applicable: AIEOS local tools do not expose APIs consumed by external partners. The only external integration is outbound LLM API calls, where the AIEOS tool is the consumer, not the provider.

---

## 6. Monitoring Requirements

### Watch Period

- **Minimum watch period per exposure stage:** 1 hour — the release owner must observe the application for a minimum of 1 hour after deployment, exercising core workflows (project initialization, artifact generation, validation, freeze) before declaring the release successful.

### Required Metrics

The following metric categories must be monitored for every release (Release Plans must identify specific metrics within each category):

| Category | Description |
|----------|-------------|
| Error rate | Application error count during the watch period; LLM API call failure rate. Zero unexpected errors is the target for a successful release. |
| Latency | LLM API call duration (generation and validation). Measured via LLM usage records in state.json. Baseline established from first successful generation. |
| Functional completeness | Core workflow completion: project initialization, artifact generation, validation, and freeze must all complete successfully during the watch period. |
| State integrity | State persistence must be verified: state.json must survive container restart; artifact files must be readable and consistent with state metadata. |

### Alert Threshold Policy

- **Default policy:** Relative to baseline where a baseline exists; absolute thresholds where no baseline exists.
- **When no baseline exists:** For first-time releases, use absolute thresholds: zero application errors, health check responsive within 5 seconds, LLM API calls completing within 120 seconds.
- **Threshold tightening for Tier 1:** Tier 1 releases must verify LLM API integration specifically: at least one successful generation and one successful validation must complete during the watch period.

### SLO Baseline Documentation

- **When to capture:** At first successful release. The watch period metrics from the first release establish the baseline.
- **How to store:** Documented in the Release Record (RR) §5 Monitoring Observations. Retained in the project's `docs/sdlc/` directory.
- **Retention:** Baseline must be retained for the lifetime of the application or until superseded by a new baseline documented in a subsequent Release Record.

---

## 7. Scope and Exceptions

### Scope

This RCF governs: All AIEOS tooling applications deployed as local Docker containers for single-user operation. Currently in scope: aieos-console. Future tools that match this deployment model (local Docker, single-user, no shared infrastructure) are also governed by this RCF.

Explicitly excluded:
- Cloud-hosted or multi-user deployments (if AIEOS tools are ever deployed to shared infrastructure, a separate RCF is required)
- The AIEOS governance framework itself (Markdown documentation kits) — these are not "released" in the software deployment sense
- Third-party LLM provider availability or behavior — outside the application's control

### Documented Exceptions

| Exception | Affected Standard | Justification | Expiry Condition |
|-----------|-----------------|---------------|-----------------|
| Progressive exposure not required for Tier 1 | §3 Exposure Standards | Single-user local Docker deployment makes progressive exposure technically impossible — one container, one user, no traffic splitting. Risk is mitigated through pre-deployment verification and rollback. | Expires if any AIEOS tool moves to multi-user or cloud deployment. |
| Only direct-full deployment strategy permitted | §2 Deployment Standards | No infrastructure exists for canary, blue-green, or rolling deployments in local Docker context. | Expires if deployment infrastructure supporting traffic splitting is introduced. |

---

## Freeze Declaration

| Field | Value |
|-------|-------|
| Frozen | Yes |
| Freeze Date | 2026-03-08 |
| Approved By | T. Owner |
| Notes | First RCF for AIEOS local tooling scope. Documented exceptions for single-user deployment model (no progressive exposure, direct-full only). |
