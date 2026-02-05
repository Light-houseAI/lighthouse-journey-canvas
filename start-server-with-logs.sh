#!/bin/bash

# Start server with logs captured to file (with remote Helix DB)
# Usage: ./start-server-with-logs.sh
#
# Logs are saved to: server-logs-YYYY-MM-DD_HH-MM-SS.log
# Press Ctrl+C to stop the server

# Get script directory for consistent paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate timestamp for log filename
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="logs/server-logs-${TIMESTAMP}.log"

# Remote Helix DB on GCP (static IP)
export HELIX_URL="http://136.118.249.68:6969"
export GRAPH_DB_PROVIDER="helix"
export ENABLE_GRAPH_RAG="true"
export ENABLE_CROSS_SESSION_CONTEXT="true"

echo "==================================="
echo "Checking remote Helix DB connection..."
echo "HELIX_URL: ${HELIX_URL}"
echo "==================================="

# Check if Helix DB is reachable (using POST to GetUserCount endpoint)
if curl -s --connect-timeout 5 -X POST "${HELIX_URL}/GetUserCount" -H "Content-Type: application/json" -d '{}' | grep -q "count"; then
    echo "Helix DB is reachable!"
else
    echo "Warning: Could not reach Helix DB at ${HELIX_URL}"
    echo "Server will start anyway but graph features may not work."
fi

echo ""
echo "==================================="
echo "Starting server..."
echo "Logs will be saved to: ${LOG_FILE}"
echo "Press Ctrl+C to stop"
echo "==================================="
echo ""

# Change to server directory and start with logs captured
cd packages/server

# Use tee to display output AND save to file
# 2>&1 captures both stdout and stderr
NODE_OPTIONS='--max-old-space-size=4096' npx tsx watch --clear-screen=false --ignore '**/*.timestamp-*.mjs' --ignore '../ui/**' src/index.ts 2>&1 | tee "../../${LOG_FILE}"
