export class RoutingService {
  constructor(store, evidence) {
    this.store = store;
    this.evidence = evidence;
  }

  async route(event) {
    if (event.event_name !== "briefing.schedule.due") {
      return { event, workItem: null };
    }

    const localDate = event.payload?.local_date ?? event.occurred_at.slice(0, 10);
    const now = new Date().toISOString();
    const workItem = {
      work_item_id: `work_briefing_${localDate}`,
      organisation_id: event.organisation_id,
      correlation_id: event.correlation_id,
      title: `K8 Daily Intelligence Briefing — ${localDate}`,
      state: "OPEN",
      owner: null,
      approval_level: "A0",
      evidence_required: [
        "source-evidence",
        "deduplication",
        "briefing-delivery"
      ],
      dependencies: [],
      created_at: now,
      updated_at: now
    };

    await this.store.insertWorkItem(workItem);
    await this.evidence.append({
      organisation_id: event.organisation_id,
      correlation_id: event.correlation_id,
      causation_id: event.event_id,
      event_id: event.event_id,
      work_item_id: workItem.work_item_id,
      actor: { type: "service", id: "k8-platform" },
      action: "delivery.work_item.created",
      result: "observed",
      output_refs: [workItem.work_item_id]
    });

    const routed = await this.store.updateEvent(event.event_id, {
      state: "ROUTED",
      routed_to: {
        type: "work_item",
        id: workItem.work_item_id
      }
    });

    await this.evidence.append({
      organisation_id: event.organisation_id,
      correlation_id: event.correlation_id,
      causation_id: event.event_id,
      event_id: event.event_id,
      work_item_id: workItem.work_item_id,
      actor: { type: "service", id: "k8-platform" },
      action: "pulse.event.routed",
      result: "observed",
      output_refs: [workItem.work_item_id]
    });

    return { event: routed, workItem };
  }
}
