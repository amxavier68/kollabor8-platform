# K8 Workforce Contract v1.0

Status: Foundation candidate
Canonical role repository: amxavier68/k8-ai-workforce

## Purpose

WORKFORCE is not a collection of personalities. It is the governed runtime model that assigns responsibility, authority, executable skills, tools, policies and hand-offs.

## Canonical objects

### Seat
An accountable organisational responsibility that persists even if the model/runtime changes.

Required fields:
- seat_id
- name
- purpose
- accountable_owner
- responsibilities
- exclusions
- inbound_handoffs
- outbound_handoffs
- default_approval_level
- evidence_obligations

### Agent
A runtime implementation of some or all of a Seat's responsibilities.

Required fields:
- agent_id
- seat_id
- provider/runtime
- model/version where applicable
- status
- allowed_skills
- allowed_tools
- policy_profile
- commissioning_version

### Skill
A versioned, testable reusable procedure. Skills are implementation IP and must not be hidden only in conversations.

### Tool
A capability with explicit action-level grants, e.g. gmail.read and gmail.send are different tools.

### Policy
The rule set governing whether an actor may use a skill/tool for a tenant, resource, environment and risk class.

## Current governed functions

Existing accountable workforce definitions remain governed by the dedicated K8 AI Workforce repository. Platform integration must not silently rename or replace commissioned seats.

The platform recognises these functional domains:
- orchestration and release management
- governance and risk
- commercial viability
- search/discovery intelligence
- content/authority
- engineering
- functional validation
- human acceptance
- evidence/provenance

Where a domain is not yet represented by a commissioned Seat, it remains a capability domain until formally commissioned through the workforce lifecycle.

## Authority model

Approval levels:
- A0 AUTO: read-only or low-risk deterministic action
- A1 NOTIFY: permitted action with owner notification
- A2 APPROVAL: external communication, publication or production mutation
- A3 DUAL: high-risk, destructive, financial or privileged action

## Workforce lifecycle

change request
→ draft
→ static checks
→ role tests
→ cross-seat tests
→ Sentinel governance gate
→ Mira acceptance gate
→ canary
→ commission
→ observe
→ patch/rollback

## Hard rules

1. A Seat exists only for a unique responsibility/authority domain.
2. Agents are replaceable; Seats are durable.
3. Tool access is capability-level, not whole-account access.
4. Every mutation is attributable and evidence-backed.
5. Agents cannot expand their own permissions.
6. A3 actions cannot self-approve.
7. Runtime uncertainty escalates; it does not invent authority.
8. Safe-stop is a valid successful control outcome.
