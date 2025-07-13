#!/bin/bash

# AutoScheduler Development Startup Script
# This script starts both the Flask backend and Next.js frontend

echo "🚀 Starting AutoScheduler Development Environment"
echo "================================================"

# Check if we're in the right directory
if [ ! -f "run_localhost.py" ]; then
    echo "❌ Error: Please run this script from the autoscheduler root directory"
    exit 1
fi

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "❌ Error: Frontend directory not found"
    exit 1
fi

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $FLASK_PID 2>/dev/null
    kill $NEXTJS_PID 2>/dev/null
    exit 0
}

# Set up signal handling for cleanup
trap cleanup SIGINT SIGTERM

echo "📦 Installing frontend dependencies..."
cd frontend && npm install

echo ""
echo "🔧 Starting Flask backend on port 5001..."
cd ..
python run_localhost.py &
FLASK_PID=$!

# Give Flask a moment to start
sleep 3

echo "🎨 Starting Next.js frontend on port 3001..."
cd frontend
npm run dev -- --port 3001 &
NEXTJS_PID=$!

echo ""
echo "✅ Development servers started!"
echo "📱 Frontend: http://localhost:3001"
echo "🔧 Backend:  http://localhost:5001"
echo ""
echo "💡 Tips:"
echo "   • Use the modern frontend at http://localhost:3001"
echo "   • The original Flask interface is still at http://localhost:5001"
echo "   • Press Ctrl+C to stop both servers"
echo ""
echo "🔄 Waiting for servers... (Press Ctrl+C to stop)"

# Wait for both processes
wait