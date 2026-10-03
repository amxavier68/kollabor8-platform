import { contentHash } from "../lib/hash.js";
import { id } from "../lib/ids.js";
import { validate } from "../validation.js";

export class EvidenceService {
  constructor(store, env = process.env) {
    this.store = store;
    this.environment = env.K8_ENVIRONMENT ?? (env.NODE_ENV === "production" ? "production" : "staging");
  }

  async append(input) {
    const record = {
      evidence_id: input.evidence_id ?? id("evd"),
      organisation_id: input.organisation_id,
      correlation_id: input.correlation_id,
      causation_id: input.causation_id ?? null,
      event_id: input.event_id ?? null,
      work_item_id: input.work_item_id ?? null,
      run_id: input.run_id ?? id("run"),
      actor: input.actor ?? { type: "service", id: "k8-platform" },
      seat_id: input.seat_id ?? null,
      agent_id: input.agent_id ?? null,
      skill_id: input.skill_id ?? null,
      tool_id: input.tool_id ?? null,
      policy_decision_id: input.policy_decision_id ?? null,
      approval_id: input.approval_id ?? null,
      action: input.action,
      input_refs: input.input_refs ?? [],
      output_refs: input.output_refs ?? [],
      result: input.result,
      validation: input.validation ?? {},
      failure: input.failure ?? null,
      recovery: input.recovery ?? null,
      created_at: input.created_at ?? new Date().toISOString(),
      environment: input.environment ?? this.environment,
      sensitivity: input.sensitivity ?? "internal",
      retention_class: input.retention_class ?? "operational",
      previous_evidence_id: input.previous_evidence_id ?? null
    };

    record.integrity = { content_hash: contentHash(record) };
    const result = validate("evidence", record);
    if (!result.ok) {
      const error = new Error("EVIDENCE_VALIDATION_FAILED");
      error.details = result.errors;
      throw error;
    }
    return this.store.appendEvidence(record);
  }
}
