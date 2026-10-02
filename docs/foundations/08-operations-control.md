# K8 Operations Control — Support & Mediation Layer v1.0

Status: Foundation implementation

## Purpose

K8 Operations Control is the human intervention layer above Pulse and Atlas. It gives authorised operations/support staff a correlated transaction view and a governed way to mediate exceptions without directly mutating the underlying business transaction.

It is designed for B2C support scenarios where staff must answer:
- what happened?
- which gates have passed?
- where is the transaction now?
- who or what is blocking progress?
- what evidence supports the current state?
- has there been a prior intervention?
- what action is permitted next?

## Architectural position

Pulse = operational control plane.
Atlas = evidence and provenance plane.
Operations Control = visibility and intervention plane.
Role UIs = shop/customer/courier interaction surfaces.

Operations Control reads across Pulse, Delivery OS, approvals and Atlas using the correlation_id as the transaction spine.

## Transaction view

The canonical transaction view combines:
- Pulse events
- Delivery OS work items
- approval decisions
- Atlas evidence
- current state
- actors
- timestamps
- failures/replays
- support interventions

Every object remains authoritative in its source collection. Operations Control is a correlated projection, not a replacement source of truth.

## Mediation rule

Support staff do not directly alter transaction state through Operations Control.

A support intervention creates a governed work item with:
- correlation_id
- reason
- requested action
- actor
- authority level
- evidence requirement

The underlying workflow then decides whether the requested intervention can proceed automatically or requires approval.

## Initial endpoints

- GET /api/v1/operations/transactions/:correlationId
- POST /api/v1/operations/transactions/:correlationId/interventions

## Initial support authority

A1 is the default for internal support mediation requests. Any intervention that changes an external commitment, payment, production state, privileged configuration or destructive state must be elevated by policy to A2/A3 before execution.

## Future UI

A later Operations Control UI should lead with a transaction timeline:
timestamp → gate/state → actor → acknowledgement → SLA → evidence → exception/intervention

It should support search by customer/order/correlation reference without exposing more personal data than the operator's role requires.
