#!/bin/bash

# Kollabor8 Platform - Stop All Services

echo "🛑 Stopping Kollabor8 Platform Services"
echo "=========================================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Stop Backend
if [ -f .pids/backend.pid ]; then
    BACKEND_PID=$(cat .pids/backend.pid)
    echo "Stopping backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
    rm .pids/backend.pid
    echo -e "${GREEN}✓ Backend stopped${NC}"
fi

# Stop Frontend
if [ -f .pids/frontend.pid ]; then
    FRONTEND_PID=$(cat .pids/frontend.pid)
    echo "Stopping frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || true
    rm .pids/frontend.pid
    echo -e "${GREEN}✓ Frontend stopped${NC}"
fi

# Stop Docker services
echo "Stopping Docker services..."
docker-compose -f docker-compose.dev.yml down
echo -e "${GREEN}✓ Docker services stopped${NC}"

echo ""
echo "=========================================================="
echo -e "${GREEN}✅ All services stopped!${NC}"
echo "=========================================================="
