# K8 Operations Control

Standalone internal operator console for transaction support and mediation.

## Purpose

Provides:
- operator login
- transaction lookup by correlation ID
- current state and counters
- cross-plane gate/evidence timeline
- blocker/recovery visibility
- governed support intervention creation

The browser never receives the K8 Platform API key. The server proxies requests to the Platform Operations Control endpoints.

## Required environment

- `K8_PLATFORM_URL` — K8 Platform staging/production base URL
- `K8_API_KEY` — server-side Platform API key
- `K8_OPERATIONS_PASSWORD` — temporary staging operator password
- `NODE_ENV=production`

The password/session mechanism is intentionally a staging operator gate, not the final identity architecture. Replace with organisational RBAC/SSO before broad production use.
