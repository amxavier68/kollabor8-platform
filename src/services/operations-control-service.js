import { id } from "../lib/ids.js";

function stamp(record) {
  return record.received_at ?? record.created_at ?? record.updated_at ?? "";
}

export class OperationsControlService {
  constructor(store, evidence) {
    this.store = store;
    this.evidence = evidence;
  }

  async transaction(correlationId) {
    const [events, workItems, approvals, evidence] = await Promise.all([
      this.store.findEventsByCorrelation(correlationId),
      this.store.findWorkItemsByCorrelation(correlationId),
      this.store.findApprovalsByCorrelation(correlationId),
      this.store.findEvidence({ correlationId, limit: 100 })
    ]);

    const timeline = [
      ...events.map((record) => ({ type: "event", at: stamp(record), record })),
      ...workItems.map((record) => ({ type: "work_item", at: stamp(record), record })),
      ...approvals.map((record) => ({ type: "approval", at: stamp(record), record })),
      ...evidence.map((record) => ({ type: "evidence", at: stamp(record), record }))
    ].sort((a, b) => String(a.at).localeCompare(String(b.at)));

    const currentEvent = events.at(-1) ?? null;
    const openWorkItems = workItems.filter((item) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(item.state));

    return {
      correlation_id: correlationId,
      current_state: currentEvent?.state ?? null,
      current_event_id: currentEvent?.event_id ?? null,
      open_work_items: openWorkItems.length,
      counts: {
        events: events.length,
        work_items: workItems.length,
        approvals: approvals.length,
        evidence: evidence.length
      },
      events,
      work_items: workItems,
      approvals,
      evidence,
      timeline
    };
  }

  async intervene(correlationId, input = {}) {
    const transaction = await this.transaction(correlationId);
    if (transaction.counts.events === 0 && transaction.counts.work_items === 0) {
      return { type: "not_found" };
    }

    const reason = String(input.reason ?? "").trim();
    const requestedAction = String(input.requested_action ?? "").trim();
    const actor = input.actor;
    if (!reason || !requestedAction || !actor?.type || !actor?.id) {
      return { type: "invalid" };
    }

    const now = new Date().toISOString();
    const record = {
      work_item_id: id("support"),
      organisation_id: input.organisation_id ?? transaction.events[0]?.organisation_id ?? transaction.work_items[0]?.organisation_id,
      correlation_id: correlationId,
      title: input.title ?? `Support mediation — ${requestedAction}`,
      state: "OPEN",
      owner: actor,
      approval_level: input.approval_level ?? "A1",
      evidence_required: ["support-intervention-reason", "resolution-evidence"],
      dependencies: [],
      intervention: {
        reason,
        requested_action: requestedAction,
        customer_impact: input.customer_impact ?? null
      },
      created_at: now,
      updated_at: now
    };

    await this.store.insertWorkItem(record);
    await this.evidence.append({
      organisation_id: record.organisation_id,
      correlation_id: correlationId,
      work_item_id: record.work_item_id,
      actor,
      action: "operations.intervention.requested",
      result: "observed",
      input_refs: [transaction.current_event_id].filter(Boolean),
      output_refs: [record.work_item_id],
      notes: reason
    });

    return { type: "accepted", workItem: record };
  }
}
