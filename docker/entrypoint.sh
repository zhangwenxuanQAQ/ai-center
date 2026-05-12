#!/bin/bash
set -e

echo "Starting AI Center Services..."

if [ ! -f /aicenter/configs/server_config.yaml ]; then
    echo "Error: Configuration file not found!"
    exit 1
fi

get_config_value() {
    local key=$1
    local default=$2
    python3 -c "
import yaml
import os

with open('/aicenter/configs/server_config.yaml', 'r') as f:
    config = yaml.safe_load(f)

keys = '$key'.split('.')
value = config
for k in keys:
    if isinstance(value, dict) and k in value:
        value = value[k]
    else:
        value = None
        break

if value is not None:
    print(value)
else:
    print('$default')
"
}

SERVER_HOST_ENV=${SERVER_HOST:-}
MCP_HOST_ENV=${MCP_HOST:-}
SERVER_PORT_ENV=${SERVER_PORT:-}
MCP_PORT_ENV=${MCP_PORT:-}

SERVER_HOST_CONFIG=$(get_config_value "server.host" "0.0.0.0")
MCP_HOST_CONFIG=$(get_config_value "mcp.host" "0.0.0.0")
SERVER_PORT_CONFIG=$(get_config_value "server.http_port" "8081")
MCP_PORT_CONFIG=$(get_config_value "mcp.port" "8082")

SERVER_HOST=${SERVER_HOST_ENV:-${SERVER_HOST_CONFIG}}
SERVER_PORT=${SERVER_PORT_ENV:-${SERVER_PORT_CONFIG}}
MCP_HOST=${MCP_HOST_ENV:-${MCP_HOST_CONFIG}}
MCP_PORT=${MCP_PORT_ENV:-${MCP_PORT_CONFIG}}

echo "Configuration loaded:"
echo "  SERVER_HOST: $SERVER_HOST (from ${SERVER_HOST_ENV:+environment variable}${SERVER_HOST_ENV:--}${SERVER_HOST_ENV:-${SERVER_HOST_CONFIG:+config file}${SERVER_HOST_CONFIG:-default}})"
echo "  SERVER_PORT: $SERVER_PORT (from ${SERVER_PORT_ENV:+environment variable}${SERVER_PORT_ENV:--}${SERVER_PORT_ENV:-${SERVER_PORT_CONFIG:+config file}${SERVER_PORT_CONFIG:-default}})"
echo "  MCP_HOST: $MCP_HOST (from ${MCP_HOST_ENV:+environment variable}${MCP_HOST_ENV:--}${MCP_HOST_ENV:-${MCP_HOST_CONFIG:+config file}${MCP_HOST_CONFIG:-default}})"
echo "  MCP_PORT: $MCP_PORT (from ${MCP_PORT_ENV:+environment variable}${MCP_PORT_ENV:--}${MCP_PORT_ENV:-${MCP_PORT_CONFIG:+config file}${MCP_PORT_CONFIG:-default}})"

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

if [ "$SERVER_HOST" = "0.0.0.0" ] || [ "$SERVER_HOST" = "localhost" ]; then
    echo "Frontend: http://localhost"
    echo "Backend API: http://localhost:$SERVER_PORT/docs"
else
    echo "Frontend: http://$SERVER_HOST"
    echo "Backend API: http://$SERVER_HOST:$SERVER_PORT/docs"
fi

if [ "$MCP_HOST" = "0.0.0.0" ] || [ "$MCP_HOST" = "localhost" ]; then
    echo "MCP Server: http://localhost:$MCP_PORT"
else
    echo "MCP Server: http://$MCP_HOST:$MCP_PORT"
fi

trap "echo 'Stopping services...'; kill $BACKEND_PID $MCP_PID 2>/dev/null; service nginx stop; exit 0" SIGTERM SIGINT

wait $BACKEND_PID $MCP_PID