export class MemoryStore {
  constructor() {
    this.kind = "memory";
    this.events = new Map();
    this.idempotency = new Map();
    this.evidence = new Map();
    this.workItems = new Map();
    this.approvals = new Map();
  }

  async init() {}

  idemKey(organisationId, key) {
    return `${organisationId}:${key}`;
  }

  async findEventByIdempotency(organisationId, key) {
    const eventId = this.idempotency.get(this.idemKey(organisationId, key));
    return eventId ? this.events.get(eventId) ?? null : null;
  }

  async insertEvent(event) {
    if (this.events.has(event.event_id)) throw new Error("EVENT_ID_CONFLICT");
    this.events.set(event.event_id, structuredClone(event));
    this.idempotency.set(this.idemKey(event.organisation_id, event.idempotency_key), event.event_id);
    return structuredClone(event);
  }

  async getEvent(eventId) {
    const event = this.events.get(eventId);
    return event ? structuredClone(event) : null;
  }

  async updateEvent(eventId, patch) {
    const current = this.events.get(eventId);
    if (!current) return null;
    const next = { ...current, ...structuredClone(patch), updated_at: new Date().toISOString() };
    this.events.set(eventId, next);
    return structuredClone(next);
  }

  async appendEvidence(record) {
    if (this.evidence.has(record.evidence_id)) throw new Error("EVIDENCE_IMMUTABLE_CONFLICT");
    this.evidence.set(record.evidence_id, structuredClone(record));
    return structuredClone(record);
  }

  async getEvidence(evidenceId) {
    const record = this.evidence.get(evidenceId);
    return record ? structuredClone(record) : null;
  }

  async findEvidence({ eventId, correlationId, limit = 50 } = {}) {
    const records = [...this.evidence.values()]
      .filter((record) => !eventId || record.event_id === eventId)
      .filter((record) => !correlationId || record.correlation_id === correlationId)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .slice(0, Math.min(Math.max(Number(limit) || 50, 1), 100));
    return structuredClone(records);
  }

  async insertWorkItem(record) {
    if (this.workItems.has(record.work_item_id)) throw new Error("WORK_ITEM_CONFLICT");
    this.workItems.set(record.work_item_id, structuredClone(record));
    return structuredClone(record);
  }

  async findEventsByCorrelation(correlationId, limit = 100) {
    const records = [...this.events.values()]
      .filter((record) => record.correlation_id === correlationId)
      .sort((a, b) => String(a.received_at).localeCompare(String(b.received_at)))
      .slice(0, Math.min(Math.max(Number(limit) || 100, 1), 200));
    return structuredClone(records);
  }

  async findWorkItemsByCorrelation(correlationId, limit = 100) {
    const records = [...this.workItems.values()]
      .filter((record) => record.correlation_id === correlationId)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .slice(0, Math.min(Math.max(Number(limit) || 100, 1), 200));
    return structuredClone(records);
  }

  async findApprovalsByCorrelation(correlationId, limit = 100) {
    const records = [...this.approvals.values()]
      .filter((record) => record.correlation_id === correlationId)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .slice(0, Math.min(Math.max(Number(limit) || 100, 1), 200));
    return structuredClone(records);
  }

  async insertApproval(record) {
    if (this.approvals.has(record.approval_id)) throw new Error("APPROVAL_CONFLICT");
    this.approvals.set(record.approval_id, structuredClone(record));
    return structuredClone(record);
  }
}
