#!/bin/bash
# Run only server (which serves both API and UI) and schema compilation

# Start ArangoDB if not already running
if ! docker ps --format '{{.Names}}' | grep -q 'lighthouse-arangodb'; then
  echo "🚀 Starting ArangoDB container..."
  docker-compose up -d
  # Wait for ArangoDB to be ready
  echo "⏳ Waiting for ArangoDB to be ready..."
  sleep 3
else
  echo "✅ ArangoDB already running"
fi

npx pnpm dlx concurrently -n "Server,Models,Components,UI" \
             -c "yellow,green,blue,magenta" \
             "npx pnpm --filter=@journey/server run dev" \
             "npx pnpm --filter=@journey/schema run dev" \
             "npx pnpm --filter=@journey/components run dev" \
             "npx pnpm --filter=@journery/ui run dev"
