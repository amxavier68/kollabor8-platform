import express from "express";
import helmet from "helmet";
import { id } from "./lib/ids.js";
import { EvidenceService } from "./services/evidence-service.js";
import { EventService } from "./services/event-service.js";
import { RoutingService } from "./services/routing-service.js";
import { OperationsControlService } from "./services/operations-control-service.js";
import { WooCommerceSandboxService } from "./services/woocommerce-sandbox-service.js";
import { WooCommerceIngressService } from "./services/woocommerce-ingress-service.js";
import { apiKeyGuard, mutationGuard } from "./security/mutation-guard.js";

export function createApp(store, env = process.env) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({
    limit: "256kb",
    verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); }
  }));

  const evidence = new EvidenceService(store, env);
  const router = new RoutingService(store, evidence);
  const events = new EventService(store, evidence, router);
  const operations = new OperationsControlService(store, evidence);
  const wooSandbox = new WooCommerceSandboxService(events, env);
  const wooIngress = new WooCommerceIngressService(events, env);
  const guard = mutationGuard(store, env);
  const readGuard = apiKeyGuard(env);

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

  app.post("/api/v1/events", guard, async (req, res, next) => {
    try {
      const result = await events.ingest(req.body);
      if (result.type === "invalid") return res.status(400).json({ error: "invalid_event", details: result.errors });
      if (result.type === "conflict") return res.status(409).json({ error: "idempotency_conflict", event_id: result.event.event_id });
      if (result.type === "deduplicated") return res.status(202).json({ deduplicated: true, event: result.event });
      return res.status(202).json({ deduplicated: false, event: result.event, work_item: result.work_item ?? null });
    } catch (error) { next(error); }
  });

  app.get("/api/v1/events/:eventId", async (req, res, next) => {
    try {
      const event = await events.get(req.params.eventId);
      if (!event) return res.status(404).json({ error: "event_not_found" });
      return res.json({ event });
    } catch (error) { next(error); }
  });

  app.get("/api/v1/ingress/woocommerce/orders", (_req, res) => {
    return res.json({
      ok: true,
      service: "woocommerce-order-ingress",
      method: "POST",
      configured: wooIngress.configured(),
      client_name: env.K8_WOOCOMMERCE_CLIENT_NAME ?? "Petals to the Metal",
      environment: env.K8_ENVIRONMENT ?? "staging"
    });
  });

  app.post("/api/v1/ingress/woocommerce/orders", async (req, res, next) => {
    try {
      const suppliedSignature = req.get("x-wc-webhook-signature");
      const topic = req.get("x-wc-webhook-topic");
      const rawLength = req.rawBody?.length ?? 0;
      const emptyActivationPing = !topic && !suppliedSignature && rawLength === 0;

      if (emptyActivationPing) {
        console.log(JSON.stringify({
          level: "info",
          message: "woocommerce activation ping accepted"
        }));
        return res.status(204).send();
      }

      const verified = wooIngress.verify(req.rawBody, suppliedSignature);
      console.log(JSON.stringify({
        level: "info",
        message: "woocommerce webhook verification",
        topic: topic ?? null,
        signature_present: Boolean(suppliedSignature),
        signature_length: suppliedSignature ? String(suppliedSignature).length : 0,
        raw_body_length: rawLength,
        verified
      }));

      const result = await wooIngress.ingestWebhook({
        rawBody: req.rawBody,
        signature: suppliedSignature,
        topic,
        resourceId: req.get("x-wc-webhook-resource"),
        order: req.body
      });
      if (result.type === "disabled") return res.status(503).json({ error: "woocommerce_ingress_not_configured" });
      if (result.type === "unauthorised") return res.status(401).json({ error: "invalid_woocommerce_signature" });
      if (result.type === "invalid") return res.status(400).json({ error: result.error ?? "invalid_woocommerce_order" });
      if (result.type === "conflict") return res.status(409).json({ error: "idempotency_conflict", event_id: result.event.event_id });
      if (result.type === "deduplicated") return res.status(202).json({ deduplicated: true, event: result.event });
      return res.status(202).json({ deduplicated: false, event: result.event, work_item: result.work_item ?? null });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/ingress/woocommerce/sandbox/orders", guard, async (req, res, next) => {
    try {
      const result = await wooSandbox.ingestOrder(req.body);
      if (result.type === "disabled") return res.status(404).json({ error: "sandbox_not_enabled" });
      if (result.type === "invalid") {
        return res.status(400).json({
          error: result.error ?? "invalid_event",
          ...(result.errors ? { details: result.errors } : {})
        });
      }
      if (result.type === "conflict") return res.status(409).json({ error: "idempotency_conflict", event_id: result.event.event_id });
      if (result.type === "deduplicated") return res.status(202).json({ deduplicated: true, event: result.event });
      return res.status(202).json({ deduplicated: false, event: result.event, work_item: result.work_item ?? null });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/ingress/woocommerce/sandbox/demo-order", guard, async (_req, res, next) => {
    try {
      const result = await wooSandbox.createDemoOrder();
      if (result.type === "disabled") return res.status(404).json({ error: "sandbox_not_enabled" });
      if (result.type === "invalid") return res.status(400).json({ error: "invalid_event", details: result.errors });
      return res.status(202).json({ deduplicated: result.type === "deduplicated", event: result.event, work_item: result.work_item ?? null });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/events/:eventId/replay", guard, async (req, res, next) => {
    try {
      const actor = req.body?.actor ?? { type: "human", id: "owner" };
      const result = await events.replay(req.params.eventId, actor);
      if (result.type === "not_found") return res.status(404).json({ error: "event_not_found" });
      if (result.type === "unsafe") return res.status(409).json({ error: "replay_not_permitted", state: result.event.state });
      return res.status(202).json({ event: result.event });
    } catch (error) { next(error); }
  });

  app.get("/api/v1/evidence", readGuard, async (req, res, next) => {
    try {
      const eventId = req.query.event_id ? String(req.query.event_id) : undefined;
      const correlationId = req.query.correlation_id ? String(req.query.correlation_id) : undefined;
      if (!eventId && !correlationId) {
        return res.status(400).json({ error: "evidence_filter_required" });
      }
      const evidenceRecords = await store.findEvidence({
        eventId,
        correlationId,
        limit: req.query.limit
      });
      return res.json({ evidence: evidenceRecords });
    } catch (error) { next(error); }
  });

  app.get("/api/v1/evidence/:evidenceId", readGuard, async (req, res, next) => {
    try {
      const record = await store.getEvidence(req.params.evidenceId);
      if (!record) return res.status(404).json({ error: "evidence_not_found" });
      return res.json({ evidence: record });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/evidence", guard, async (req, res, next) => {
    try {
      const record = await evidence.append(req.body);
      return res.status(201).json({ evidence: record });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/work-items", guard, async (req, res, next) => {
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

  app.get("/api/v1/operations/transactions", readGuard, async (req, res, next) => {
    try {
      const queue = await operations.queue({
        limit: req.query.limit,
        state: req.query.state ? String(req.query.state) : undefined,
        search: req.query.search ? String(req.query.search) : undefined
      });
      return res.json({ queue });
    } catch (error) { next(error); }
  });

  app.get("/api/v1/operations/transactions/:correlationId", readGuard, async (req, res, next) => {
    try {
      const transaction = await operations.transaction(req.params.correlationId);
      if (transaction.counts.events === 0 && transaction.counts.work_items === 0) {
        return res.status(404).json({ error: "transaction_not_found" });
      }
      return res.json({ transaction });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/operations/transactions/:correlationId/interventions", guard, async (req, res, next) => {
    try {
      const result = await operations.intervene(req.params.correlationId, req.body);
      if (result.type === "not_found") return res.status(404).json({ error: "transaction_not_found" });
      if (result.type === "invalid") return res.status(400).json({ error: "invalid_intervention" });
      return res.status(201).json({ work_item: result.workItem });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/approvals", guard, async (req, res, next) => {
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
