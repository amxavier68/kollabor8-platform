import crypto from "node:crypto";

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function customerName(order) {
  const billing = order.billing ?? {};
  const full = [billing.first_name, billing.last_name].map((v) => text(v)).filter(Boolean).join(" ");
  return full || text(billing.company) || text(billing.email) || `Woo customer ${order.customer_id ?? order.id ?? "unknown"}`;
}

function itemSummary(order) {
  const items = Array.isArray(order.line_items) ? order.line_items : [];
  if (!items.length) return "WooCommerce order";
  const names = items.slice(0, 3).map((item) => text(item.name)).filter(Boolean);
  const extra = items.length > 3 ? ` +${items.length - 3} more` : "";
  return names.length ? `${names.join(", ")}${extra}` : "WooCommerce order";
}

function normalisedStatus(status) {
  return text(status, "pending").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function iso(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function equalBase64(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

export class WooCommerceIngressService {
  constructor(events, env = process.env) {
    this.events = events;
    this.env = env;
  }

  configured() {
    return Boolean(this.env.K8_WOOCOMMERCE_WEBHOOK_SECRET);
  }

  verify(rawBody, suppliedSignature) {
    const secret = this.env.K8_WOOCOMMERCE_WEBHOOK_SECRET;
    if (!secret || !rawBody || !suppliedSignature) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
    return equalBase64(expected, suppliedSignature);
  }

  async ingestWebhook({ rawBody, signature, topic, resourceId, order }) {
    if (!this.configured()) return { type: "disabled" };
    if (!this.verify(rawBody, signature)) return { type: "unauthorised" };
    return this.ingestOrder(order, { topic, resourceId });
  }

  async ingestOrder(order = {}, webhook = {}) {
    if (!order.id) return { type: "invalid", error: "woocommerce_order_id_required" };

    const now = new Date().toISOString();
    const status = normalisedStatus(order.status);
    const orderId = String(order.id);
    const orderNumber = text(order.number, orderId);
    const modified = iso(order.date_modified_gmt ?? order.date_modified, now);
    const eventId = `evt_woo_${orderId}_${crypto.createHash("sha1").update(`${status}:${modified}`).digest("hex").slice(0, 12)}`;

    const event = {
      event_id: eventId,
      event_name: "commerce.order.observed",
      version: 1,
      organisation_id: this.env.K8_WOOCOMMERCE_ORGANISATION_ID ?? "org_kollabor8",
      client_id: this.env.K8_WOOCOMMERCE_CLIENT_ID ?? "client_pttm",
      project_id: this.env.K8_WOOCOMMERCE_PROJECT_ID ?? "project_pttm_commerce",
      occurred_at: iso(order.date_modified_gmt ?? order.date_modified ?? order.date_created_gmt ?? order.date_created, now),
      received_at: now,
      source: {
        type: "woocommerce",
        id: this.env.K8_WOOCOMMERCE_STORE_ID ?? "pttm-woocommerce",
        mode: "webhook"
      },
      actor: { type: "service", id: "woocommerce-webhook-adapter" },
      subject: { type: "order", id: orderId },
      correlation_id: `woocommerce:order:${orderId}`,
      causation_id: null,
      trace_id: null,
      environment: this.env.K8_ENVIRONMENT ?? "staging",
      payload: {
        order_id: order.id,
        order_number: orderNumber,
        status,
        currency: order.currency ?? null,
        total: order.total ?? null,
        payment_method: order.payment_method_title ?? order.payment_method ?? null,
        shipping_method: Array.isArray(order.shipping_lines)
          ? order.shipping_lines.map((line) => line.method_title ?? line.method_id).filter(Boolean)
          : [],
        delivery: (() => {
          const shipping = order.shipping ?? {};
          const billing = order.billing ?? {};
          const source = Object.values(shipping).some(Boolean) ? shipping : billing;
          return {
            recipient_name: [source.first_name, source.last_name].map((v) => text(v)).filter(Boolean).join(" ") || customerName(order),
            company: text(source.company) || null,
            address_1: text(source.address_1) || null,
            address_2: text(source.address_2) || null,
            city: text(source.city) || null,
            state: text(source.state) || null,
            postcode: text(source.postcode) || null,
            country: text(source.country) || null
          };
        })(),
        line_items: Array.isArray(order.line_items)
          ? order.line_items.map((item) => ({
              product_id: item.product_id ?? null,
              variation_id: item.variation_id ?? null,
              name: item.name ?? null,
              quantity: item.quantity ?? null,
              total: item.total ?? null
            }))
          : []
      },
      metadata: {
        adapter: "woocommerce-webhook-v1",
        webhook_topic: webhook.topic ?? null,
        webhook_resource_id: webhook.resourceId ?? null
      },
      service_context: {
        party_type: "customer",
        client_name: this.env.K8_WOOCOMMERCE_CLIENT_NAME ?? "Petals to the Metal",
        party_id: order.customer_id ? `woo_customer_${order.customer_id}` : `woo_guest_order_${orderId}`,
        display_name: customerName(order),
        request_type: "Floral order",
        request_reference: `Order #${orderNumber}`,
        summary: `${itemSummary(order)} · ${status}`,
        channel: "woocommerce",
        priority: "normal",
        sla_due_at: null,
        workflow_status: status
      },
      sensitivity: "confidential",
      retention_class: "operational",
      idempotency_key: `woocommerce:order:${orderId}:${status}:${modified}`
    };

    return this.events.ingest(event);
  }
}
