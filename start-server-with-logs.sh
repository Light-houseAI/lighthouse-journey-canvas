#!/bin/bash

# Start server with logs captured to file
# Usage: ./start-server-with-logs.sh
#
# Logs are saved to: server-logs-YYYY-MM-DD_HH-MM-SS.log
# Press Ctrl+C to stop the server

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate timestamp for log filename
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="logs/server-logs-${TIMESTAMP}.log"

echo "Starting server..."
echo "Logs will be saved to: ${LOG_FILE}"
echo "Press Ctrl+C to stop"
echo ""
echo "==================================="
echo ""

# Change to server directory and start with logs captured
cd packages/server

# Use tee to display output AND save to file
# 2>&1 captures both stdout and stderr
NODE_OPTIONS='--max-old-space-size=4096' npx tsx watch --clear-screen=false --ignore '**/*.timestamp-*.mjs' --ignore '../ui/**' src/index.ts 2>&1 | tee "../../${LOG_FILE}"
