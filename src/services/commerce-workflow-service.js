const TERMINAL_STAGES = new Set(["COMPLETED", "CANCELLED", "REFUNDED"]);
const ACTIVE_RANK = new Map([
  ["ORDER_RECEIVED", 0],
  ["ACKNOWLEDGED", 1],
  ["PREPARING", 2],
  ["READY_FOR_COURIER", 3],
  ["COURIER_ASSIGNED", 4],
  ["COURIER_ACCEPTED", 5],
  ["PICKED_UP", 6],
  ["DELIVERED", 7],
  ["COMPLETED", 8]
]);

const ALLOWED = new Map([
  ["ORDER_RECEIVED", new Set(["ACKNOWLEDGED", "EXCEPTION", "CANCELLED"])],
  ["ACKNOWLEDGED", new Set(["PREPARING", "EXCEPTION", "CANCELLED"])],
  ["PREPARING", new Set(["READY_FOR_COURIER", "EXCEPTION", "CANCELLED"])],
  ["READY_FOR_COURIER", new Set(["COURIER_ASSIGNED", "EXCEPTION", "CANCELLED"])],
  ["COURIER_ASSIGNED", new Set(["COURIER_ACCEPTED", "EXCEPTION"])],
  ["COURIER_ACCEPTED", new Set(["PICKED_UP", "EXCEPTION"])],
  ["PICKED_UP", new Set(["DELIVERED", "EXCEPTION"])],
  ["DELIVERED", new Set(["COMPLETED", "EXCEPTION"])],
  ["EXCEPTION", new Set(["ACKNOWLEDGED", "PREPARING", "READY_FOR_COURIER", "COURIER_ASSIGNED", "COURIER_ACCEPTED", "PICKED_UP"])],
  ["COMPLETED", new Set()],
  ["CANCELLED", new Set()],
  ["REFUNDED", new Set()]
]);

function sourceProjection(status) {
  switch (String(status ?? "").toLowerCase()) {
    case "pending":
      return { stage: "ORDER_RECEIVED", state: "OPEN", approval: "A0", next: "acknowledge-order" };
    case "processing":
      return { stage: "PREPARING", state: "OPEN", approval: "A0", next: "prepare-order" };
    case "on-hold":
      return { stage: "EXCEPTION", state: "BLOCKED", approval: "A1", next: "review-order-hold" };
    case "failed":
      return { stage: "EXCEPTION", state: "BLOCKED", approval: "A1", next: "review-payment-failure" };
    case "cancelled":
      return { stage: "CANCELLED", state: "CANCELLED", approval: "A0", next: null };
    case "refunded":
      return { stage: "REFUNDED", state: "CLOSED", approval: "A0", next: null };
    case "completed":
      return { stage: "COMPLETED", state: "COMPLETED", approval: "A0", next: null };
    default:
      return { stage: "EXCEPTION", state: "BLOCKED", approval: "A1", next: "review-unknown-commerce-status" };
  }
}

function stateForStage(stage) {
  if (stage === "EXCEPTION") return "BLOCKED";
  if (stage === "COMPLETED") return "COMPLETED";
  if (stage === "CANCELLED") return "CANCELLED";
  if (stage === "REFUNDED") return "CLOSED";
  return "OPEN";
}

function nextForStage(stage) {
  const next = {
    ORDER_RECEIVED: "acknowledge-order",
    ACKNOWLEDGED: "begin-preparation",
    PREPARING: "mark-ready-for-courier",
    READY_FOR_COURIER: "assign-courier",
    COURIER_ASSIGNED: "record-courier-acceptance",
    COURIER_ACCEPTED: "confirm-pickup",
    PICKED_UP: "confirm-delivery",
    DELIVERED: "complete-order",
    EXCEPTION: "resolve-exception"
  };
  return next[stage] ?? null;
}

export class CommerceWorkflowService {
  constructor(store, evidence) {
    this.store = store;
    this.evidence = evidence;
  }

  workItemId(event) {
    return `work_commerce_${event.subject?.id ?? event.payload?.order_id}`;
  }

  async observe(event) {
    const workItemId = this.workItemId(event);
    const current = await this.store.getWorkItem(workItemId);
    const projection = sourceProjection(event.payload?.status);
    let stage = projection.stage;

    if (current && !TERMINAL_STAGES.has(projection.stage) && projection.stage !== "EXCEPTION") {
      const currentRank = ACTIVE_RANK.get(current.workflow_stage);
      const projectedRank = ACTIVE_RANK.get(projection.stage);
      if (currentRank != null && projectedRank != null && currentRank > projectedRank) {
        stage = current.workflow_stage;
      }
    }

    const now = new Date().toISOString();
    const patch = {
      organisation_id: event.organisation_id,
      correlation_id: event.correlation_id,
      title: `PTTM order ${event.service_context?.request_reference ?? event.subject?.id}`,
      state: stage === projection.stage ? projection.state : stateForStage(stage),
      owner: current?.owner ?? null,
      approval_level: projection.stage === "EXCEPTION" ? "A1" : (current?.approval_level ?? projection.approval),
      evidence_required: ["woocommerce-order-event", "workflow-transitions", "completion-or-exception-evidence"],
      dependencies: current?.dependencies ?? [],
      workflow_type: "commerce_order",
      workflow_stage: stage,
      source_status: event.payload?.status ?? null,
      next_action: nextForStage(stage),
      client_name: event.service_context?.client_name ?? null,
      customer_name: event.service_context?.display_name ?? null,
      order_reference: event.service_context?.request_reference ?? null,
      updated_at: now
    };

    let workItem;
    let action;
    if (current) {
      workItem = await this.store.updateWorkItem(workItemId, patch);
      action = "commerce.work_item.updated";
    } else {
      workItem = {
        work_item_id: workItemId,
        ...patch,
        created_at: now
      };
      await this.store.insertWorkItem(workItem);
      action = "commerce.work_item.created";
    }

    await this.evidence.append({
      organisation_id: event.organisation_id,
      correlation_id: event.correlation_id,
      causation_id: event.event_id,
      event_id: event.event_id,
      work_item_id: workItemId,
      actor: { type: "service", id: "commerce-workflow" },
      action,
      result: "observed",
      output_refs: [workItemId],
      notes: `WooCommerce status ${event.payload?.status ?? "unknown"} observed; workflow stage ${stage}`
    });

    return workItem;
  }

  async transition(correlationId, input = {}) {
    const workItems = await this.store.findWorkItemsByCorrelation(correlationId);
    const workItem = workItems.find((item) => item.workflow_type === "commerce_order");
    if (!workItem) return { type: "not_found" };

    const target = String(input.stage ?? "").trim().toUpperCase();
    const actor = input.actor;
    if (!target || !actor?.type || !actor?.id) return { type: "invalid" };
    if (!ALLOWED.has(target)) return { type: "invalid" };

    const current = workItem.workflow_stage ?? "ORDER_RECEIVED";
    if (current === target) return { type: "deduplicated", workItem };
    if (!ALLOWED.get(current)?.has(target)) {
      return { type: "unsafe", current, target, workItem };
    }

    const now = new Date().toISOString();
    const courierInput = input.courier ?? null;
    if (target === "COURIER_ASSIGNED") {
      const courierId = String(courierInput?.id ?? "").trim();
      const courierName = String(courierInput?.name ?? "").trim();
      if (!courierId || !courierName) return { type: "invalid", reason: "courier_identity_required" };
    }
    if (["COURIER_ACCEPTED", "PICKED_UP", "DELIVERED"].includes(target) && !workItem.courier?.id) {
      return { type: "invalid", reason: "courier_not_assigned" };
    }

    const dispatchPatch = {};
    if (target === "COURIER_ASSIGNED") {
      dispatchPatch.courier = {
        id: String(courierInput.id).trim(),
        name: String(courierInput.name).trim()
      };
      dispatchPatch.dispatch_status = "AWAITING_ACCEPTANCE";
      dispatchPatch.courier_assigned_at = now;
      dispatchPatch.courier_accepted_at = null;
      dispatchPatch.picked_up_at = null;
      dispatchPatch.delivered_at = null;
    } else if (target === "COURIER_ACCEPTED") {
      dispatchPatch.dispatch_status = "ACCEPTED";
      dispatchPatch.courier_accepted_at = now;
    } else if (target === "PICKED_UP") {
      dispatchPatch.dispatch_status = "PICKED_UP";
      dispatchPatch.picked_up_at = now;
    } else if (target === "DELIVERED") {
      dispatchPatch.dispatch_status = "DELIVERED";
      dispatchPatch.delivered_at = now;
    }

    const updated = await this.store.updateWorkItem(workItem.work_item_id, {
      workflow_stage: target,
      state: stateForStage(target),
      next_action: nextForStage(target),
      approval_level: target === "EXCEPTION" ? "A1" : workItem.approval_level,
      owner: input.owner ?? workItem.owner ?? null,
      exception_reason: target === "EXCEPTION" ? (input.reason ?? "unspecified") : null,
      ...dispatchPatch
    });

    await this.evidence.append({
      organisation_id: workItem.organisation_id,
      correlation_id: correlationId,
      work_item_id: workItem.work_item_id,
      actor,
      action: "commerce.workflow.transitioned",
      result: target === "EXCEPTION" ? "blocked" : "approved",
      input_refs: [current],
      output_refs: [target],
      notes: input.reason ?? (target === "COURIER_ASSIGNED"
        ? `${current} -> ${target}; courier ${updated.courier?.name ?? "assigned"}`
        : `${current} -> ${target}`)
    });

    return { type: "accepted", workItem: updated };
  }
}
