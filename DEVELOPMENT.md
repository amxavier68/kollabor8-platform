# Kollabor8 Platform - Development Guide

## Project Structure

- **Main Project**: `~/Desktop/PROJECTS/kollabor8-platform/`
- **WordPress**: `/Applications/XAMPP/xamppfiles/htdocs/wordpress/`
- **WP Plugin (dev)**: Symlinked from project to WordPress

## Starting Development

```bash
cd ~/Desktop/PROJECTS/kollabor8-platform
./start-dev.sh
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ LTS
- Docker Desktop
- Git

### Setup

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd kollabor8-platform

docker-compose -f docker-compose.dev.yml up -d mongodb

cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev

cd frontend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev

Access Applications

Backend API: http://localhost:5000
Frontend: http://localhost:3000
Mongo Express: http://localhost:8082
WordPress: http://localhost/wordpress

Access Applications

Backend API: http://localhost:5000
Frontend: http://localhost:3000
Mongo Express: http://localhost:8082
WordPress: http://localhost/wordpress

🗄️ Database

MongoDB: Primary database (documents, users, licenses)
Connection: Via Docker on port 27017

📚 API Documentation

Health Check: GET /health
API v1: GET /api/v1
API v2: GET /api/v2

Full API docs: [Coming Soon]
🧪 Testing

# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

🚢 Deployment
Backend

Platform: Railway
Auto-deploy from main branch

Frontend

Platform: Vercel
Auto-deploy from main branch

🤝 Contributing

Create a feature branch: git checkout -b feature/your-feature
Commit changes: git commit -m 'feat: add new feature'
Push to branch: git push origin feature/your-feature
Open a Pull Request

```
