# Client Zero Reference Workflow — Daily Intelligence Briefing

Status: Runtime commissioned in staging; first Client Zero transition in implementation.

## Why this workflow

It already has mature operating rules and therefore tests the foundations without inventing a synthetic demo:
- Mon–Fri delivery
- 06:00 owner briefing
- Monday weekend catch-up
- deduplication
- defined Part 1 item count
- source/evidence expectations
- K8 Pulse blockers/dependencies
- backlog behaviour when the account is inactive
- owner-facing decision orientation

## Foundation mapping

1. Business Context supplies Kollabor8 goals, channels, topics, constraints and relevance rules.
2. Scan/Intelligence source workers gather and normalise evidence.
3. Workforce assigns research, synthesis, governance and orchestration responsibility.
4. Skill Registry supplies source-collection, dedupe, relevance-ranking and briefing-assembly skills.
5. Pulse creates and correlates the scheduled run and any failure/retry events.
6. Delivery OS tracks the run as a work item when intervention is required.
7. Atlas records source evidence, decisions, run state, delivery and failures.
8. Pulse UI remains out of scope for this workflow; it is reserved for human operational surfaces such as shop/customer/courier coordination.

## Event sequence

```
briefing.schedule.due
→ briefing.run.created
→ briefing.sources.requested
→ briefing.sources.collected
→ briefing.sources.deduplicated
→ briefing.intelligence.prepared
→ briefing.governance.checked
→ briefing.owner.delivered
→ briefing.run.completed
```

Failure examples:
```
source unavailable → bounded retry → degraded evidence
account inactive → BLOCKED + backlog state
delivery failure → notification retry without duplicating research run
policy uncertainty → SAFE_STOP
```

## Commissioning gate

The runtime is not commissioned until tests prove:
- idempotency
- no duplicate delivery
- Monday catch-up correctness
- backlog correctness
- evidence traceability
- bounded retries
- safe-stop
- replay safety
