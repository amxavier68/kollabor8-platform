# K8 Pulse Runtime Contract v1.0

Status: Commissioned in staging; Client Zero routing in progress

## Purpose

K8 Pulse is Kollabor8's operational control plane. It accepts business/system events, governs state transitions, enforces idempotency, correlates and routes work, records acknowledgement, and supports bounded retry, dead-letter handling and safe replay.

The Pulse UI is a separate human-facing interaction layer. For commerce workflows it sits between shop, customer and courier, projecting trusted Pulse state without becoming the system of record.

## Canonical event envelope

Required:
- event_id
- event_name
- version
- organisation_id
- occurred_at
- received_at
- source
- actor
- subject
- correlation_id
- causation_id
- payload
- sensitivity
- retention_class
- idempotency_key

Optional:
- client_id
- project_id
- trace_id
- environment
- metadata

## Runtime states

- RECEIVED
- VALIDATED
- ROUTED
- AWAITING_APPROVAL
- RUNNING
- DEGRADED
- BLOCKED
- SAFE_STOP
- FAILED_RECOVERABLE
- FAILED_MANUAL
- COMPLETED
- DEAD_LETTER

## Minimum endpoints

- POST /api/v1/events
- GET /api/v1/events/:eventId
- POST /api/v1/events/:eventId/replay
- POST /api/v1/work-items
- POST /api/v1/approvals
- POST /api/v1/evidence

## Guarantees

1. Duplicate idempotency keys do not create duplicate side effects.
2. Correlation IDs survive retries and hand-offs.
3. Retries are bounded and policy-controlled.
4. Replay uses original evidence and creates a new run/attempt record.
5. External notification failure does not automatically fail the underlying business transaction.
6. Acknowledgement is explicit where the workflow requires it.
7. Dead-letter events are reviewable and recoverable.
8. Every production write emits or links evidence.

## Initial reference workflow

K8 Daily Intelligence Briefing:
schedule
→ source collection
→ source evidence
→ deduplication
→ intelligence synthesis
→ Renee orchestration
→ briefing delivery
→ acknowledgement/state
→ Atlas closure evidence

## Implementation shape

Start as a modular monolith plus separate workers on Render. Split services only for security, scaling, reliability or deployment-boundary reasons.
