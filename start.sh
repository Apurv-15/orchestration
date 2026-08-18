#!/bin/bash

# Exit on error
set -e

echo "=================================================="
echo "🚀 Starting Orchnex Full-Stack Web Application"
echo "=================================================="

# Check if Ollama is running
echo "🔍 Checking Ollama service..."
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "⚠️ Ollama server is not running at http://localhost:11434"
    echo "Please start Ollama using 'ollama serve' in another terminal and try again."
    exit 1
fi

echo "✅ Ollama server is active."

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down backend and frontend..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Step 1: Start Backend API Server
echo "🐍 Starting Python FastAPI Backend Server..."
python3 server.py &
BACKEND_PID=$!

# Wait for backend to boot up
sleep 2

# Step 2: Start Next.js Frontend Server
echo "⚛️ Starting Next.js Frontend Server..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=================================================="
echo "🎉 Orchnex UI is now running!"
echo "🌐 Open your browser at: http://localhost:3000"
echo "=================================================="
echo "Press Ctrl+C anytime to stop all servers."
echo ""

# Keep script running to maintain background jobs
wait
