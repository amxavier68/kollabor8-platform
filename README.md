# kollabor8-platform

Canonical platform contracts and runtime architecture for the Kollabor8 Business OS.

## Six strengthened foundations

1. [K8 Business OS](docs/foundations/01-k8-business-os.md)
2. [K8 Workforce Contract](docs/foundations/02-workforce-contract.md)
3. [K8 Business Context](docs/foundations/03-business-context.md)
4. [K8 Skill Contract](docs/foundations/04-skill-contract.md)
5. [Atlas Evidence Ledger](docs/foundations/05-atlas-evidence-ledger.md)
6. [K8 Pulse Runtime](docs/foundations/06-pulse-runtime.md)

Reference implementation path:
- [Client Zero — Daily Intelligence Briefing](docs/foundations/07-client-zero-reference-workflow.md)
- [Foundation API contract](openapi/k8-foundation-api.yaml)
- Machine-readable contracts live under `schemas/`.

## Authority boundaries

GitHub is source truth for code/contracts.
Render is runtime truth.
MongoDB Atlas is persistent context/state/evidence truth.
ChatGPT is the primary reasoning, orchestration and owner-interaction layer, not the sole system of record.

No production runtime is commissioned merely by merging these contracts. Runtime deployment follows CI/CD, policy, canary and approval gates.
