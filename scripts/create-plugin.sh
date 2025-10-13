#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: ./create-plugin.sh plugin-name"
    exit 1
fi

PLUGIN_NAME=$1
PLUGIN_SLUG=$(echo "$PLUGIN_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
PLUGIN_CLASS=$(echo "$PLUGIN_NAME" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g' | tr -d ' ')

PLUGIN_DIR="plugins/$PLUGIN_SLUG"

echo "🔌 Creating new plugin: $PLUGIN_NAME"
echo "   Slug: $PLUGIN_SLUG"
echo "   Class: $PLUGIN_CLASS"

# Create directory structure
mkdir -p "$PLUGIN_DIR"/{includes,assets/{js,css,images},tests}

# Create main plugin file
cat > "$PLUGIN_DIR/$PLUGIN_SLUG.php" << EOF
<?php
/**
 * Plugin Name: $PLUGIN_NAME
 * Plugin URI: https://kollabor8.com/plugins/$PLUGIN_SLUG
 * Description: Description for $PLUGIN_NAME
 * Version: 1.0.0
 * Author: Kollabor8
 * Author URI: https://kollabor8.com
 * License: GPL v2 or later
 * Text Domain: $PLUGIN_SLUG
 */

if (!defined('ABSPATH')) {
    exit;
}

define('${PLUGIN_CLASS}_VERSION', '1.0.0');
define('${PLUGIN_CLASS}_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('${PLUGIN_CLASS}_PLUGIN_URL', plugin_dir_url(__FILE__));

// Include shared SDK
require_once ${PLUGIN_CLASS}_PLUGIN_DIR . 'includes/class-api-client.php';

class ${PLUGIN_CLASS} {
    private static \$instance = null;
    
    public static function get_instance() {
        if (null === self::\$instance) {
            self::\$instance = new self();
        }
        return self::\$instance;
    }
    
    private function __construct() {
        \$this->init_hooks();
    }
    
    private function init_hooks() {
        add_action('admin_menu', array(\$this, 'add_admin_menu'));
        add_action('rest_api_init', array(\$this, 'register_rest_routes'));
    }
    
    public function add_admin_menu() {
        add_menu_page(
            '$PLUGIN_NAME',
            '$PLUGIN_NAME',
            'manage_options',
            '$PLUGIN_SLUG',
            array(\$this, 'render_admin_page'),
            'dashicons-admin-generic',
            100
        );
    }
    
    public function register_rest_routes() {
        register_rest_route('$PLUGIN_SLUG/v1', '/settings', array(
            'methods' => 'GET',
            'callback' => array(\$this, 'get_settings'),
            'permission_callback' => array(\$this, 'check_permission')
        ));
    }
    
    public function render_admin_page() {
        include ${PLUGIN_CLASS}_PLUGIN_DIR . 'includes/admin-page.php';
    }
    
    public function get_settings(\$request) {
        return rest_ensure_response(array('status' => 'ok'));
    }
    
    public function check_permission() {
        return current_user_can('manage_options');
    }
}

function ${PLUGIN_SLUG}_init() {
    return ${PLUGIN_CLASS}::get_instance();
}

add_action('plugins_loaded', '${PLUGIN_SLUG}_init');

register_activation_hook(__FILE__, '${PLUGIN_SLUG}_activate');
function ${PLUGIN_SLUG}_activate() {
    flush_rewrite_rules();
}

register_deactivation_hook(__FILE__, '${PLUGIN_SLUG}_deactivate');
function ${PLUGIN_SLUG}_deactivate() {
    flush_rewrite_rules();
}
EOF

# Create README
cat > "$PLUGIN_DIR/README.md" << EOF
# $PLUGIN_NAME

## Description
WordPress plugin for [description].

## Development

### Installation
\`\`\`bash
./scripts/symlink-plugins.sh
\`\`\`

### Testing
\`\`\`bash
cd plugins/$PLUGIN_SLUG
composer install
composer test
\`\`\`

## License
GPL v2 or later
EOF

# Create composer.json for testing
cat > "$PLUGIN_DIR/composer.json" << EOF
{
    "name": "kollabor8/$PLUGIN_SLUG",
    "description": "$PLUGIN_NAME WordPress Plugin",
    "type": "wordpress-plugin",
    "require": {
        "php": ">=7.4"
    },
    "require-dev": {
        "phpunit/phpunit": "^9.0"
    },
    "autoload": {
        "psr-4": {
            "Kollabor8\\\\${PLUGIN_CLASS}\\\\": "includes/"
        }
    }
}
EOF

echo "✅ Plugin created successfully!"
echo ""
echo "Next steps:"
echo "  1. cd $PLUGIN_DIR"
echo "  2. Edit $PLUGIN_SLUG.php"
echo "  3. Run: ./scripts/symlink-plugins.sh"
echo "  4. Activate in WordPress: http://localhost/wordpress/wp-admin/plugins.php"