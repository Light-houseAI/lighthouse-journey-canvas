#!/bin/bash
# Run only server (which serves both API and UI) and schema compilation
pnpm dlx concurrently -n "Server,Models,Components" \
             -c "yellow,green" \
             "pnpm --filter=@journey/server run dev" \
             "pnpm --filter=@journey/schema run dev" \
             "pnpm --filter=@journey/components run dev"
