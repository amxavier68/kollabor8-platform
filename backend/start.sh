#!/bin/bash

# Kill any process using port 5000
PORT=5000
PID=$(lsof -ti:$PORT)

if [ ! -z "$PID" ]; then
    echo "🔴 Killing process on port $PORT (PID: $PID)"
    kill -9 $PID
    sleep 1
fi

echo "🚀 Starting backend on port $PORT..."
npm run dev
