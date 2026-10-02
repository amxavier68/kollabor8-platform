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

  async insertWorkItem(record) {
    if (this.workItems.has(record.work_item_id)) throw new Error("WORK_ITEM_CONFLICT");
    this.workItems.set(record.work_item_id, structuredClone(record));
    return structuredClone(record);
  }

  async insertApproval(record) {
    if (this.approvals.has(record.approval_id)) throw new Error("APPROVAL_CONFLICT");
    this.approvals.set(record.approval_id, structuredClone(record));
    return structuredClone(record);
  }
}
