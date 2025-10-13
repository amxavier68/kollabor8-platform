#!/bin/bash

echo "🚀 Starting Kollabor8 Development Environment"
echo "================================================"

# Start XAMPP (for WordPress)
echo ""
echo "📦 Starting XAMPP (WordPress)..."
sudo /Applications/XAMPP/xamppfiles/xampp start

# Wait a moment for XAMPP to start
sleep 3

# Start Docker containers (Backend, Frontend, MongoDB)
echo ""
echo "🐳 Starting Docker containers..."
cd ~/Desktop/PROJECTS/kollabor8-platform
docker-compose -f docker-compose.dev.yml up -d

# Wait for containers to be ready
echo ""
echo "⏳ Waiting for services to initialize..."
sleep 10

# Check service health
echo ""
echo "🏥 Service Status:"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "✅ All services started!"
echo ""
echo "================================================"
echo "📍 Available Services:"
echo "================================================"
echo "   WordPress:          http://localhost/wordpress"
echo "   WordPress Admin:    http://localhost/wordpress/wp-admin"
echo "   Backend API:        http://localhost:5000"
echo "   Frontend:           http://localhost:3000"
echo "   Mongo Express:      http://localhost:8082"
echo "   phpMyAdmin:         http://localhost/phpmyadmin"
echo ""
echo "================================================"
echo "📂 Project Locations:"
echo "================================================"
echo "   Main Project:       ~/Desktop/PROJECTS/kollabor8-platform"
echo "   WordPress:          /Applications/XAMPP/xamppfiles/htdocs/wordpress"
echo "   WP Plugin (dev):    ~/Desktop/PROJECTS/kollabor8-platform/wordpress-plugin"
echo ""
echo "================================================"
echo "📚 Useful Commands:"
echo "================================================"
echo "   View logs:          docker-compose -f docker-compose.dev.yml logs -f"
echo "   Stop Docker:        docker-compose -f docker-compose.dev.yml down"
echo "   Stop XAMPP:         sudo /Applications/XAMPP/xamppfiles/xampp stop"
echo "   Restart service:    docker-compose -f docker-compose.dev.yml restart [service]"
echo ""