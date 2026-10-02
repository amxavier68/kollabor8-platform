import { contentHash } from "../lib/hash.js";
import { id } from "../lib/ids.js";
import { validate } from "../validation.js";

const REPLAYABLE = new Set(["SAFE_STOP", "FAILED_RECOVERABLE", "DEAD_LETTER"]);

export class EventService {
  constructor(store, evidence, router = null) {
    this.store = store;
    this.evidence = evidence;
    this.router = router;
  }

  async ingest(event) {
    const validation = validate("event", event);
    if (!validation.ok) return { type: "invalid", errors: validation.errors };

    const requestHash = contentHash(event);
    const existing = await this.store.findEventByIdempotency(event.organisation_id, event.idempotency_key);
    if (existing) {
      if (existing.request_hash !== requestHash) return { type: "conflict", event: existing };
      return { type: "deduplicated", event: existing };
    }

    const stored = {
      ...event,
      state: "VALIDATED",
      request_hash: requestHash,
      attempts: 1,
      updated_at: event.received_at
    };

    await this.store.insertEvent(stored);
    await this.evidence.append({
      organisation_id: event.organisation_id,
      correlation_id: event.correlation_id,
      causation_id: event.causation_id,
      event_id: event.event_id,
      action: "pulse.event.ingested",
      result: "observed",
      actor: event.actor,
      validation: { schema: "pulse-event.schema.json", valid: true }
    });

    if (this.router) {
      const routed = await this.router.route(stored);
      return { type: "accepted", event: routed.event, work_item: routed.workItem };
    }

    return { type: "accepted", event: stored };
  }

  async get(eventId) {
    return this.store.getEvent(eventId);
  }

  async replay(eventId, actor = { type: "human", id: "owner" }) {
    const event = await this.store.getEvent(eventId);
    if (!event) return { type: "not_found" };
    if (!REPLAYABLE.has(event.state)) return { type: "unsafe", event };

    const replay = await this.store.updateEvent(eventId, {
      state: "RECEIVED",
      attempts: (event.attempts ?? 1) + 1,
      replay_of: event.replay_of ?? event.event_id,
      last_replay_id: id("replay")
    });

    await this.evidence.append({
      organisation_id: event.organisation_id,
      correlation_id: event.correlation_id,
      causation_id: event.event_id,
      event_id: event.event_id,
      action: "pulse.event.replay.requested",
      result: "approved",
      actor,
      recovery: { prior_state: event.state, attempt: replay.attempts }
    });

    return { type: "accepted", event: replay };
  }
}
