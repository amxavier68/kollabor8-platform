import express from "express";
import { id } from "./lib/ids.js";
import { EvidenceService } from "./services/evidence-service.js";
import { EventService } from "./services/event-service.js";

export function createApp(store, env = process.env) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  const evidence = new EvidenceService(store, env);
  const events = new EventService(store, evidence);

  app.get("/health", (_req, res) => {
    const durable = store.kind === "mongo";
    res.status(durable ? 200 : 206).json({
      ok: true,
      service: "k8-platform",
      version: "0.1.0",
      storage: store.kind,
      durability: durable ? "durable" : "ephemeral"
    });
  });

  app.post("/api/v1/events", async (req, res, next) => {
    try {
      const result = await events.ingest(req.body);
      if (result.type === "invalid") return res.status(400).json({ error: "invalid_event", details: result.errors });
      if (result.type === "conflict") return res.status(409).json({ error: "idempotency_conflict", event_id: result.event.event_id });
      if (result.type === "deduplicated") return res.status(202).json({ deduplicated: true, event: result.event });
      return res.status(202).json({ deduplicated: false, event: result.event });
    } catch (error) { next(error); }
  });

  app.get("/api/v1/events/:eventId", async (req, res, next) => {
    try {
      const event = await events.get(req.params.eventId);
      if (!event) return res.status(404).json({ error: "event_not_found" });
      return res.json({ event });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/events/:eventId/replay", async (req, res, next) => {
    try {
      const actor = req.body?.actor ?? { type: "human", id: "owner" };
      const result = await events.replay(req.params.eventId, actor);
      if (result.type === "not_found") return res.status(404).json({ error: "event_not_found" });
      if (result.type === "unsafe") return res.status(409).json({ error: "replay_not_permitted", state: result.event.state });
      return res.status(202).json({ event: result.event });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/evidence", async (req, res, next) => {
    try {
      const record = await evidence.append(req.body);
      return res.status(201).json({ evidence: record });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/work-items", async (req, res, next) => {
    try {
      const now = new Date().toISOString();
      const record = {
        work_item_id: req.body.work_item_id ?? id("work"),
        organisation_id: req.body.organisation_id,
        correlation_id: req.body.correlation_id,
        title: req.body.title,
        state: req.body.state ?? "OPEN",
        owner: req.body.owner ?? null,
        approval_level: req.body.approval_level ?? "A0",
        evidence_required: req.body.evidence_required ?? [],
        dependencies: req.body.dependencies ?? [],
        created_at: now,
        updated_at: now
      };
      if (!record.organisation_id || !record.correlation_id || !record.title) {
        return res.status(400).json({ error: "invalid_work_item" });
      }
      await store.insertWorkItem(record);
      await evidence.append({
        organisation_id: record.organisation_id,
        correlation_id: record.correlation_id,
        work_item_id: record.work_item_id,
        action: "delivery.work_item.created",
        result: "observed"
      });
      return res.status(201).json({ work_item: record });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/approvals", async (req, res, next) => {
    try {
      const record = {
        approval_id: req.body.approval_id ?? id("apr"),
        organisation_id: req.body.organisation_id,
        correlation_id: req.body.correlation_id,
        work_item_id: req.body.work_item_id ?? null,
        level: req.body.level,
        decision: req.body.decision,
        approver: req.body.approver,
        reason: req.body.reason ?? null,
        created_at: new Date().toISOString()
      };
      if (!record.organisation_id || !record.correlation_id || !["A0","A1","A2","A3"].includes(record.level) || !["approved","rejected"].includes(record.decision) || !record.approver) {
        return res.status(400).json({ error: "invalid_approval" });
      }
      await store.insertApproval(record);
      await evidence.append({
        organisation_id: record.organisation_id,
        correlation_id: record.correlation_id,
        work_item_id: record.work_item_id,
        approval_id: record.approval_id,
        actor: record.approver,
        action: "governance.approval.recorded",
        result: record.decision === "approved" ? "approved" : "rejected"
      });
      return res.status(201).json({ approval: record });
    } catch (error) { next(error); }
  });

  app.use((error, _req, res, _next) => {
    const code = error?.code === 11000 ? 409 : 500;
    const body = {
      error: code === 409 ? "immutable_or_unique_conflict" : "internal_error"
    };
    if (error?.details) body.details = error.details;
    if (env.NODE_ENV !== "production") body.message = error.message;
    res.status(code).json(body);
  });

  return app;
}
