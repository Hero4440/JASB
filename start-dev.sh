#!/bin/bash

echo "🚀 Starting JASB Development Environment..."

# Kill any existing processes on ports 3001 and 8081
echo "📦 Cleaning up existing processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Wait a moment for cleanup
sleep 2

# Start the mock server in background
echo "🔧 Starting mock API server..."
node mock-server.js &
MOCK_PID=$!

# Wait for server to start
sleep 3

# Start Expo with clean cache
echo "📱 Starting Expo with clean cache..."
npm run dev:ios -- --clear

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    kill $MOCK_PID 2>/dev/null || true
    exit 0
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# Wait for user to stop
wait