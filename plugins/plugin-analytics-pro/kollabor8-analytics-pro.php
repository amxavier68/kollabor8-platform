<?php
/**
 * Plugin Name: Kollabor8 Analytics Pro
 * Version: 2.0.0
 * Requires PHP: 7.4
 * API Version: v2
 */

require_once plugin_dir_path(__FILE__) . 'vendor/kollabor8/php-sdk/ApiClient.php';

use Kollabor8\SDK\ApiClient;

class Kollabor8_Analytics_Pro {
    private $apiClient;
    
    public function __construct() {
        $this->initApiClient();
        $this->initHooks();
    }
    
    private function initApiClient() {
        $apiVersion = get_option('kollabor8_analytics_api_version', 'v2');
        
        $this->apiClient = new ApiClient([
            'base_url' => $this->getApiBaseUrl(),
            'api_version' => $apiVersion,  // ⭐ Version selection
            'api_key' => get_option('kollabor8_analytics_api_key'),
            'plugin_slug' => 'kollabor8-analytics-pro',
            'plugin_version' => '2.0.0'
        ]);
    }
    
    private function getApiBaseUrl() {
        // Allow override for development
        if (defined('KOLLABOR8_API_URL')) {
            return KOLLABOR8_API_URL;
        }
        
        return 'https://api.kollabor8.com';
    }
    
    private function initHooks() {
        add_action('admin_init', [$this, 'checkApiDeprecation']);
        add_action('admin_notices', [$this, 'showDeprecationNotice']);
    }
    
    public function checkApiDeprecation() {
        // Check for deprecation warning in transient
        $deprecation = get_transient('kollabor8_kollabor8-analytics-pro_api_deprecated');
        
        if ($deprecation && current_user_can('manage_options')) {
            // Store for admin notice
            update_option('kollabor8_analytics_deprecation_notice', $deprecation);
        }
    }
    
    public function showDeprecationNotice() {
        $notice = get_option('kollabor8_analytics_deprecation_notice');
        
        if ($notice && current_user_can('manage_options')) {
            ?>
            <div class="notice notice-warning is-dismissible">
                <h3>⚠️ Kollabor8 Analytics Pro - API Deprecation Warning</h3>
                <p>
                    You are using API version <strong><?php echo esc_html($notice['version']); ?></strong> 
                    which will be sunset on <strong><?php echo esc_html($notice['sunset_date']); ?></strong>
                    (<?php echo esc_html($notice['days_left']); ?> days remaining).
                </p>
                <p>
                    <a href="<?php echo esc_url($notice['migration_guide']); ?>" target="_blank" class="button button-primary">
                        View Migration Guide
                    </a>
                    <a href="<?php echo admin_url('admin.php?page=kollabor8-analytics-settings&tab=api'); ?>" class="button">
                        Update API Settings
                    </a>
                </p>
            </div>
            <?php
        }
    }
    
    public function sendEvent($eventData) {
        try {
            return $this->apiClient->sendTelemetry($eventData);
        } catch (\Exception $e) {
            error_log('[Kollabor8 Analytics] Failed to send event: ' . $e->getMessage());
            return false;
        }
    }
}

// Initialize
function kollabor8_analytics_pro_init() {
    return new Kollabor8_Analytics_Pro();
}
add_action('plugins_loaded', 'kollabor8_analytics_pro_init');