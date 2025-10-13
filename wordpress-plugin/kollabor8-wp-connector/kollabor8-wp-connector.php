<?php
/**
 * Plugin Name: Kollabor8 WP Connector
 * Plugin URI: https://kollabor8.com
 * Description: Connects WordPress with Kollabor8 platform backend
 * Version: 1.0.0
 * Author: Your Name
 * Author URI: https://kollabor8.com
 * License: GPL v2 or later
 * Text Domain: kollabor8-wp-connector
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('KOLLABOR8_VERSION', '1.0.0');
define('KOLLABOR8_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('KOLLABOR8_PLUGIN_URL', plugin_dir_url(__FILE__));

// Main plugin class
class Kollabor8_WP_Connector {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->init_hooks();
    }
    
    private function init_hooks() {
        // Add REST API endpoints
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        
        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Enqueue scripts
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
    }
    
    public function register_rest_routes() {
        register_rest_route('kollabor8/v1', '/sync', array(
            'methods' => 'POST',
            'callback' => array($this, 'sync_with_backend'),
            'permission_callback' => array($this, 'check_api_permission')
        ));
    }
    
    public function sync_with_backend($request) {
        // Sync logic with Node.js backend
        $backend_url = get_option('kollabor8_backend_url', 'http://localhost:5000');
        
        $response = wp_remote_post($backend_url . '/api/wordpress/sync', array(
            'body' => json_encode($request->get_params()),
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key' => get_option('kollabor8_api_key')
            )
        ));
        
        return rest_ensure_response($response);
    }
    
    public function check_api_permission() {
        return current_user_can('manage_options');
    }
    
    public function add_admin_menu() {
        add_menu_page(
            'Kollabor8 Settings',
            'Kollabor8',
            'manage_options',
            'kollabor8-settings',
            array($this, 'render_settings_page'),
            'dashicons-admin-generic',
            100
        );
    }
    
    public function render_settings_page() {
        include KOLLABOR8_PLUGIN_DIR . 'includes/admin-settings.php';
    }
    
    public function enqueue_scripts() {
        wp_enqueue_script(
            'kollabor8-main',
            KOLLABOR8_PLUGIN_URL . 'assets/js/main.js',
            array('jquery'),
            KOLLABOR8_VERSION,
            true
        );
        
        wp_localize_script('kollabor8-main', 'kollabor8', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('kollabor8-nonce')
        ));
    }
}

// Initialize plugin
function kollabor8_init() {
    return Kollabor8_WP_Connector::get_instance();
}

// Start plugin
add_action('plugins_loaded', 'kollabor8_init');

// Activation hook
register_activation_hook(__FILE__, 'kollabor8_activate');
function kollabor8_activate() {
    // Activation logic
    flush_rewrite_rules();
}

// Deactivation hook
register_deactivation_hook(__FILE__, 'kollabor8_deactivate');
function kollabor8_deactivate() {
    // Deactivation logic
    flush_rewrite_rules();
}