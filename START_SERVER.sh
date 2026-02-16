#!/bin/bash

# FPL Analytics Hub - Local Server Starter
# This script starts a local web server for development

echo "🚀 Starting FPL Pro Analytics Hub Local Server..."
echo "📂 Directory: $(pwd)"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null
then
    echo "✅ Python 3 found"
    echo "🌐 Starting server on http://localhost:8000"
    echo ""
    echo "📌 IMPORTANT:"
    echo "   • Open your browser to: http://localhost:8000"
    echo "   • Press Ctrl+C to stop the server"
    echo ""
    echo "🔄 Server is running..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    python3 -m http.server 8000
else
    echo "❌ Python 3 not found"
    echo "Please install Python 3 or use another method"
    exit 1
fi

