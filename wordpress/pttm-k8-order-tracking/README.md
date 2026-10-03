# PTTM K8 Order Tracking

WordPress/WooCommerce integration for the customer-facing Petals to the Metal delivery status page.

## Page setup

1. Install and activate the `PTTM K8 Order Tracking` plugin.
2. Create a WordPress page with slug `track-your-order`.
3. In Elementor, keep the normal PTTM header/footer and place a Shortcode widget in the page content.
4. Shortcode:

`[pttm_order_tracking]`

The shortcode renders the full tracking component and is responsive.

## Customer flow

WooCommerce customer emails receive a **Track your order** button. The URL carries the Woo order ID and Woo order key to the PTTM WordPress page.

WordPress calls K8 server-side. K8 stores only a SHA-256 hash of the Woo order key and returns only:

- order reference
- customer-safe milestone
- progress steps
- updated timestamp
- delivered timestamp when available

It does not return Pulse state, Atlas evidence, courier identity, internal exceptions, operational notes, payment data or delivery address.

## Customer milestones

K8 operational stages are intentionally compressed:

- ORDER_RECEIVED / ACKNOWLEDGED -> Order received
- PREPARING / READY_FOR_COURIER / COURIER_ASSIGNED / COURIER_ACCEPTED -> Preparing
- PICKED_UP -> With courier
- DELIVERED / COMPLETED -> Delivered
- EXCEPTION -> We're checking your order
- CANCELLED -> Cancelled
- REFUNDED -> Refunded

## Staging API

The plugin currently points to:

`https://k8-platform-foundation-staging.onrender.com/api/v1/customer/orders`

Change `PTTM_K8_TRACKING_API` when promoting K8 to production.

## Design

The component uses the current PTTM design direction:

- Playfair Display headings
- Montserrat body text
- ivory/light background
- moss-green progress state
- minimum body text 14px, with primary customer copy at 17px
