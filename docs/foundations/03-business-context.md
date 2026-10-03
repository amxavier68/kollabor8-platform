# K8 Business Context Specification v1.0

Status: Foundation candidate
Client Zero: Kollabor8 Web Collectives

## Purpose

Business Context is the canonical, versioned context object consumed by Scan, Intelligence, Workforce, Delivery and Pulse. Chat history may enrich context but is never the authoritative store.

## Required sections

- organisation
- brand
- products_services
- ideal_customers
- offers
- business_model
- goals
- current_constraints
- competitors
- technology
- people
- channels
- sales_process
- delivery_process
- marketing_process
- tone_voice
- legal_privacy_constraints
- authority_rules
- kpis
- known_claims
- evidence
- active_projects
- terminology

## Versioning

Every published context version requires:
- context_id
- organisation_id
- version
- status: draft | active | superseded
- valid_from
- created_at
- created_by
- source_refs
- change_reason

There is exactly one active version per organisation.

## Source confidence

Context values may carry:
- source_type: owner | client | contract | website | analytics | email | file | system | inferred
- source_ref
- confidence
- verified_at
- verified_by

Inferred facts cannot silently become verified facts.

## Kollabor8 Client Zero baseline

Kollabor8 positions websites, SEO, AI and automation as connected growth levers rather than isolated technical services. Authority building, evidence and governed execution are core principles. GitHub is canonical technical source; Render is production runtime; MongoDB Atlas is persistent business/runtime data.

This baseline must be expanded through controlled updates rather than copied from mutable chat history wholesale.
