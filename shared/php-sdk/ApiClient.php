<?php
namespace Kollabor8\SDK;

class ApiClient {
    private $baseUrl;
    private $apiVersion;
    private $apiKey;
    private $pluginSlug;
    private $pluginVersion;
    
    const SUPPORTED_VERSIONS = ['v1', 'v2'];
    const DEFAULT_VERSION = 'v1';
    
    public function __construct($config) {
        $this->baseUrl = $config['base_url'] ?? 'https://api.kollabor8.com';
        $this->apiVersion = $config['api_version'] ?? self::DEFAULT_VERSION;
        $this->apiKey = $config['api_key'];
        $this->pluginSlug = $config['plugin_slug'];
        $this->pluginVersion = $config['plugin_version'];
        
        // Validate API version
        if (!in_array($this->apiVersion, self::SUPPORTED_VERSIONS)) {
            throw new \Exception("Unsupported API version: {$this->apiVersion}");
        }
    }
    
    /**
     * Validate license key
     */
    public function validateLicense($licenseKey, $domain) {
        $endpoint = "/api/{$this->apiVersion}/licenses/validate";
        
        $response = $this->request('POST', $endpoint, [
            'license_key' => $licenseKey,
            'domain' => $domain,
            'plugin_slug' => $this->pluginSlug,
            'plugin_version' => $this->pluginVersion
        ]);
        
        // Check for deprecation warnings
        if (isset($response['headers']['x-api-deprecated'])) {
            $this->logDeprecationWarning($response['headers']);
        }
        
        return $response['body'];
    }
    
    /**
     * Check for plugin updates
     */
    public function checkForUpdates() {
        $endpoint = "/api/{$this->apiVersion}/plugins/{$this->pluginSlug}/updates";
        
        $response = $this->request('GET', $endpoint, [
            'current_version' => $this->pluginVersion
        ]);
        
        return $response['body'];
    }
    
    /**
     * Send analytics/telemetry
     */
    public function sendTelemetry($data) {
        // Only available in v2
        if ($this->apiVersion !== 'v2') {
            return ['error' => 'Telemetry requires API v2'];
        }
        
        $endpoint = "/api/{$this->apiVersion}/analytics/events";
        
        $response = $this->request('POST', $endpoint, array_merge($data, [
            'plugin_slug' => $this->pluginSlug,
            'plugin_version' => $this->pluginVersion
        ]));
        
        return $response['body'];
    }
    
    /**
     * Make HTTP request
     */
    private function request($method, $endpoint, $data = []) {
        $url = $this->baseUrl . $endpoint;
        
        $args = [
            'method' => $method,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-API-Key' => $this->apiKey,
                'X-Plugin-Slug' => $this->pluginSlug,
                'X-Plugin-Version' => $this->pluginVersion,
                'User-Agent' => "Kollabor8-Plugin/{$this->pluginSlug}/{$this->pluginVersion}"
            ],
            'timeout' => 15
        ];
        
        if ($method === 'POST' || $method === 'PUT') {
            $args['body'] = json_encode($data);
        } elseif ($method === 'GET' && !empty($data)) {
            $url .= '?' . http_build_query($data);
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            throw new \Exception('API request failed: ' . $response->get_error_message());
        }
        
        $statusCode = wp_remote_retrieve_response_code($response);
        $headers = wp_remote_retrieve_headers($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if ($statusCode >= 400) {
            throw new \Exception(
                $body['error'] ?? 'API request failed',
                $statusCode
            );
        }
        
        return [
            'status' => $statusCode,
            'headers' => $headers,
            'body' => $body
        ];
    }
    
    /**
     * Log deprecation warning
     */
    private function logDeprecationWarning($headers) {
        $sunsetDate = $headers['x-api-sunset-date'] ?? 'unknown';
        $daysLeft = $headers['x-api-days-until-sunset'] ?? 'unknown';
        
        error_log(sprintf(
            '[Kollabor8] WARNING: API %s is deprecated. Sunset date: %s (%s days remaining). Migration guide: %s',
            $this->apiVersion,
            $sunsetDate,
            $daysLeft,
            $headers['x-api-migration-guide'] ?? 'N/A'
        ));
        
        // Store in WordPress transient to show admin notice
        set_transient(
            "kollabor8_{$this->pluginSlug}_api_deprecated",
            [
                'version' => $this->apiVersion,
                'sunset_date' => $sunsetDate,
                'days_left' => $daysLeft,
                'migration_guide' => $headers['x-api-migration-guide'] ?? null
            ],
            DAY_IN_SECONDS
        );
    }
    
    /**
     * Get recommended API version for plugin
     */
    public static function getRecommendedVersion($pluginSlug) {
        // Could fetch from remote config
        $versionMap = [
            'kollabor8-analytics-pro' => 'v2',
            'kollabor8-seo-booster' => 'v1',
            'kollabor8-form-builder' => 'v2'
        ];
        
        return $versionMap[$pluginSlug] ?? self::DEFAULT_VERSION;
    }
}