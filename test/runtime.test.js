import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import crypto from "node:crypto";
import { createApp } from "../src/app.js";
import { MemoryStore } from "../src/storage/memory-store.js";

async function withServer(fn, envOverrides = {}) {
  const store = new MemoryStore();
  await store.init();
  const app = createApp(store, {
    NODE_ENV: "test",
    K8_ENVIRONMENT: "test",
    AUTH_DISABLED: "true",
    ALLOW_EPHEMERAL_MUTATIONS: "true",
    ...envOverrides
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    await fn({ base: `http://127.0.0.1:${address.port}`, store });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function sampleEvent(overrides = {}) {
  const now = new Date().toISOString();
  return {
    event_id: "evt_test_1",
    event_name: "briefing.schedule.due",
    version: 1,
    organisation_id: "org_k8",
    client_id: null,
    project_id: null,
    occurred_at: now,
    received_at: now,
    source: { type: "scheduler", id: "test" },
    actor: { type: "service", id: "k8-scheduler" },
    subject: { type: "workflow", id: "daily-intelligence-briefing" },
    correlation_id: "corr_test_1",
    causation_id: null,
    trace_id: null,
    environment: "test",
    payload: {},
    metadata: {},
    sensitivity: "internal",
    retention_class: "operational",
    idempotency_key: "briefing-2026-10-03",
    ...overrides
  };
}

test("health exposes ephemeral mode during tests", async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 206);
    const body = await response.json();
    assert.equal(body.storage, "memory");
    assert.equal(body.durability, "ephemeral");
  });
});

test("Pulse ingestion is idempotent", async () => {
  await withServer(async ({ base }) => {
    const event = sampleEvent();
    const first = await fetch(`${base}/api/v1/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event)
    });
    assert.equal(first.status, 202);
    assert.equal((await first.json()).deduplicated, false);

    const second = await fetch(`${base}/api/v1/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event)
    });
    assert.equal(second.status, 202);
    assert.equal((await second.json()).deduplicated, true);
  });
});

test("same idempotency key with different payload is rejected", async () => {
  await withServer(async ({ base }) => {
    const event = sampleEvent();
    await fetch(`${base}/api/v1/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event)
    });

    const response = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleEvent({ event_id: "evt_test_2", payload: { changed: true } }))
    });
    assert.equal(response.status, 409);
  });
});

test("replay is blocked from a validated event", async () => {
  await withServer(async ({ base }) => {
    const event = sampleEvent();
    await fetch(`${base}/api/v1/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event)
    });

    const response = await fetch(`${base}/api/v1/events/${event.event_id}/replay`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}"
    });
    assert.equal(response.status, 409);
  });
});

test("invalid events fail closed", async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/api/v1/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event_id: "bad" })
    });
    assert.equal(response.status, 400);
  });
});

test("ephemeral staging mutations safe-stop by default", async () => {
  const store = new MemoryStore();
  await store.init();
  const app = createApp(store, { NODE_ENV: "staging", K8_ENVIRONMENT: "staging", AUTH_DISABLED: "true" });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleEvent())
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "safe_stop");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test("evidence lookup finds ingest evidence by event id", async () => {
  await withServer(async ({ base }) => {
    const event = sampleEvent();
    const ingest = await fetch(`${base}/api/v1/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event)
    });
    assert.equal(ingest.status, 202);

    const response = await fetch(`${base}/api/v1/evidence?event_id=${encodeURIComponent(event.event_id)}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.evidence.length >= 1);
    const ingestEvidence = body.evidence.find((record) => record.action === "pulse.event.ingested");
    assert.ok(ingestEvidence);
    assert.equal(ingestEvidence.event_id, event.event_id);
    assert.equal(ingestEvidence.result, "observed");
  });
});

test("evidence collection lookup requires a narrow filter", async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/api/v1/evidence`);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "evidence_filter_required");
  });
});

test("evidence can be read by evidence id", async () => {
  await withServer(async ({ base }) => {
    const event = sampleEvent();
    await fetch(`${base}/api/v1/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event)
    });
    const list = await fetch(`${base}/api/v1/evidence?correlation_id=${encodeURIComponent(event.correlation_id)}`);
    const listed = await list.json();
    const evidenceId = listed.evidence[0].evidence_id;

    const response = await fetch(`${base}/api/v1/evidence/${encodeURIComponent(evidenceId)}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.evidence.evidence_id, evidenceId);
  });
});


test("Daily Intelligence schedule event is routed into a governed work item", async () => {
  await withServer(async ({ base, store }) => {
    const event = sampleEvent({
      event_id: "evt_briefing_2026-10-03",
      correlation_id: "briefing:2026-10-03",
      idempotency_key: "daily-intelligence:2026-10-03",
      payload: {
        local_date: "2026-10-03",
        timezone: "Australia/Brisbane",
        monday_weekend_catchup: false,
        part_1_item_count: 5
      }
    });

    const response = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event)
    });
    assert.equal(response.status, 202);

    const body = await response.json();
    assert.equal(body.event.state, "ROUTED");
    assert.equal(body.work_item.work_item_id, "work_briefing_2026-10-03");
    assert.equal(body.work_item.approval_level, "A0");

    const storedWorkItem = store.workItems.get("work_briefing_2026-10-03");
    assert.ok(storedWorkItem);
    assert.equal(storedWorkItem.correlation_id, "briefing:2026-10-03");

    const evidenceResponse = await fetch(
      `${base}/api/v1/evidence?correlation_id=${encodeURIComponent(event.correlation_id)}`
    );
    assert.equal(evidenceResponse.status, 200);
    const evidenceBody = await evidenceResponse.json();
    const actions = evidenceBody.evidence.map((record) => record.action);
    assert.ok(actions.includes("pulse.event.ingested"));
    assert.ok(actions.includes("delivery.work_item.created"));
    assert.ok(actions.includes("pulse.event.routed"));
  });
});


test("Operations Control returns a correlated transaction timeline", async () => {
  await withServer(async ({ base }) => {
    const event = sampleEvent({
      event_id: "evt_ops_1",
      correlation_id: "order:10428",
      idempotency_key: "order:10428:created",
      event_name: "order.created"
    });

    const ingest = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event)
    });
    assert.equal(ingest.status, 202);

    const response = await fetch(
      `${base}/api/v1/operations/transactions/${encodeURIComponent(event.correlation_id)}`
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.transaction.correlation_id, "order:10428");
    assert.equal(body.transaction.counts.events, 1);
    assert.ok(body.transaction.counts.evidence >= 1);
    assert.ok(body.transaction.timeline.some((item) => item.type === "event"));
    assert.ok(body.transaction.timeline.some((item) => item.type === "evidence"));
  });
});

test("Operations Control mediation creates governed support work without mutating transaction state", async () => {
  await withServer(async ({ base }) => {
    const event = sampleEvent({
      event_id: "evt_ops_2",
      correlation_id: "order:10429",
      idempotency_key: "order:10429:created",
      event_name: "order.created"
    });

    await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event)
    });

    const intervention = await fetch(
      `${base}/api/v1/operations/transactions/${encodeURIComponent(event.correlation_id)}/interventions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: "Courier has not acknowledged pickup",
          requested_action: "review-courier-assignment",
          actor: { type: "human", id: "support-operator" }
        })
      }
    );
    assert.equal(intervention.status, 201);
    const interventionBody = await intervention.json();
    assert.equal(interventionBody.work_item.approval_level, "A1");
    assert.equal(interventionBody.work_item.state, "OPEN");

    const transaction = await fetch(
      `${base}/api/v1/operations/transactions/${encodeURIComponent(event.correlation_id)}`
    );
    const transactionBody = await transaction.json();
    assert.equal(transactionBody.transaction.current_state, "VALIDATED");
    assert.equal(transactionBody.transaction.open_work_items, 1);
    assert.ok(
      transactionBody.transaction.evidence.some(
        (record) => record.action === "operations.intervention.requested"
      )
    );
  });
});


test("Operations Control queue identifies who is being served and what they requested", async () => {
  await withServer(async ({ base }) => {
    const customerEvent = sampleEvent({
      event_id: "evt_customer_1",
      event_name: "order.created",
      correlation_id: "order:10428",
      idempotency_key: "order:10428:created",
      client_id: "client_pttm",
      subject: { type: "order", id: "floral-delivery" },
      service_context: {
        party_type: "customer",
        party_id: "cust_10428",
        display_name: "Customer 10428",
        request_type: "Floral delivery",
        request_reference: "Order #10428",
        summary: "Delivery order awaiting fulfilment",
        channel: "web",
        priority: "normal",
        sla_due_at: null
      }
    });

    const internalEvent = sampleEvent({
      event_id: "evt_internal_1",
      correlation_id: "briefing:2026-10-03",
      idempotency_key: "briefing:2026-10-03"
    });

    for (const event of [customerEvent, internalEvent]) {
      const response = await fetch(`${base}/api/v1/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event)
      });
      assert.equal(response.status, 202);
    }

    const response = await fetch(`${base}/api/v1/operations/transactions`);
    assert.equal(response.status, 200);
    const body = await response.json();

    const customer = body.queue.items.find((item) => item.correlation_id === "order:10428");
    assert.ok(customer);
    assert.equal(customer.display_name, "Customer 10428");
    assert.equal(customer.request_type, "Floral delivery");
    assert.equal(customer.request_reference, "Order #10428");

    const internal = body.queue.items.find((item) => item.correlation_id === "briefing:2026-10-03");
    assert.ok(internal);
    assert.equal(internal.display_name, "Kollabor8 (internal)");
    assert.equal(internal.party_type, "internal");
  });
});


test("WooCommerce sandbox ingress maps an order into a customer service transaction", async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/api/v1/ingress/woocommerce/sandbox/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: 9001,
        number: "9001",
        status: "processing",
        currency: "AUD",
        total: "129.00",
        customer_id: 501,
        date_created_gmt: "2026-10-03T00:00:00Z",
        date_modified_gmt: "2026-10-03T00:01:00Z",
        billing: {
          first_name: "Sophie",
          last_name: "Hart",
          email: "sophie.sandbox@example.invalid"
        },
        line_items: [
          { product_id: 101, name: "Seasonal Floral Arrangement", quantity: 1, total: "99.00" },
          { product_id: 202, name: "Gift Add-on", quantity: 1, total: "30.00" }
        ],
        shipping_lines: [{ method_title: "Local delivery" }]
      })
    });

    assert.equal(response.status, 202);
    const ingested = await response.json();
    assert.equal(ingested.event.correlation_id, "woocommerce:order:9001");
    assert.equal(ingested.event.service_context.display_name, "Sophie Hart");
    assert.equal(ingested.event.service_context.request_reference, "Order #9001");
    assert.equal(ingested.event.service_context.channel, "woocommerce");

    const queueResponse = await fetch(`${base}/api/v1/operations/transactions?search=Sophie`);
    assert.equal(queueResponse.status, 200);
    const queue = await queueResponse.json();
    assert.equal(queue.queue.count, 1);
    assert.equal(queue.queue.items[0].display_name, "Sophie Hart");
    assert.equal(queue.queue.items[0].request_type, "WooCommerce order");
    assert.equal(queue.queue.items[0].request_reference, "Order #9001");
  }, { K8_WOOCOMMERCE_SANDBOX: "true" });
});

test("WooCommerce sandbox ingress is unavailable unless explicitly enabled", async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/api/v1/ingress/woocommerce/sandbox/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 9002 })
    });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "sandbox_not_enabled");
  });
});


test("signed WooCommerce webhook maps live order into PTTM service queue", async () => {
  await withServer(async ({ base }) => {
    const order = {
      id: 9101,
      number: "9101",
      status: "processing",
      currency: "AUD",
      total: "149.00",
      customer_id: 601,
      date_created_gmt: "2026-10-03T00:10:00Z",
      date_modified_gmt: "2026-10-03T00:11:00Z",
      billing: {
        first_name: "Mia",
        last_name: "Cole"
      },
      line_items: [
        { product_id: 301, name: "King Protea Arrangement", quantity: 1, total: "149.00" }
      ],
      shipping_lines: [{ method_title: "Scenic Rim delivery" }]
    };
    const raw = JSON.stringify(order);
    const signature = crypto.createHmac("sha256", "woo-test-secret").update(raw).digest("base64");

    const response = await fetch(`${base}/api/v1/ingress/woocommerce/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-wc-webhook-signature": signature,
        "x-wc-webhook-topic": "order.updated",
        "x-wc-webhook-resource": "order"
      },
      body: raw
    });

    assert.equal(response.status, 202);
    const ingested = await response.json();
    assert.equal(ingested.event.service_context.client_name, "Petals to the Metal");
    assert.equal(ingested.event.service_context.display_name, "Mia Cole");
    assert.equal(ingested.event.service_context.workflow_status, "processing");

    const queueResponse = await fetch(`${base}/api/v1/operations/transactions?search=Mia`);
    const queue = await queueResponse.json();
    assert.equal(queue.queue.count, 1);
    assert.equal(queue.queue.items[0].client_name, "Petals to the Metal");
    assert.equal(queue.queue.items[0].workflow_status, "processing");
    assert.equal(queue.queue.items[0].request_reference, "Order #9101");
  }, {
    K8_WOOCOMMERCE_WEBHOOK_SECRET: "woo-test-secret",
    K8_WOOCOMMERCE_CLIENT_NAME: "Petals to the Metal",
    K8_WOOCOMMERCE_CLIENT_ID: "client_pttm",
    K8_WOOCOMMERCE_PROJECT_ID: "project_pttm_commerce"
  });
});

test("WooCommerce webhook rejects invalid signature", async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/api/v1/ingress/woocommerce/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-wc-webhook-signature": "invalid"
      },
      body: JSON.stringify({ id: 9102, status: "processing" })
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "invalid_woocommerce_signature");
  }, { K8_WOOCOMMERCE_WEBHOOK_SECRET: "woo-test-secret" });
});


test("WooCommerce activation ping is accepted without signature", async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/api/v1/ingress/woocommerce/orders`, {
      method: "POST"
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.acknowledged, "woocommerce_activation_ping");
  }, { K8_WOOCOMMERCE_WEBHOOK_SECRET: "woo-test-secret" });
});
