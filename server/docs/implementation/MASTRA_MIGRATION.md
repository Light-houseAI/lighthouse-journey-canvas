# Mastra AI Migration Guide

## Backward Compatibility Strategy

The Mastra AI integration is designed to be **completely backward compatible** with your existing application.

### What Stays the Same ✅

- All existing tables in `public` schema remain untouched
- Current user authentication and profile system works as before
- Existing API endpoints continue to function
- LinkedIn scraping and journey visualization unchanged
- Database migrations and existing data preserved

### What Gets Added 🆕

- New `mastra_ai` schema with Mastra-specific tables
- `pgvector` extension for semantic search
- AI conversation memory and working memory storage
- Vector embeddings for chat history

### Migration Steps

1. **Run the schema migration**:

   ```sql
   psql lighthouse_journey < migrations/add-mastra-ai-schema.sql
   ```

2. **Start the application**:
   ```bash
   npm run dev
   ```
3. **Mastra automatically creates its tables**:
   - `mastra_ai.threads` - conversation tracking
   - `mastra_ai.messages` - chat message storage
   - `mastra_ai.resources` - user working memory
   - `mastra_ai.conversations` - vector index for search

### Rollback Plan 🔄

If needed, you can completely remove Mastra components:

```sql
-- Remove Mastra schema and all its tables
DROP SCHEMA IF EXISTS mastra_ai CASCADE;

-- Optionally remove pgvector extension (only if not used elsewhere)
-- DROP EXTENSION IF EXISTS vector;
```

Your application will continue working exactly as before.

### Data Flow

**Existing Flow** (unchanged):

```
User → LinkedIn Scraper → Profiles Table → Journey Canvas
```

**New AI Flow** (additional):

```
User → AI Chat → Mastra Memory → Journey Enhancement
            ↓
    Milestone Extraction → Journey Canvas Updates
```

Both flows coexist without interference.
