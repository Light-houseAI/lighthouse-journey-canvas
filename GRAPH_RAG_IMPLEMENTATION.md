# Graph RAG Integration for Workflow Analysis - Implementation Status

This document tracks the implementation of Graph RAG (Retrieval-Augmented Generation with Graph-based Knowledge) for enhancing the workflow analysis button in Light House Journey Canvas.

**Implementation Date:** 2025-12-30
**Status:** Phase 1-2 Completed - Graph Service Ready
**Plan Document:** [plan.md](./plan.md)

---

## Overview

The Graph RAG integration enhances workflow analysis by:
- **Cross-session context**: Analyzes workflow patterns across multiple sessions
- **Entity & concept tracking**: Identifies tools, technologies, and concepts used over time
- **Relationship modeling**: Builds a knowledge graph of user activities and patterns
- **Temporal intelligence**: Tracks skill development and work evolution

---

## Completed Tasks (Phase 1)

### ✅ 1. ArangoDB Setup and Configuration

**Files Created:**
- [`packages/server/src/config/arangodb.connection.ts`](./packages/server/src/config/arangodb.connection.ts)
  - Singleton connection manager for ArangoDB
  - Health check functionality
  - Connection pooling (max 20 connections)

- [`packages/server/src/config/arangodb.init.ts`](./packages/server/src/config/arangodb.init.ts)
  - Schema initialization logic
  - Creates 6 vertex collections: users, timeline_nodes, sessions, activities, entities, concepts
  - Creates 7 edge collections: BELONGS_TO, FOLLOWS, USES, RELATES_TO, CONTAINS, SWITCHES_TO, DEPENDS_ON
  - Named graph: `workflow_graph`
  - Performance indexes on all collections

- [`packages/server/scripts/init-arango-schema.ts`](./packages/server/scripts/init-arango-schema.ts)
  - CLI script to initialize ArangoDB schema
  - Creates database if it doesn't exist
  - Run with: `pnpm db:init-arango`

- [`docker-compose.yml`](./docker-compose.yml)
  - ArangoDB 3.11 container configuration
  - Persistent volumes for data storage
  - Health checks enabled
  - Run with: `docker-compose up -d`

**Dependencies Added:**
- `arangojs@^10.1.2` - ArangoDB Node.js driver

**Environment Variables Added:**
```bash
ARANGO_URL="http://localhost:8529"
ARANGO_DATABASE="lighthouse_graph"
ARANGO_USERNAME="root"
ARANGO_PASSWORD="lighthouse_arango_password"
ENABLE_GRAPH_RAG="true"
ENABLE_CROSS_SESSION_CONTEXT="true"
GRAPH_RAG_MAX_DEPTH="3"
GRAPH_RAG_LOOKBACK_DAYS="90"
```

---

### ✅ 2. PostgreSQL Schema Extensions

**Files Modified:**
- [`packages/schema/src/schema.ts`](./packages/schema/src/schema.ts)
  - Added Graph RAG columns to `workflow_screenshots` table:
    - `arango_activity_key` - Links to ArangoDB activity node
    - `entities_extracted` - JSON array of extracted entities
    - `concepts_extracted` - JSON array of extracted concepts

  - Added new table: `concept_embeddings`
    - Stores concept names with 1536-dim embeddings
    - Tracks frequency and temporal data
    - IVFFlat index for fast similarity search

  - Added new table: `entity_embeddings`
    - Stores entity names/types with embeddings
    - Technology, person, organization, tool classification
    - Unique constraint on (entity_name, entity_type)

**Files Created:**
- [`packages/server/scripts/migrate-graph-rag-schema.ts`](./packages/server/scripts/migrate-graph-rag-schema.ts)
  - Database migration script
  - Adds columns to existing workflow_screenshots table
  - Creates concept_embeddings and entity_embeddings tables
  - Creates performance indexes (GIN for JSONB, IVFFlat for vectors)
  - Run with: `pnpm db:migrate:graph-rag`

---

## Completed Tasks (Phase 2)

### ✅ 3. ArangoDB Graph Service

**Files Created:**
- [`packages/server/src/services/arangodb-graph.service.ts`](./packages/server/src/services/arangodb-graph.service.ts)
  - Complete CRUD operations for all graph nodes (users, nodes, sessions, activities)
  - Entity and concept relationship management
  - Cross-session context queries with graph traversal
  - Workflow pattern analysis
  - Temporal sequence tracking
  - Edge creation with automatic collection detection

**Key Features Implemented:**
- **User Operations**: `upsertUser()` - Create/update user nodes
- **Node Operations**: `upsertTimelineNode()` - Manage timeline nodes
- **Session Operations**: `upsertSession()`, `updateSessionSequence()` - Track work sessions and temporal flow
- **Activity Operations**: `upsertActivity()` - Record screenshot activities
- **Entity Operations**: `createEntityRelationship()`, `upsertEntity()` - Track technology/tool usage
- **Concept Operations**: `createConceptRelationship()`, `upsertConcept()` - Track workflow concepts
- **Context Queries**: `getCrossSessionContext()` - Retrieve multi-dimensional context for analysis
- **Pattern Analysis**: `getWorkflowPatterns()` - Discover recurring workflow sequences
- **Entity Analysis**: `getFrequentEntities()` - Find commonly used technologies

**AQL Query Examples:**
```aql
// Cross-session context with graph traversal
FOR session IN 1..1 INBOUND current_node CONTAINS
  FOR activity IN activities
    FILTER activity.session_key == session._key
    FOR entity IN 1..1 OUTBOUND activity USES
      COLLECT e = entity AGGREGATE count = COUNT(1)
      RETURN MERGE(e, { usage_count: count })

// Workflow transition patterns
FOR session IN sessions
  FOR next IN 1..1 OUTBOUND session FOLLOWS
    COLLECT transition = CONCAT(session.workflow, ' → ', next.workflow)
    AGGREGATE count = COUNT(1)
    RETURN { transition, frequency: count }
```

---

## Graph Data Model

### ArangoDB Collections

**Vertex Collections:**
1. **users** - User profiles (linked to PostgreSQL users.id)
2. **timeline_nodes** - Timeline nodes (linked to PostgreSQL timeline_nodes.id)
3. **sessions** - Work sessions from Desktop Companion
4. **activities** - Individual screenshot activities
5. **entities** - Extracted entities (VSCode, React, etc.)
6. **concepts** - Extracted concepts (authentication, API design, etc.)

**Edge Collections:**
1. **BELONGS_TO** - sessions → timeline_nodes
2. **FOLLOWS** - sessions → sessions (temporal sequence)
3. **USES** - activities → entities
4. **RELATES_TO** - activities → concepts
5. **CONTAINS** - timeline_nodes → sessions
6. **SWITCHES_TO** - activities → activities (context switches)
7. **DEPENDS_ON** - timeline_nodes → timeline_nodes

### PostgreSQL Tables

**New Tables:**
- `concept_embeddings` - Concept vectors for similarity search
- `entity_embeddings` - Entity vectors for similarity search

**Modified Tables:**
- `workflow_screenshots` - Added Graph RAG reference columns

---

## Setup Instructions

### 1. Start ArangoDB

```bash
# Start ArangoDB container
docker-compose up -d

# Check if running
docker ps | grep arangodb

# Access UI at http://localhost:8529
# Username: root
# Password: lighthouse_arango_password
```

### 2. Initialize ArangoDB Schema

```bash
cd packages/server
pnpm db:init-arango
```

This creates:
- Database: `lighthouse_graph`
- All vertex and edge collections
- Named graph: `workflow_graph`
- Performance indexes

### 3. Migrate PostgreSQL Schema

```bash
pnpm db:migrate:graph-rag
```

This adds:
- New columns to `workflow_screenshots`
- `concept_embeddings` table
- `entity_embeddings` table
- Indexes for performance

### 4. Verify Setup

```typescript
// Check ArangoDB connection
import { ArangoDBConnection } from './src/config/arangodb.connection';

const status = ArangoDBConnection.getStatus();
console.log('ArangoDB connected:', status.connected);

// Check PostgreSQL tables
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('concept_embeddings', 'entity_embeddings');
```

---

## Next Steps (Pending Implementation)

### Phase 2: ArangoDB Graph Service
- [ ] Implement `ArangoDBGraphService` with CRUD operations
- [ ] User/Node/Session/Activity management
- [ ] Entity and concept relationship creation
- [ ] Cross-session context queries

### Phase 3: Entity Extraction
- [ ] Implement `EntityExtractionService` with LLM-based extraction
- [ ] Batch processing for screenshots
- [ ] Confidence scoring
- [ ] Storage in both PostgreSQL and ArangoDB

### Phase 4: Cross-Session Retrieval
- [ ] Implement `CrossSessionRetrievalService`
- [ ] Graph traversal queries (AQL)
- [ ] Hybrid retrieval (graph + vector)
- [ ] Result fusion and ranking

### Phase 5: Enhanced Workflow Analysis
- [ ] Update workflow analysis service
- [ ] Enhanced LLM prompts with cross-session data
- [ ] Graph-derived insights
- [ ] API endpoint updates

### Phase 6: Frontend Integration
- [ ] Update WorkflowAnalysisPanel component
- [ ] Cross-session insights UI
- [ ] Entity cloud visualization
- [ ] Workflow pattern charts

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   Workflow Analysis Service (Enhanced)                   │   │
│  │   - Orchestrates Graph + Vector queries                  │   │
│  │   - Aggregates cross-session context                     │   │
│  │   - Generates relationship-aware insights                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           ↓ ↓ ↓                                  │
│  ┌─────────────────┐   ┌─────────────────┐  ┌────────────────┐ │
│  │ ArangoDB Graph  │   │ pgvector Search │  │ LLM Provider   │ │
│  │ Service         │   │ Service         │  │ (Gemini,etc)   │ │
│  │ - Graph queries │   │ - Vector sim    │  │ - Insights     │ │
│  │ - Traversals    │   │ - Hybrid search │  │ - Summaries    │ │
│  └─────────────────┘   └─────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           ↓ ↓                    ↓
┌──────────────────────────────────────────────────────────────────┐
│                     STORAGE LAYER                                │
│  ┌────────────────────────┐      ┌──────────────────────────┐   │
│  │   ArangoDB (Graph)     │      │  PostgreSQL (Vectors)    │   │
│  │                        │      │                          │   │
│  │  Collections:          │      │  Tables:                 │   │
│  │  - Users               │      │  - workflow_screenshots  │   │
│  │  - Sessions            │      │  - concept_embeddings    │   │
│  │  - Activities          │      │  - entity_embeddings     │   │
│  │  - Entities            │      │                          │   │
│  │  - Concepts            │      │  Extensions:             │   │
│  │                        │      │  - pgvector (embeddings) │   │
│  │  Edge Collections:     │      │                          │   │
│  │  - BELONGS_TO          │      │  Indexes:                │   │
│  │  - FOLLOWS             │      │  - IVFFlat (vectors)     │   │
│  │  - USES                │      │  - GIN (full-text)       │   │
│  │  - RELATES_TO          │      │  - B-tree (metadata)     │   │
│  │  - CONTAINS            │      │                          │   │
│  │  - SWITCHES_TO         │      │                          │   │
│  └────────────────────────┘      └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Performance Targets

- Screenshot ingestion: <100ms per screenshot (with graph writes)
- Entity extraction: <2s per batch (10 screenshots)
- Graph query (cross-session context): <500ms
- Vector similarity search: <200ms
- Full workflow analysis: <10s (including LLM)

---

## API Scripts Reference

```bash
# ArangoDB
pnpm db:init-arango              # Initialize ArangoDB schema

# PostgreSQL
pnpm db:migrate:graph-rag        # Run Graph RAG migration

# Development
pnpm dev                         # Start development server
docker-compose up -d             # Start ArangoDB
docker-compose down              # Stop ArangoDB
```

---

## Troubleshooting

### ArangoDB Connection Issues
```bash
# Check if container is running
docker ps | grep arangodb

# Check logs
docker logs lighthouse-arangodb

# Restart container
docker-compose restart arangodb
```

### PostgreSQL Migration Issues
```bash
# Check if tables exist
psql $DATABASE_URL -c "\dt *embeddings"

# Re-run migration
pnpm db:migrate:graph-rag
```

---

## Technical Decisions

1. **Why ArangoDB?**
   - Native graph traversal (AQL)
   - Multi-model (documents + graphs)
   - High performance for relationship queries
   - Mature ecosystem and drivers

2. **Why Dual Database Architecture?**
   - PostgreSQL: Optimized for vector similarity (pgvector)
   - ArangoDB: Optimized for graph traversals
   - Each database plays to its strengths
   - Eventual consistency model with conflict resolution

3. **Why IVFFlat Index?**
   - Good balance of speed and recall
   - Suitable for datasets <1M vectors
   - Lists parameter (100) optimized for current scale

---

## References

- [Plan Document](./plan.md) - Full implementation plan
- [ArangoDB Documentation](https://www.arangodb.com/docs/stable/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [pgvector](https://github.com/pgvector/pgvector)

---

**Last Updated:** 2025-12-30
**Next Review:** Phase 2 Implementation
