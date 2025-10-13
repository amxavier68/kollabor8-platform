#!/bin/bash

WP_PLUGINS_DIR="/Applications/XAMPP/xamppfiles/htdocs/wordpress/wp-content/plugins"
PROJECT_PLUGINS_DIR="$HOME/Desktop/PROJECTS/kollabor8-platform/plugins"

echo "🔗 Symlinking all plugins to WordPress..."

# Check if WordPress plugins directory exists
if [ ! -d "$WP_PLUGINS_DIR" ]; then
    echo "❌ WordPress plugins directory not found: $WP_PLUGINS_DIR"
    exit 1
fi

# Loop through all plugin directories
for plugin in "$PROJECT_PLUGINS_DIR"/*; do
    if [ -d "$plugin" ]; then
        plugin_name=$(basename "$plugin")
        target="$WP_PLUGINS_DIR/$plugin_name"
        
        # Remove existing symlink or directory
        if [ -L "$target" ]; then
            echo "   Removing existing symlink: $plugin_name"
            rm "$target"
        elif [ -d "$target" ]; then
            echo "   ⚠️  Directory exists (not a symlink): $plugin_name"
            echo "      Skipping... (remove manually if needed)"
            continue
        fi
        
        # Create symlink
        ln -s "$plugin" "$target"
        echo "   ✅ Linked: $plugin_name"
    fi
done

echo ""
echo "✅ All plugins symlinked!"
echo "   View in WordPress: http://localhost/wordpress/wp-admin/plugins.php"