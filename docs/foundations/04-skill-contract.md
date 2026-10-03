# K8 Skill Contract v1.0

Status: Foundation candidate

## Purpose

A K8 Skill is a versioned, testable reusable procedure that converts business intent into a bounded piece of work. Skills are separate from Seats, Agents and Tools.

## Required fields

- skill_id
- name
- version
- owner_seat
- purpose
- status: draft | tested | commissioned | deprecated
- inputs
- preconditions
- permitted_tools
- policy_profile
- steps
- outputs
- evidence_required
- validation
- stop_conditions
- failure_handling
- last_tested_at
- test_suite_ref

## Execution rules

1. Skills never grant permissions; policies do.
2. Skills must declare side effects.
3. Write-capable skills must declare rollback or compensation where feasible.
4. Skills must declare evidence required for completion.
5. Skills must have deterministic stop conditions.
6. Skills cannot silently expand scope.
7. Commissioned skills are immutable by version; changes create a new version.
8. Deprecated skills cannot start new production runs.

## Example skill

```yaml
skill_id: search.analyse-ranking-drop
name: Analyse Ranking Drop
version: 1.0.0
owner_seat: search-intelligence
status: tested
inputs:
  - organisation_id
  - property_id
  - date_range
preconditions:
  - gsc.read available
permitted_tools:
  - gsc.read
  - atlas.evidence.write
side_effects: none
evidence_required:
  - baseline comparison
  - affected queries/pages
  - source timestamps
stop_conditions:
  - missing property access
  - insufficient date range
validation:
  - all claims trace to retrieved evidence
```

## Skill registry

The runtime registry stores commissioned metadata and current versions. GitHub remains canonical for skill definitions and tests.
