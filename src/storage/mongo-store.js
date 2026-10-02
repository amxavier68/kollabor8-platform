import { MongoClient } from "mongodb";

export class MongoStore {
  constructor(uri, dbName = "k8_platform") {
    this.kind = "mongo";
    this.client = new MongoClient(uri);
    this.dbName = dbName;
  }

  async init() {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.events = this.db.collection("events");
    this.evidence = this.db.collection("evidence");
    this.workItems = this.db.collection("work_items");
    this.approvals = this.db.collection("approvals");

    await Promise.all([
      this.events.createIndex({ event_id: 1 }, { unique: true }),
      this.events.createIndex({ organisation_id: 1, idempotency_key: 1 }, { unique: true }),
      this.events.createIndex({ correlation_id: 1, received_at: -1 }),
      this.evidence.createIndex({ evidence_id: 1 }, { unique: true }),
      this.evidence.createIndex({ event_id: 1, created_at: 1 }),
      this.evidence.createIndex({ correlation_id: 1, created_at: 1 }),
      this.workItems.createIndex({ work_item_id: 1 }, { unique: true }),
      this.workItems.createIndex({ organisation_id: 1, state: 1, created_at: -1 }),
      this.approvals.createIndex({ approval_id: 1 }, { unique: true }),
      this.approvals.createIndex({ correlation_id: 1, created_at: 1 })
    ]);
  }

  async findEventByIdempotency(organisationId, key) {
    return this.events.findOne({ organisation_id: organisationId, idempotency_key: key }, { projection: { _id: 0 } });
  }

  async insertEvent(event) {
    await this.events.insertOne({ ...event });
    return event;
  }

  async getEvent(eventId) {
    return this.events.findOne({ event_id: eventId }, { projection: { _id: 0 } });
  }

  async updateEvent(eventId, patch) {
    const updated_at = new Date().toISOString();
    await this.events.updateOne({ event_id: eventId }, { $set: { ...patch, updated_at } });
    return this.getEvent(eventId);
  }

  async appendEvidence(record) {
    await this.evidence.insertOne({ ...record });
    return record;
  }

  async getEvidence(evidenceId) {
    return this.evidence.findOne({ evidence_id: evidenceId }, { projection: { _id: 0 } });
  }

  async findEvidence({ eventId, correlationId, limit = 50 } = {}) {
    const query = {};
    if (eventId) query.event_id = eventId;
    if (correlationId) query.correlation_id = correlationId;
    return this.evidence
      .find(query, { projection: { _id: 0 } })
      .sort({ created_at: 1 })
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 100))
      .toArray();
  }

  async insertWorkItem(record) {
    await this.workItems.insertOne({ ...record });
    return record;
  }

  async findEventsByCorrelation(correlationId, limit = 100) {
    return this.events
      .find({ correlation_id: correlationId }, { projection: { _id: 0 } })
      .sort({ received_at: 1 })
      .limit(Math.min(Math.max(Number(limit) || 100, 1), 200))
      .toArray();
  }

  async findWorkItemsByCorrelation(correlationId, limit = 100) {
    return this.workItems
      .find({ correlation_id: correlationId }, { projection: { _id: 0 } })
      .sort({ created_at: 1 })
      .limit(Math.min(Math.max(Number(limit) || 100, 1), 200))
      .toArray();
  }

  async findApprovalsByCorrelation(correlationId, limit = 100) {
    return this.approvals
      .find({ correlation_id: correlationId }, { projection: { _id: 0 } })
      .sort({ created_at: 1 })
      .limit(Math.min(Math.max(Number(limit) || 100, 1), 200))
      .toArray();
  }

  async insertApproval(record) {
    await this.approvals.insertOne({ ...record });
    return record;
  }
}
