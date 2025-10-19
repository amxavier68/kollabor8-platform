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
fi
echo ""

# 5. Check frontend dependencies
echo "🎨 Checking frontend dependencies..."
if [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠ Frontend dependencies missing${NC}"
fi
echo ""

# 6. Check environment files
echo "🔐 Checking environment files..."
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✓ Backend .env exists${NC}"
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

# Summary
echo "===================================="
echo "📊 Health Check Summary"
echo "===================================="
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! System is healthy.${NC}"
else
    echo -e "${YELLOW}⚠️  Found $ISSUES_FOUND issue(s) that need attention${NC}"
fi
echo ""
