# PTTM Commerce Workflow v1

## Commissioned ingress baseline

The live WooCommerce ingress baseline is frozen at commit:

`95f62f5b032b8492851bac12e88e3cbec6cd1b3b`

Recovery branch:

`backup/pttm-woocommerce-commissioned-2026-10-03`

That checkpoint includes the commissioned signed PTTM webhook ingress, activation handshake, idempotency correction, Operations Control client/customer mapping, Atlas evidence creation, and the passing Foundation runtime suite.

## Purpose

Commerce Workflow v1 adds the operational layer after authenticated WooCommerce ingestion. WooCommerce remains an observed business source; it does not directly control K8 operational state.

Each Woo order owns one deterministic K8 work item:

`work_commerce_<woocommerce-order-id>`

All later status observations and operational transitions update that same work item.

## Operational stages

1. ORDER_RECEIVED
2. ACKNOWLEDGED
3. PREPARING
4. READY_FOR_COURIER
5. COURIER_ASSIGNED
6. PICKED_UP
7. DELIVERED
8. COMPLETED

Exception/terminal branches:

- EXCEPTION
- CANCELLED
- REFUNDED

## Governance

- Normal forward transitions are A0 operational actions.
- EXCEPTION raises the work item to A1 and BLOCKED.
- Skipping an operational gate returns a conflict and leaves state unchanged.
- Every accepted transition creates immutable Atlas evidence.
- Repeated identical transitions are idempotent.
- WooCommerce terminal states can close/cancel/refund the work item.
- A non-terminal Woo status must not regress a manually advanced K8 workflow stage.

## API

Protected transition endpoint:

`POST /api/v1/commerce/transactions/:correlationId/transitions`

Example body:

```json
{
  "stage": "ACKNOWLEDGED",
  "actor": { "type": "human", "id": "operations-console" }
}
```

Future role UIs (shop, courier, customer) should call governed K8 APIs; they must not mutate Mongo records directly.

## Recovery

If Commerce Workflow v1 produces a commissioning failure, restore/deploy the baseline recovery branch/commit above. Do not remove or rewrite the backup branch during v1 commissioning.
