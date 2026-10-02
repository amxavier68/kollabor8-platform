# Atlas Evidence Ledger v1.0

Status: Foundation candidate

## Purpose

Atlas is the evidence/provenance authority. The Evidence Ledger is append-first and records the chain from request through policy, approval, execution, validation, failure and recovery.

## Core record

Every evidence record must support:
- evidence_id
- organisation_id
- correlation_id
- causation_id
- event_id
- work_item_id
- run_id
- actor
- seat_id
- agent_id
- skill_id
- tool_id
- policy_decision_id
- approval_id
- action
- input_refs
- output_refs
- result
- validation
- failure
- recovery
- timestamps
- environment
- sensitivity
- retention_class
- integrity

## Evidence principles

1. Append-first: correction creates a new record referencing the prior record.
2. No secrets or raw credentials in evidence.
3. Evidence may reference source artefacts instead of duplicating sensitive payloads.
4. Production mutations require before/after or equivalent validation evidence.
5. Evidence must distinguish observed fact, model analysis and human decision.
6. Completion is not valid until required evidence obligations are satisfied.
7. Failed and safe-stopped runs are retained as evidence, not erased.

## Result classes

- observed
- recommended
- approved
- executed
- validated
- rejected
- blocked
- safe_stopped
- failed_recoverable
- failed_manual
- rolled_back
- completed

## Integrity

Initial implementation:
- immutable application-level insert semantics
- created_at server timestamp
- content_hash over canonicalised non-secret record
- previous_evidence_id where chaining applies

Future hardening may add external anchoring or WORM storage when justified by client/regulatory need.

## Query patterns

Atlas must support:
- show every action for a correlation_id
- show all production writes by actor/tool
- show evidence closing a work item
- show all failed/replayed events
- show approval chain for a production mutation
- reconstruct the Daily Intelligence Briefing run
