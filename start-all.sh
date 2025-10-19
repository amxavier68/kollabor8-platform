#!/bin/bash

# Kollabor8 Platform - Complete Startup Script
# This starts Docker, Backend, and Frontend in one command

echo "🚀 Starting Kollabor8 Platform - All Services"
echo "=========================================================="
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Check if Docker is running
echo -e "${BLUE}🐳 Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo "Starting Docker Desktop..."
    open -a Docker
    echo "Waiting for Docker to start..."
    sleep 10
fi

# Start MongoDB
echo -e "${BLUE}🗄️  Starting MongoDB...${NC}"
docker-compose -f docker-compose.dev.yml up -d mongodb mongo-express
sleep 5
echo -e "${GREEN}✓ MongoDB started${NC}"
echo ""

# Start Backend in background
echo -e "${BLUE}⚙️  Starting Backend...${NC}"
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend starting (PID: $BACKEND_PID)${NC}"
cd ..

# Wait a bit for backend
sleep 3

# Start Frontend in background
echo -e "${BLUE}🎨 Starting Frontend...${NC}"
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend starting (PID: $FRONTEND_PID)${NC}"
cd ..

# Save PIDs for cleanup
mkdir -p .pids
echo $BACKEND_PID > .pids/backend.pid
echo $FRONTEND_PID > .pids/frontend.pid

echo ""
echo "=========================================================="
echo -e "${GREEN}✅ All services started!${NC}"
echo "=========================================================="
echo ""
echo "📍 Access your application:"
echo "   • Frontend:      http://localhost:3000"
echo "   • Backend API:   http://localhost:5000"
echo "   • Mongo Express: http://localhost:8082"
echo ""
echo "📋 Process IDs:"
echo "   • Backend:  $BACKEND_PID"
echo "   • Frontend: $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "   • Backend:  tail -f logs/backend.log"
echo "   • Frontend: tail -f logs/frontend.log"
echo ""
echo "🛑 To stop all services:"
echo "   ./stop-all.sh"
echo ""
