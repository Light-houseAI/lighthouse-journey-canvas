# Timeline Node Closure Table Implementation

## Overview

The `timeline_node_closure` table maintains hierarchical relationships between timeline nodes for efficient querying. This is a closure table implementation that stores all ancestor-descendant relationships.

## Files

- `populate-closure-table.ts` - One-time script to populate the closure table from existing timeline_nodes data using plain SQL

## Usage

### Initial Population

Run this script once after deploying the closure table implementation:

```bash
cd packages/server
pnpm tsx scripts/populate-closure-table.ts
```

### Force Rebuild

If you need to rebuild the closure table from scratch:

```bash
cd packages/server
pnpm tsx scripts/populate-closure-table.ts --force
```

## What the closure table stores

- **Self-references**: Every node is its own ancestor at depth 0
- **Parent-child**: Direct relationships at depth 1  
- **Grandparent-grandchild**: Relationships at depth 2
- **All ancestor-descendant pairs**: At their respective depths

## Implementation

The closure table is automatically maintained by the `HierarchyRepository` when:
- Creating new nodes
- Updating node parent relationships  
- Deleting nodes

The repository contains private methods that handle closure table maintenance directly using SQL queries.

No manual maintenance should be required after the initial population.