#!/bin/bash

# Start server with logs captured to file (with ArangoDB)
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

# ArangoDB Configuration (Graph RAG)
export GRAPH_DB_PROVIDER="arango"
export ENABLE_GRAPH_RAG="true"
export ENABLE_CROSS_SESSION_CONTEXT="true"

echo "==================================="
echo "Using ArangoDB for Graph RAG"
echo "GRAPH_DB_PROVIDER: ${GRAPH_DB_PROVIDER}"
echo "==================================="

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
