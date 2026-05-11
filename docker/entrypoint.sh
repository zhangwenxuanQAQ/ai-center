#!/bin/bash
set -e

echo "Starting AI Center Services..."

if [ ! -f /aicenter/configs/server_config.yaml ]; then
    echo "Error: Configuration file not found!"
    exit 1
fi

SERVER_HOST=${SERVER_HOST:-0.0.0.0}
SERVER_PORT=${SERVER_PORT:-8081}
MCP_HOST=${MCP_HOST:-0.0.0.0}
MCP_PORT=${MCP_PORT:-8082}

echo "Starting Nginx..."
service nginx start

echo "Starting MCP Server..."
cd /aicenter
python3 -m app.mcp_server &
MCP_PID=$!

echo "Starting Backend Server..."
python3 -m app.server_run &
BACKEND_PID=$!

echo "AI Center is running!"

if [ "$SERVER_HOST" = "0.0.0.0" ]; then
    echo "Frontend: http://localhost"
    echo "Backend API: http://localhost:$SERVER_PORT/docs"
else
    echo "Frontend: http://$SERVER_HOST"
    echo "Backend API: http://$SERVER_HOST:$SERVER_PORT/docs"
fi

if [ "$MCP_HOST" = "0.0.0.0" ]; then
    echo "MCP Server: http://localhost:$MCP_PORT"
else
    echo "MCP Server: http://$MCP_HOST:$MCP_PORT"
fi

trap "echo 'Stopping services...'; kill $BACKEND_PID $MCP_PID; service nginx stop; exit 0" SIGTERM SIGINT

wait $BACKEND_PID $MCP_PID