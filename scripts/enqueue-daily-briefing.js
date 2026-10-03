const baseUrl = process.env.K8_PLATFORM_URL;
const apiKey = process.env.K8_API_KEY;
const organisationId = process.env.K8_ORGANISATION_ID ?? "org_kollabor8";

if (!baseUrl) throw new Error("K8_PLATFORM_URL_REQUIRED");
if (!apiKey) throw new Error("K8_API_KEY_REQUIRED");

const now = new Date();
const brisbaneParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Brisbane",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short"
}).formatToParts(now);

const part = (type) => brisbaneParts.find((item) => item.type === type)?.value;
const localDate = `${part("year")}-${part("month")}-${part("day")}`;
const weekday = part("weekday");
const mondayCatchup = weekday === "Mon";

const event = {
  event_id: `evt_briefing_${localDate}`,
  event_name: "briefing.schedule.due",
  version: 1,
  organisation_id: organisationId,
  client_id: null,
  project_id: "k8-daily-intelligence-briefing",
  occurred_at: now.toISOString(),
  received_at: now.toISOString(),
  source: { type: "scheduler", id: "render-cron.daily-intelligence" },
  actor: { type: "service", id: "k8-scheduler" },
  subject: { type: "workflow", id: "daily-intelligence-briefing" },
  correlation_id: `briefing:${localDate}`,
  causation_id: null,
  trace_id: null,
  environment: process.env.K8_ENVIRONMENT ?? "staging",
  payload: {
    local_date: localDate,
    timezone: "Australia/Brisbane",
    monday_weekend_catchup: mondayCatchup,
    part_1_item_count: 5
  },
  metadata: {
    cadence: "weekdays-0600-australia-brisbane"
  },
  sensitivity: "internal",
  retention_class: "operational",
  idempotency_key: `daily-intelligence:${localDate}`
};

const response = await fetch(new URL("/api/v1/events", baseUrl), {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-k8-api-key": apiKey
  },
  body: JSON.stringify(event)
});

const body = await response.text();
if (!response.ok) {
  throw new Error(`Pulse enqueue failed (${response.status}): ${body}`);
}

console.log(JSON.stringify({
  ok: true,
  status: response.status,
  local_date: localDate,
  monday_weekend_catchup: mondayCatchup,
  result: JSON.parse(body)
}));
