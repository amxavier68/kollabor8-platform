#!/bin/bash

# Kollabor8 Platform - Health Check & Error Mitigation Script
# Run this from the project root: ~/Desktop/PROJECTS/kollabor8-platform/

echo "🏥 Kollabor8 Platform Health Check"
echo "===================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track issues
ISSUES_FOUND=0

# 1. Check if we're in the right directory
echo "📁 Checking project structure..."
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Error: Not in project root directory${NC}"
    echo "Please run this script from: ~/Desktop/PROJECTS/kollabor8-platform/"
    exit 1
fi
echo -e "${GREEN}✓ Project structure found${NC}"
echo ""

# 2. Check MongoDB Docker container
echo "🐳 Checking MongoDB Docker container..."
if docker ps | grep -q mongodb; then
    echo -e "${GREEN}✓ MongoDB container is running${NC}"
else
    echo -e "${YELLOW}⚠ MongoDB container not running${NC}"
    echo "Starting MongoDB..."
    docker-compose -f docker-compose.dev.yml up -d mongodb
    sleep 5
    if docker ps | grep -q mongodb; then
        echo -e "${GREEN}✓ MongoDB started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to start MongoDB${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
fi
echo ""

# 3. Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
    echo -e "${GREEN}✓ Node.js version: $(node -v)${NC}"
else
    echo -e "${YELLOW}⚠ Node.js version $(node -v) detected. Recommended: v18+${NC}"
fi
echo ""

# 4. Check backend dependencies
echo "🔧 Checking backend dependencies..."
if [ -d "backend/node_modules" ]; then
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠ Backend dependencies missing${NC}"
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
fi
echo ""

# 5. Check frontend dependencies
echo "🎨 Checking frontend dependencies..."
if [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠ Frontend dependencies missing${NC}"
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
fi
echo ""

# 6. Check environment files
echo "🔐 Checking environment files..."
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✓ Backend .env exists${NC}"
    # Check critical env vars
    if grep -q "JWT_SECRET" backend/.env && grep -q "MONGODB_URI" backend/.env; then
        echo -e "${GREEN}  ✓ Critical env vars present${NC}"
    else
        echo -e "${RED}  ❌ Missing critical env vars${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    echo -e "${RED}❌ Backend .env missing${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ -f "frontend/.env" ]; then
    echo -e "${GREEN}✓ Frontend .env exists${NC}"
else
    echo -e "${RED}❌ Frontend .env missing${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 7. Test MongoDB connection
echo "🔌 Testing MongoDB connection..."
if command -v mongosh &> /dev/null; then
    if mongosh "mongodb://admin:kollabor8dev@localhost:27017/kollabor8_dev?authSource=admin" --eval "db.serverStatus()" &> /dev/null; then
        echo -e "${GREEN}✓ MongoDB connection successful${NC}"
    else
        echo -e "${RED}❌ MongoDB connection failed${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    echo -e "${YELLOW}⚠ mongosh not installed (skipping connection test)${NC}"
fi
echo ""

# 8. Check TypeScript configuration
echo "📝 Checking TypeScript configuration..."
if [ -f "backend/tsconfig.json" ] && [ -f "frontend/tsconfig.json" ]; then
    echo -e "${GREEN}✓ TypeScript configs exist${NC}"
    
    # Check for decorator config in backend
    if grep -q '"experimentalDecorators": true' backend/tsconfig.json; then
        echo -e "${GREEN}  ✓ Backend decorators enabled${NC}"
    else
        echo -e "${YELLOW}  ⚠ Backend decorators may not be enabled${NC}"
    fi
    
    # Check for decorator config in frontend
    if grep -q '"experimentalDecorators": true' frontend/tsconfig.json; then
        echo -e "${GREEN}  ✓ Frontend decorators enabled${NC}"
    else
        echo -e "${YELLOW}  ⚠ Frontend decorators may not be enabled${NC}"
    fi
else
    echo -e "${RED}❌ TypeScript configs missing${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 9. Check if ports are available
echo "🔌 Checking port availability..."
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Port 5000 (backend) is in use${NC}"
    echo "  Process: $(lsof -Pi :5000 -sTCP:LISTEN | tail -n 1)"
else
    echo -e "${GREEN}✓ Port 5000 (backend) is available${NC}"
fi

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Port 3000 (frontend) is in use${NC}"
    echo "  Process: $(lsof -Pi :3000 -sTCP:LISTEN | tail -n 1)"
else
    echo -e "${GREEN}✓ Port 3000 (frontend) is available${NC}"
fi
echo ""

# 10. Summary
echo "===================================="
echo "📊 Health Check Summary"
echo "===================================="
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! System is healthy.${NC}"
    echo ""
    echo "You can now start the services:"
    echo "  Backend:  cd backend && npm run dev"
    echo "  Frontend: cd frontend && npm run dev"
else
    echo -e "${RED}⚠️  Found $ISSUES_FOUND issue(s) that need attention${NC}"
    echo ""
    echo "Please review the errors above and fix them before starting."
fi
echo ""