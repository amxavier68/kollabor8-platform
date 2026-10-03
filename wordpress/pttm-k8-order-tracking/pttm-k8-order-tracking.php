<?php
/**
 * Plugin Name: PTTM K8 Order Tracking
 * Description: Customer-facing Petals to the Metal order tracking powered by K8.
 * Version: 0.1.0
 * Author: Kollabor8 Web Collectives
 */

if (!defined('ABSPATH')) {
    exit;
}

define('PTTM_K8_TRACKING_API', 'https://k8-platform-foundation-staging.onrender.com/api/v1/customer/orders');

function pttm_k8_tracking_page_url() {
    return apply_filters('pttm_k8_tracking_page_url', home_url('/track-your-order/'));
}

function pttm_k8_tracking_url_for_order($order) {
    if (!$order instanceof WC_Order) {
        return '';
    }

    return add_query_arg(
        array(
            'order' => $order->get_id(),
            'key'   => $order->get_order_key(),
        ),
        pttm_k8_tracking_page_url()
    );
}

function pttm_k8_fetch_tracking_status($order_id, $order_key) {
    $endpoint = trailingslashit(PTTM_K8_TRACKING_API) . rawurlencode((string) $order_id) . '/status';

    $response = wp_remote_get(
        $endpoint,
        array(
            'timeout' => 8,
            'headers' => array(
                'Authorization' => 'Bearer ' . $order_key,
                'Accept'        => 'application/json',
            ),
        )
    );

    if (is_wp_error($response)) {
        return new WP_Error('tracking_unavailable', 'Order tracking is temporarily unavailable.');
    }

    $status_code = wp_remote_retrieve_response_code($response);
    if ($status_code === 401 || $status_code === 404) {
        return new WP_Error('tracking_not_found', 'We could not verify that order tracking link.');
    }
    if ($status_code !== 200) {
        return new WP_Error('tracking_unavailable', 'Order tracking is temporarily unavailable.');
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($body) || empty($body['status']['milestone'])) {
        return new WP_Error('tracking_invalid', 'Order tracking is temporarily unavailable.');
    }

    return $body['status'];
}

function pttm_k8_tracking_shortcode() {
    $order_id  = isset($_GET['order']) ? absint($_GET['order']) : 0;
    $order_key = isset($_GET['key']) ? sanitize_text_field(wp_unslash($_GET['key'])) : '';

    ob_start();
    ?>
    <section class="pttm-k8-track" aria-labelledby="pttm-k8-track-title">
        <div class="pttm-k8-track__inner">
            <p class="pttm-k8-track__eyebrow">PETALS TO THE METAL</p>
            <h1 id="pttm-k8-track-title">Track your order</h1>
            <?php
            if (!$order_id || !$order_key) {
                ?>
                <div class="pttm-k8-track__message">
                    <p>Please use the secure tracking link in your Petals to the Metal order email.</p>
                </div>
                <?php
            } else {
                $status = pttm_k8_fetch_tracking_status($order_id, $order_key);

                if (is_wp_error($status)) {
                    ?>
                    <div class="pttm-k8-track__message pttm-k8-track__message--error">
                        <p><?php echo esc_html($status->get_error_message()); ?></p>
                    </div>
                    <?php
                } else {
                    $milestone = $status['milestone'];
                    $step = isset($milestone['step']) ? (int) $milestone['step'] : 1;
                    $is_terminal_exception = in_array($milestone['code'], array('CANCELLED', 'REFUNDED'), true);
                    $stages = isset($status['stages']) && is_array($status['stages']) ? $status['stages'] : array();
                    ?>
                    <div class="pttm-k8-track__order">
                        <span>Order</span>
                        <strong><?php echo esc_html($status['order_reference'] ?? ('#' . $order_id)); ?></strong>
                    </div>

                    <div class="pttm-k8-track__current">
                        <p class="pttm-k8-track__label">Current status</p>
                        <p class="pttm-k8-track__status"><?php echo esc_html($milestone['label']); ?></p>
                        <?php if (!empty($status['updated_at'])) : ?>
                            <p class="pttm-k8-track__updated">
                                Updated <?php echo esc_html(wp_date('j M Y, g:i a', strtotime($status['updated_at']))); ?>
                            </p>
                        <?php endif; ?>
                    </div>

                    <?php if (!$is_terminal_exception) : ?>
                        <ol class="pttm-k8-track__steps" aria-label="Order progress">
                            <?php foreach ($stages as $stage) :
                                $stage_step = isset($stage['step']) ? (int) $stage['step'] : 0;
                                $class = $stage_step < $step ? 'is-complete' : ($stage_step === $step ? 'is-current' : '');
                                ?>
                                <li class="<?php echo esc_attr($class); ?>">
                                    <span class="pttm-k8-track__dot" aria-hidden="true"></span>
                                    <span><?php echo esc_html($stage['label']); ?></span>
                                </li>
                            <?php endforeach; ?>
                        </ol>
                    <?php endif; ?>

                    <div class="pttm-k8-track__copy">
                        <?php
                        $copy = array(
                            'ORDER_RECEIVED' => 'We have your order and it is in our workflow.',
                            'PREPARING'      => 'Your flowers and gifts are being prepared for delivery.',
                            'WITH_COURIER'   => 'Your order has left us and is with the courier.',
                            'DELIVERED'      => 'Your delivery has been recorded as delivered.',
                            'CHECKING_ORDER' => 'We are checking something on your order. We will contact you if we need anything from you.',
                            'CANCELLED'      => 'This order has been recorded as cancelled.',
                            'REFUNDED'       => 'This order has been recorded as refunded.',
                        );
                        ?>
                        <p><?php echo esc_html($copy[$milestone['code']] ?? 'Your order is progressing through our delivery workflow.'); ?></p>
                    </div>
                    <?php
                }
            }
            ?>
        </div>
    </section>
    <style>
        .pttm-k8-track{padding:clamp(32px,6vw,72px) 20px;background:#faf8f2;color:#283329}
        .pttm-k8-track__inner{max-width:820px;margin:0 auto}
        .pttm-k8-track__eyebrow{margin:0 0 8px;font:700 13px/1.4 Montserrat,Arial,sans-serif;letter-spacing:.16em}
        .pttm-k8-track h1{margin:0 0 28px;font:700 clamp(34px,6vw,58px)/1.08 "Playfair Display",Georgia,serif}
        .pttm-k8-track__order,.pttm-k8-track__current,.pttm-k8-track__message,.pttm-k8-track__copy{background:#fff;border:1px solid #ddd8cc;border-radius:16px;padding:20px;margin-top:16px}
        .pttm-k8-track__order{display:flex;justify-content:space-between;gap:20px;font:600 17px/1.5 Montserrat,Arial,sans-serif}
        .pttm-k8-track__label,.pttm-k8-track__updated{margin:0;font:600 14px/1.5 Montserrat,Arial,sans-serif;color:#657066}
        .pttm-k8-track__status{margin:5px 0;font:700 30px/1.2 "Playfair Display",Georgia,serif}
        .pttm-k8-track__steps{list-style:none;padding:0;margin:28px 0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
        .pttm-k8-track__steps li{position:relative;padding-top:28px;text-align:center;font:600 14px/1.35 Montserrat,Arial,sans-serif;color:#7b817b}
        .pttm-k8-track__steps li:before{content:"";position:absolute;top:8px;left:-50%;right:50%;height:3px;background:#ddd8cc}
        .pttm-k8-track__steps li:first-child:before{display:none}
        .pttm-k8-track__dot{position:absolute;top:1px;left:50%;width:17px;height:17px;border-radius:50%;transform:translateX(-50%);background:#ddd8cc;border:3px solid #faf8f2}
        .pttm-k8-track__steps .is-complete,.pttm-k8-track__steps .is-current{color:#283329}
        .pttm-k8-track__steps .is-complete:before,.pttm-k8-track__steps .is-current:before,.pttm-k8-track__steps .is-complete .pttm-k8-track__dot,.pttm-k8-track__steps .is-current .pttm-k8-track__dot{background:#66765a}
        .pttm-k8-track__steps .is-current .pttm-k8-track__dot{box-shadow:0 0 0 5px rgba(102,118,90,.14)}
        .pttm-k8-track__copy p,.pttm-k8-track__message p{margin:0;font:400 17px/1.65 Montserrat,Arial,sans-serif}
        .pttm-k8-track__message--error{border-color:#d7b9b9}
        @media(max-width:640px){.pttm-k8-track__steps{grid-template-columns:1fr;gap:0}.pttm-k8-track__steps li{text-align:left;padding:13px 0 13px 36px}.pttm-k8-track__steps li:before{top:-50%;bottom:50%;left:8px;right:auto;width:3px;height:auto}.pttm-k8-track__dot{top:50%;left:0;transform:translateY(-50%)}}
    </style>
    <?php
    return ob_get_clean();
}
add_shortcode('pttm_order_tracking', 'pttm_k8_tracking_shortcode');

function pttm_k8_email_tracking_link($order, $sent_to_admin, $plain_text, $email) {
    if ($sent_to_admin || !$order instanceof WC_Order) {
        return;
    }

    $url = pttm_k8_tracking_url_for_order($order);
    if (!$url) {
        return;
    }

    if ($plain_text) {
        echo "\nTrack your order: " . esc_url_raw($url) . "\n";
        return;
    }

    echo '<p style="margin:18px 0"><a href="' . esc_url($url) . '" style="display:inline-block;padding:12px 18px;background:#66765a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700">Track your order</a></p>';
}
add_action('woocommerce_email_after_order_table', 'pttm_k8_email_tracking_link', 20, 4);
