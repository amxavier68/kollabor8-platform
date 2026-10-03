<?php
/**
 * Plugin Name: PTTM PBAC Shop Access
 * Description: Policy-based WordPress/WooCommerce access for Petals to the Metal shop operators.
 * Version: 0.1.0
 * Author: Kollabor8 Web Collectives
 */

if (!defined('ABSPATH')) exit;

define('PTTM_PBAC_ROLE', 'pttm_shop_operator');

function pttm_pbac_policy() {
    return array(
        'allowed' => array(
            'Products' => 'Create, edit, publish and update WooCommerce products and product categories.',
            'Orders' => 'View and update day-to-day WooCommerce orders and fulfilment statuses.',
            'Posts' => 'Create, edit, publish and update news/blog posts.',
            'Pages & Elementor' => 'Edit existing pages and create new content pages using the normal WordPress/Elementor editor.',
            'Media' => 'Upload and manage images and other media used by PTTM.',
            'Comments' => 'Moderate normal site comments where enabled.'
        ),
        'restricted' => array(
            'Plugins & themes' => 'Install, remove or change plugins/themes.',
            'Users & roles' => 'Create administrators, change roles or alter PBAC policy.',
            'Site-wide settings' => 'Change core WordPress, permalink, hosting or integration settings.',
            'Code & credentials' => 'Edit PHP/theme/plugin code or view K8/API credentials.',
            'K8 governance' => 'Change Pulse, Atlas, PBAC or infrastructure policy.'
        )
    );
}

function pttm_pbac_capabilities() {
    $caps = array(
        'read' => true,
        'upload_files' => true,

        'edit_posts' => true,
        'edit_others_posts' => true,
        'edit_published_posts' => true,
        'publish_posts' => true,
        'delete_posts' => true,
        'delete_published_posts' => true,

        'edit_pages' => true,
        'edit_others_pages' => true,
        'edit_published_pages' => true,
        'publish_pages' => true,
        'delete_pages' => true,
        'delete_published_pages' => true,

        'moderate_comments' => true,

        'edit_products' => true,
        'edit_others_products' => true,
        'edit_published_products' => true,
        'publish_products' => true,
        'delete_products' => true,
        'delete_published_products' => true,
        'read_private_products' => true,
        'manage_product_terms' => true,
        'edit_product_terms' => true,
        'delete_product_terms' => true,
        'assign_product_terms' => true,

        'edit_shop_orders' => true,
        'edit_others_shop_orders' => true,
        'edit_published_shop_orders' => true,
        'read_private_shop_orders' => true,
        'publish_shop_orders' => true,

        'view_woocommerce_reports' => true
    );

    $deny = array(
        'activate_plugins','install_plugins','update_plugins','delete_plugins','edit_plugins',
        'switch_themes','install_themes','update_themes','delete_themes','edit_themes',
        'edit_users','create_users','delete_users','promote_users','list_users',
        'manage_options','update_core','edit_files','unfiltered_html','manage_network'
    );
    foreach ($deny as $cap) $caps[$cap] = false;
    return $caps;
}

function pttm_pbac_activate() {
    $role = get_role(PTTM_PBAC_ROLE);
    if (!$role) {
        $role = add_role(PTTM_PBAC_ROLE, 'PTTM Shop Operator', pttm_pbac_capabilities());
    } else {
        foreach (pttm_pbac_capabilities() as $cap => $grant) {
            if ($grant) $role->add_cap($cap); else $role->remove_cap($cap);
        }
    }
}
register_activation_hook(__FILE__, 'pttm_pbac_activate');

function pttm_pbac_login_styles() { ?>
<style>
body.login{background:#f5f1e7}
#login{width:min(92vw,460px)}
.login h1 a{background-image:none!important;width:auto;height:auto;text-indent:0;font:700 30px/1.15 Georgia,serif;color:#2f3b2f}
.login h1 a:after{content:"Petals to the Metal";display:block}
.pttm-pbac-login-card{background:#fff;border:1px solid #d9d1c2;border-radius:14px;padding:18px 20px;margin:0 0 18px;box-shadow:0 4px 18px rgba(0,0,0,.05);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#334033}
.pttm-pbac-login-card h2{margin:0 0 8px;font:700 22px/1.2 Georgia,serif}
.pttm-pbac-login-card ul{margin:10px 0 0 20px}
.pttm-pbac-login-card .muted{color:#667066;font-size:13px}
</style>
<?php }
add_action('login_enqueue_scripts', 'pttm_pbac_login_styles');

function pttm_pbac_login_message($message) {
    $policy = pttm_pbac_policy();
    $allowed = array_keys($policy['allowed']);
    $html = '<div class="pttm-pbac-login-card"><h2>PTTM Shop Workspace</h2>';
    $html .= '<p>Sign in to manage day-to-day Petals to the Metal content and shop operations.</p><ul>';
    foreach ($allowed as $label) $html .= '<li>' . esc_html($label) . '</li>';
    $html .= '</ul><p class="muted">Platform administration, plugins, themes, users and K8 governance remain owner-controlled.</p></div>';
    return $html . $message;
}
add_filter('login_message', 'pttm_pbac_login_message');

function pttm_pbac_admin_menu() {
    add_menu_page(
        'PTTM Workspace',
        'PTTM Workspace',
        'read',
        'pttm-workspace',
        'pttm_pbac_workspace_page',
        'dashicons-store',
        2
    );
}
add_action('admin_menu', 'pttm_pbac_admin_menu');

function pttm_pbac_workspace_page() {
    if (!current_user_can('read')) return;
    $policy = pttm_pbac_policy();
    ?>
    <div class="wrap">
      <h1>PTTM Workspace</h1>
      <p style="font-size:16px;max-width:900px">This workspace shows what your PTTM access allows. You can run normal shop and content work without needing owner/admin access.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;max-width:1100px;margin-top:20px">
        <div style="background:#fff;border:1px solid #cfd8cf;border-radius:12px;padding:20px">
          <h2>What you can do</h2>
          <?php foreach ($policy['allowed'] as $title => $desc): ?>
            <h3 style="margin-bottom:4px"><?php echo esc_html($title); ?></h3>
            <p style="margin-top:0"><?php echo esc_html($desc); ?></p>
          <?php endforeach; ?>
        </div>
        <div style="background:#fff;border:1px solid #e0d5d5;border-radius:12px;padding:20px">
          <h2>Owner/admin controlled</h2>
          <?php foreach ($policy['restricted'] as $title => $desc): ?>
            <h3 style="margin-bottom:4px"><?php echo esc_html($title); ?></h3>
            <p style="margin-top:0"><?php echo esc_html($desc); ?></p>
          <?php endforeach; ?>
        </div>
      </div>
      <h2 style="margin-top:28px">Quick actions</h2>
      <p>
        <?php if (current_user_can('edit_products')): ?><a class="button button-primary" href="<?php echo esc_url(admin_url('post-new.php?post_type=product')); ?>">Add product</a><?php endif; ?>
        <?php if (current_user_can('edit_posts')): ?><a class="button" href="<?php echo esc_url(admin_url('post-new.php')); ?>">Add post</a><?php endif; ?>
        <?php if (current_user_can('edit_pages')): ?><a class="button" href="<?php echo esc_url(admin_url('post-new.php?post_type=page')); ?>">Add page</a><?php endif; ?>
        <?php if (current_user_can('upload_files')): ?><a class="button" href="<?php echo esc_url(admin_url('media-new.php')); ?>">Upload media</a><?php endif; ?>
        <?php if (current_user_can('edit_shop_orders')): ?><a class="button" href="<?php echo esc_url(admin_url('edit.php?post_type=shop_order')); ?>">View orders</a><?php endif; ?>
      </p>
    </div>
    <?php
}

function pttm_pbac_login_redirect($redirect_to, $requested_redirect_to, $user) {
    if ($user instanceof WP_User && in_array(PTTM_PBAC_ROLE, (array) $user->roles, true)) {
        return admin_url('admin.php?page=pttm-workspace');
    }
    return $redirect_to;
}
add_filter('login_redirect', 'pttm_pbac_login_redirect', 10, 3);

function pttm_pbac_hide_admin_menus() {
    if (!current_user_can('manage_options') && current_user_can('read')) {
        remove_menu_page('plugins.php');
        remove_menu_page('themes.php');
        remove_menu_page('users.php');
        remove_menu_page('tools.php');
        remove_menu_page('options-general.php');
    }
}
add_action('admin_menu', 'pttm_pbac_hide_admin_menus', 999);

function pttm_pbac_block_admin_routes() {
    if (!is_admin() || current_user_can('manage_options')) return;
    $blocked = array('plugins.php','plugin-install.php','themes.php','theme-install.php','users.php','user-new.php','options-general.php','update-core.php');
    $script = isset($_SERVER['PHP_SELF']) ? basename(sanitize_text_field(wp_unslash($_SERVER['PHP_SELF']))) : '';
    if (in_array($script, $blocked, true)) {
        wp_safe_redirect(admin_url('admin.php?page=pttm-workspace'));
        exit;
    }
}
add_action('admin_init', 'pttm_pbac_block_admin_routes');

function pttm_pbac_role_label($translated, $text, $domain) {
    return $translated;
}
