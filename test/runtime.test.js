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


test("PTTM commissioning flow keeps one transaction across order update and duplicate delivery", async () => {
  await withServer(async ({ base }) => {
    const secret = "woo-test-secret";
    const baseOrder = {
      id: 9201,
      number: "9201",
      currency: "AUD",
      total: "165.00",
      customer_id: 701,
      billing: { first_name: "Test", last_name: "Customer" },
      line_items: [{ product_id: 401, name: "PTTM Test Arrangement", quantity: 1, total: "165.00" }],
      shipping_lines: [{ method_title: "Local delivery" }]
    };

    async function send(order) {
      const raw = JSON.stringify(order);
      const signature = crypto.createHmac("sha256", secret).update(raw).digest("base64");
      return fetch(`${base}/api/v1/ingress/woocommerce/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wc-webhook-signature": signature,
          "x-wc-webhook-topic": "order.updated",
          "x-wc-webhook-resource": "order"
        },
        body: raw
      });
    }

    const processingOrder = {
      ...baseOrder,
      status: "processing",
      date_created_gmt: "2026-10-03T00:20:00Z",
      date_modified_gmt: "2026-10-03T00:21:00Z"
    };

    const first = await send(processingOrder);
    assert.equal(first.status, 202);
    const firstBody = await first.json();
    assert.equal(firstBody.deduplicated, false);
    assert.equal(firstBody.event.correlation_id, "woocommerce:order:9201");

    const duplicate = await send(processingOrder);
    assert.equal(duplicate.status, 202);
    const duplicateBody = await duplicate.json();
    assert.equal(duplicateBody.deduplicated, true);

    const completedOrder = {
      ...baseOrder,
      status: "completed",
      date_created_gmt: "2026-10-03T00:20:00Z",
      date_modified_gmt: "2026-10-03T00:31:00Z"
    };

    const updated = await send(completedOrder);
    assert.equal(updated.status, 202);
    const updatedBody = await updated.json();
    assert.equal(updatedBody.deduplicated, false);
    assert.equal(updatedBody.event.correlation_id, "woocommerce:order:9201");

    const queueResponse = await fetch(`${base}/api/v1/operations/transactions?search=9201`);
    assert.equal(queueResponse.status, 200);
    const queue = await queueResponse.json();
    assert.equal(queue.queue.count, 1);
    assert.equal(queue.queue.items[0].client_name, "Petals to the Metal");
    assert.equal(queue.queue.items[0].display_name, "Test Customer");
    assert.equal(queue.queue.items[0].request_type, "Floral order");
    assert.equal(queue.queue.items[0].request_reference, "Order #9201");
    assert.equal(queue.queue.items[0].workflow_status, "completed");

    const transactionResponse = await fetch(
      `${base}/api/v1/operations/transactions/${encodeURIComponent("woocommerce:order:9201")}`
    );
    assert.equal(transactionResponse.status, 200);
    const transaction = (await transactionResponse.json()).transaction;
    assert.equal(transaction.correlation_id, "woocommerce:order:9201");
    assert.equal(transaction.counts.events, 2);
    assert.ok(transaction.counts.evidence >= 2);
    assert.equal(transaction.events.at(-1).service_context.workflow_status, "completed");

    const evidenceResponse = await fetch(
      `${base}/api/v1/evidence?correlation_id=${encodeURIComponent("woocommerce:order:9201")}`
    );
    assert.equal(evidenceResponse.status, 200);
    const evidence = (await evidenceResponse.json()).evidence;
    const ingestRecords = evidence.filter((record) => record.action === "pulse.event.ingested");
    assert.equal(ingestRecords.length, 2);
  }, {
    K8_WOOCOMMERCE_WEBHOOK_SECRET: "woo-test-secret",
    K8_WOOCOMMERCE_CLIENT_NAME: "Petals to the Metal",
    K8_WOOCOMMERCE_CLIENT_ID: "client_pttm",
    K8_WOOCOMMERCE_PROJECT_ID: "project_pttm_commerce"
  });
});


test("PTTM commerce workflow enforces ordered operational transitions with evidence", async () => {
  await withServer(async ({ base }) => {
    const secret = "woo-test-secret";
    const order = {
      id: 9301,
      number: "9301",
      status: "pending",
      currency: "AUD",
      total: "120.00",
      customer_id: 801,
      date_created_gmt: "2026-10-03T01:00:00Z",
      date_modified_gmt: "2026-10-03T01:01:00Z",
      billing: { first_name: "Workflow", last_name: "Test" },
      line_items: [{ product_id: 501, name: "PTTM Workflow Test", quantity: 1, total: "120.00" }]
    };
    const raw = JSON.stringify(order);
    const signature = crypto.createHmac("sha256", secret).update(raw).digest("base64");
    const ingest = await fetch(`${base}/api/v1/ingress/woocommerce/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-wc-webhook-signature": signature,
        "x-wc-webhook-topic": "order.created",
        "x-wc-webhook-resource": "order"
      },
      body: raw
    });
    assert.equal(ingest.status, 202);
    const ingested = await ingest.json();
    assert.equal(ingested.event.state, "ROUTED");
    assert.equal(ingested.work_item.workflow_stage, "ORDER_RECEIVED");
    assert.equal(ingested.work_item.next_action, "acknowledge-order");

    const queueProjectionResponse = await fetch(`${base}/api/v1/operations/transactions?search=9301`);
    assert.equal(queueProjectionResponse.status, 200);
    const queueProjection = await queueProjectionResponse.json();
    assert.equal(queueProjection.queue.count, 1);
    assert.equal(queueProjection.queue.items[0].workflow_stage, "ORDER_RECEIVED");
    assert.equal(queueProjection.queue.items[0].next_action, "acknowledge-order");
    assert.equal(queueProjection.queue.items[0].workflow_state, "OPEN");

    const unsafe = await fetch(
      `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9301")}/transitions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "PICKED_UP",
          actor: { type: "human", id: "ops-test" }
        })
      }
    );
    assert.equal(unsafe.status, 409);

    const stages = [
      "ACKNOWLEDGED",
      "PREPARING",
      "READY_FOR_COURIER"
    ];
    for (const stage of stages) {
      const response = await fetch(
        `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9301")}/transitions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            stage,
            actor: { type: "human", id: "ops-test" }
          })
        }
      );
      assert.equal(response.status, 200);
    }

    const missingCourier = await fetch(
      `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9301")}/transitions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "COURIER_ASSIGNED",
          actor: { type: "human", id: "ops-test" }
        })
      }
    );
    assert.equal(missingCourier.status, 400);

    const assignment = await fetch(
      `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9301")}/transitions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "COURIER_ASSIGNED",
          courier: { id: "courier-test-1", name: "Courier Test" },
          actor: { type: "human", id: "ops-test" }
        })
      }
    );
    assert.equal(assignment.status, 200);
    const assignedBody = await assignment.json();
    assert.equal(assignedBody.work_item.dispatch_status, "AWAITING_ACCEPTANCE");
    assert.equal(assignedBody.work_item.courier.name, "Courier Test");
    assert.ok(assignedBody.work_item.courier_assigned_at);

    const prematurePickup = await fetch(
      `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9301")}/transitions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "PICKED_UP",
          actor: { type: "human", id: "ops-test" }
        })
      }
    );
    assert.equal(prematurePickup.status, 409);

    for (const stage of ["COURIER_ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED"]) {
      const response = await fetch(
        `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9301")}/transitions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            stage,
            actor: { type: "human", id: "ops-test" }
          })
        }
      );
      assert.equal(response.status, 200);
    }

    const transactionResponse = await fetch(
      `${base}/api/v1/operations/transactions/${encodeURIComponent("woocommerce:order:9301")}`
    );
    const transaction = (await transactionResponse.json()).transaction;
    assert.equal(transaction.counts.work_items, 1);
    assert.equal(transaction.work_items[0].workflow_stage, "COMPLETED");
    assert.equal(transaction.work_items[0].state, "COMPLETED");
    assert.equal(transaction.work_items[0].dispatch_status, "DELIVERED");
    assert.equal(transaction.work_items[0].courier.id, "courier-test-1");
    assert.ok(transaction.work_items[0].courier_accepted_at);
    assert.ok(transaction.work_items[0].picked_up_at);
    assert.ok(transaction.work_items[0].delivered_at);

    const evidenceResponse = await fetch(
      `${base}/api/v1/evidence?correlation_id=${encodeURIComponent("woocommerce:order:9301")}`
    );
    const evidence = (await evidenceResponse.json()).evidence;
    const transitions = evidence.filter((record) => record.action === "commerce.workflow.transitioned");
    assert.equal(transitions.length, 8);
  }, {
    K8_WOOCOMMERCE_WEBHOOK_SECRET: "woo-test-secret",
    K8_WOOCOMMERCE_CLIENT_NAME: "Petals to the Metal",
    K8_WOOCOMMERCE_CLIENT_ID: "client_pttm",
    K8_WOOCOMMERCE_PROJECT_ID: "project_pttm_commerce"
  });
});


test("PTTM courier mobile token exposes only assigned job and drives accept pickup deliver", async () => {
  await withServer(async ({ base }) => {
    const secret = "woo-test-secret";
    const order = {
      id: 9401,
      number: "9401",
      status: "pending",
      currency: "AUD",
      total: "145.00",
      customer_id: 901,
      date_created_gmt: "2026-10-03T02:00:00Z",
      date_modified_gmt: "2026-10-03T02:01:00Z",
      billing: { first_name: "Delivery", last_name: "Customer" },
      shipping: {
        first_name: "Delivery",
        last_name: "Customer",
        address_1: "10 Test Street",
        city: "Beaudesert",
        state: "QLD",
        postcode: "4285",
        country: "AU"
      },
      line_items: [{ product_id: 601, name: "Courier Test Flowers", quantity: 1, total: "145.00" }]
    };

    const raw = JSON.stringify(order);
    const signature = crypto.createHmac("sha256", secret).update(raw).digest("base64");
    const ingest = await fetch(`${base}/api/v1/ingress/woocommerce/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-wc-webhook-signature": signature,
        "x-wc-webhook-topic": "order.created",
        "x-wc-webhook-resource": "order"
      },
      body: raw
    });
    assert.equal(ingest.status, 202);

    for (const stage of ["ACKNOWLEDGED", "PREPARING", "READY_FOR_COURIER"]) {
      const response = await fetch(
        `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9401")}/transitions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            stage,
            actor: { type: "human", id: "ops-test" }
          })
        }
      );
      assert.equal(response.status, 200);
    }

    const assignment = await fetch(
      `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9401")}/transitions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "COURIER_ASSIGNED",
          courier: { id: "courier-mobile-1", name: "Mobile Courier" },
          actor: { type: "human", id: "ops-test" }
        })
      }
    );
    assert.equal(assignment.status, 200);
    const assigned = await assignment.json();
    assert.ok(assigned.courier_access_token);
    assert.equal(assigned.work_item.courier.name, "Mobile Courier");

    const noToken = await fetch(
      `${base}/api/v1/courier/jobs/${encodeURIComponent("woocommerce:order:9401")}`
    );
    assert.equal(noToken.status, 401);

    const auth = { authorization: `Bearer ${assigned.courier_access_token}` };
    const jobResponse = await fetch(
      `${base}/api/v1/courier/jobs/${encodeURIComponent("woocommerce:order:9401")}`,
      { headers: auth }
    );
    assert.equal(jobResponse.status, 200);
    const job = (await jobResponse.json()).job;
    assert.equal(job.order_reference, "Order #9401");
    assert.equal(job.courier.id, "courier-mobile-1");
    assert.equal(job.delivery_destination.address_1, "10 Test Street");
    assert.equal(job.delivery_destination.postcode, "4285");
    assert.equal(job.workflow_stage, "COURIER_ASSIGNED");
    assert.equal(job.courier_access_hash, undefined);

    for (const action of ["accept", "pickup", "deliver"]) {
      const response = await fetch(
        `${base}/api/v1/courier/jobs/${encodeURIComponent("woocommerce:order:9401")}/${action}`,
        { method: "POST", headers: auth }
      );
      assert.equal(response.status, 200);
    }

    const finalJobResponse = await fetch(
      `${base}/api/v1/courier/jobs/${encodeURIComponent("woocommerce:order:9401")}`,
      { headers: auth }
    );
    const finalJob = (await finalJobResponse.json()).job;
    assert.equal(finalJob.workflow_stage, "DELIVERED");
    assert.equal(finalJob.dispatch_status, "DELIVERED");
    assert.ok(finalJob.courier_accepted_at);
    assert.ok(finalJob.picked_up_at);
    assert.ok(finalJob.delivered_at);
  }, {
    K8_WOOCOMMERCE_WEBHOOK_SECRET: "woo-test-secret",
    K8_WOOCOMMERCE_CLIENT_NAME: "Petals to the Metal",
    K8_WOOCOMMERCE_CLIENT_ID: "client_pttm",
    K8_WOOCOMMERCE_PROJECT_ID: "project_pttm_commerce"
  });
});


test("PTTM customer tracking exposes only safe milestones using Woo order key", async () => {
  await withServer(async ({ base }) => {
    const secret = "woo-test-secret";
    const order = {
      id: 9501,
      number: "9501",
      order_key: "wc_order_customer_tracking_9501",
      status: "pending",
      currency: "AUD",
      total: "155.00",
      customer_id: 1001,
      date_created_gmt: "2026-10-03T03:00:00Z",
      date_modified_gmt: "2026-10-03T03:01:00Z",
      billing: { first_name: "Tracking", last_name: "Customer" },
      shipping: {
        first_name: "Tracking",
        last_name: "Customer",
        address_1: "20 Private Street",
        city: "Beaudesert",
        state: "QLD",
        postcode: "4285",
        country: "AU"
      },
      line_items: [{ product_id: 701, name: "Customer Tracking Flowers", quantity: 1, total: "155.00" }]
    };

    const raw = JSON.stringify(order);
    const signature = crypto.createHmac("sha256", secret).update(raw).digest("base64");
    const ingest = await fetch(`${base}/api/v1/ingress/woocommerce/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-wc-webhook-signature": signature,
        "x-wc-webhook-topic": "order.created",
        "x-wc-webhook-resource": "order"
      },
      body: raw
    });
    assert.equal(ingest.status, 202);

    const endpoint = `${base}/api/v1/customer/orders/9501/status`;
    assert.equal((await fetch(endpoint)).status, 401);
    assert.equal((await fetch(endpoint, {
      headers: { authorization: "Bearer wrong-order-key" }
    })).status, 401);

    const auth = { authorization: "Bearer wc_order_customer_tracking_9501" };
    let response = await fetch(endpoint, { headers: auth });
    assert.equal(response.status, 200);
    let customer = (await response.json()).status;
    assert.equal(customer.order_reference, "Order #9501");
    assert.equal(customer.milestone.code, "ORDER_RECEIVED");
    assert.equal(customer.milestone.step, 1);
    assert.equal(customer.delivery_destination, undefined);
    assert.equal(customer.courier, undefined);
    assert.equal(customer.workflow_stage, undefined);
    assert.equal(customer.evidence, undefined);

    for (const stage of ["ACKNOWLEDGED", "PREPARING"]) {
      const transition = await fetch(
        `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9501")}/transitions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stage, actor: { type: "human", id: "ops-test" } })
        }
      );
      assert.equal(transition.status, 200);
    }

    response = await fetch(endpoint, { headers: auth });
    customer = (await response.json()).status;
    assert.equal(customer.milestone.code, "PREPARING");
    assert.equal(customer.milestone.step, 2);

    for (const stage of ["READY_FOR_COURIER"]) {
      const transition = await fetch(
        `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9501")}/transitions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stage, actor: { type: "human", id: "ops-test" } })
        }
      );
      assert.equal(transition.status, 200);
    }

    const assignment = await fetch(
      `${base}/api/v1/commerce/transactions/${encodeURIComponent("woocommerce:order:9501")}/transitions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "COURIER_ASSIGNED",
          courier: { id: "customer-track-courier", name: "Private Courier" },
          actor: { type: "human", id: "ops-test" }
        })
      }
    );
    assert.equal(assignment.status, 200);
    const token = (await assignment.json()).courier_access_token;

    for (const action of ["accept", "pickup"]) {
      const courierResponse = await fetch(
        `${base}/api/v1/courier/jobs/${encodeURIComponent("woocommerce:order:9501")}/${action}`,
        { method: "POST", headers: { authorization: `Bearer ${token}` } }
      );
      assert.equal(courierResponse.status, 200);
    }

    response = await fetch(endpoint, { headers: auth });
    customer = (await response.json()).status;
    assert.equal(customer.milestone.code, "WITH_COURIER");
    assert.equal(customer.milestone.step, 3);

    const delivered = await fetch(
      `${base}/api/v1/courier/jobs/${encodeURIComponent("woocommerce:order:9501")}/deliver`,
      { method: "POST", headers: { authorization: `Bearer ${token}` } }
    );
    assert.equal(delivered.status, 200);

    response = await fetch(endpoint, { headers: auth });
    customer = (await response.json()).status;
    assert.equal(customer.milestone.code, "DELIVERED");
    assert.equal(customer.milestone.step, 4);
    assert.ok(customer.delivered_at);
  }, {
    K8_WOOCOMMERCE_WEBHOOK_SECRET: "woo-test-secret",
    K8_WOOCOMMERCE_CLIENT_NAME: "Petals to the Metal",
    K8_WOOCOMMERCE_CLIENT_ID: "client_pttm",
    K8_WOOCOMMERCE_PROJECT_ID: "project_pttm_commerce"
  });
});
