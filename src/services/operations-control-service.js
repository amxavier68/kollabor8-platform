import { id } from "../lib/ids.js";

function stamp(record) {
  return record.received_at ?? record.created_at ?? record.updated_at ?? "";
}

export class OperationsControlService {
  constructor(store, evidence) {
    this.store = store;
    this.evidence = evidence;
  }

  async queue({ limit = 50, state, search } = {}) {
    const recent = await this.store.findRecentEvents(500);
    const latestByCorrelation = new Map();

    for (const event of recent) {
      if (!latestByCorrelation.has(event.correlation_id)) {
        latestByCorrelation.set(event.correlation_id, event);
      }
    }

    let items = [...latestByCorrelation.values()].map((event) => {
      const service = event.service_context ?? {};
      const internal = !event.client_id && ["org_kollabor8", "org_k8"].includes(event.organisation_id);
      const displayName =
        service.display_name ??
        (event.client_id ? event.client_id : internal ? "Kollabor8 (internal)" : "Unidentified party");
      const requestType = service.request_type ?? event.subject?.id ?? event.event_name;
      const reference = service.request_reference ?? event.correlation_id;

      return {
        correlation_id: event.correlation_id,
        party_type: service.party_type ?? (internal ? "internal" : event.client_id ? "client" : "unknown"),
        party_id: service.party_id ?? event.client_id ?? null,
        display_name: displayName,
        client_name: service.client_name ?? null,
        request_type: requestType,
        request_reference: reference,
        summary: service.summary ?? null,
        channel: service.channel ?? null,
        priority: service.priority ?? "normal",
        sla_due_at: service.sla_due_at ?? null,
        current_state: event.state ?? null,
        workflow_status: service.workflow_status ?? null,
        latest_event_name: event.event_name,
        latest_event_id: event.event_id,
        last_activity_at: event.updated_at ?? event.received_at ?? event.occurred_at,
        organisation_id: event.organisation_id,
        project_id: event.project_id ?? null
      };
    });

    if (state) items = items.filter((item) => item.current_state === state);
    if (search) {
      const needle = String(search).toLowerCase();
      items = items.filter((item) =>
        [
          item.display_name,
          item.request_type,
          item.request_reference,
          item.correlation_id,
          item.summary,
          item.party_id
        ].some((value) => String(value ?? "").toLowerCase().includes(needle))
      );
    }

    items.sort((a, b) => String(b.last_activity_at).localeCompare(String(a.last_activity_at)));
    items = items.slice(0, Math.min(Math.max(Number(limit) || 50, 1), 100));

    return {
      count: items.length,
      generated_at: new Date().toISOString(),
      items
    };
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
