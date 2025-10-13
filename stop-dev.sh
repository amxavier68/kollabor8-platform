#!/bin/bash

echo "🛑 Stopping Kollabor8 Development Environment"
echo "================================================"

# Stop Docker containers
echo ""
echo "🐳 Stopping Docker containers..."
cd ~/Desktop/PROJECTS/kollabor8-platform
docker-compose -f docker-compose.dev.yml down

# Stop XAMPP
echo ""
echo "📦 Stopping XAMPP..."
sudo /Applications/XAMPP/xamppfiles/xampp stop

echo ""
echo "✅ All services stopped!"