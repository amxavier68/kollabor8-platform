import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { MemoryStore } from "../src/storage/memory-store.js";

async function withServer(fn) {
  const store = new MemoryStore();
  await store.init();
  const app = createApp(store, { NODE_ENV: "test", K8_ENVIRONMENT: "test", AUTH_DISABLED: "true", ALLOW_EPHEMERAL_MUTATIONS: "true" });
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
