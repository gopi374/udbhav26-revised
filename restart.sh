#!/bin/bash

echo "🔄 Restarting UDBHAV'26 Development Servers..."
echo ""

# Kill any existing Node processes on ports 8080 and 5173
echo "🛑 Stopping existing servers..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 1

echo "✅ Servers stopped"
echo ""
echo "🚀 Starting API Server (port 8080)..."
echo "   Run this in Terminal 1:"
echo "   npm run dev:api"
echo ""
echo "🚀 Starting Vite Dev Server (port 5173)..."
echo "   Run this in Terminal 2:"
echo "   npm run dev"
echo ""
echo "📝 Then open: http://localhost:5173/register"
