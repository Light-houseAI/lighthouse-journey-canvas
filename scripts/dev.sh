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

# Run database migrations
echo "📦 Running PostgreSQL migrations..."
pnpm --filter @journey/schema db:push

echo "📦 Initializing ArangoDB schema..."
pnpm --filter @journey/server db:init-arango

pnpm dlx concurrently -n "Server,Models,Components" \
             -c "yellow,green" \
             "pnpm --filter=@journey/server run dev" \
             "pnpm --filter=@journey/schema run dev" \
             "pnpm --filter=@journey/components run dev"
