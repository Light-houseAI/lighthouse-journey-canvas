# Career AI Guide Setup

This document describes the Career AI Guide integration using the Mastra framework.

## Overview

The Career AI Guide is an intelligent agent that helps users track their professional journey and achieve career goals. It features:

- **Multi-layer Memory System**: Uses Redis, PostgreSQL, and Qdrant for different types of memory
- **Onboarding Flow**: Structured conversation to understand user's projects and goals
- **Milestone Extraction**: Automatically identifies and categorizes career milestones from conversations
- **Contextual Guidance**: Provides personalized advice based on user's career interest
- **Real-time Chat**: Streaming responses with Server-Sent Events

## Architecture

### Memory Layers
1. **Working Memory** (Redis): Current conversation state, onboarding progress
2. **Conversation History** (PostgreSQL): Persistent chat messages and threads
3. **Semantic Memory** (Qdrant): Vector embeddings for context retrieval across conversations

### Database Tables
- `chat_messages`: Individual chat messages
- `conversations`: Conversation threads with metadata
- `user_profiles`: User working memory and context
- `message_embeddings`: Vector embeddings for semantic search

## Setup Instructions

### 1. Environment Variables

Update your `.env` file with the following:

```bash
# OpenAI API Key (required)
OPENAI_API_KEY="your_openai_api_key_here"

# PostgreSQL Database (required)
DATABASE_URL="postgresql://username:password@localhost:5432/lighthouse_journey"

# Redis (optional - defaults to localhost:6379)
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# Qdrant Vector Database (optional - defaults to localhost:6333)
QDRANT_URL="http://localhost:6333"
QDRANT_API_KEY=""
```

### 2. Database Setup

Run the database migration to create the career AI tables:

```bash
npm run db:push
```

### 3. External Services

#### Redis (for working memory)
```bash
# Using Docker
docker run -d --name redis -p 6379:6379 redis:latest

# Using Homebrew (macOS)
brew install redis
brew services start redis
```

#### Qdrant (for vector storage)
```bash
# Using Docker
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant:latest

# The system will automatically create the 'career_conversations' collection
```

### 4. Start the Application

```bash
npm run dev
```

The Career AI Guide will be available through the voice chat panel on the professional journey page.

## API Endpoints

### Chat Endpoints
- `POST /api/ai/chat` - Main chat with streaming responses
- `POST /api/ai/onboard` - Onboarding flow management
- `GET /api/ai/threads/:userId` - Get user's conversation threads

### Analysis Endpoints
- `POST /api/ai/analyze-milestone` - Extract milestones from messages
- `POST /api/ai/generate-questions` - Generate contextual follow-up questions

## Usage Flow

### 1. Onboarding Process
When a user first opens the chat panel:
1. Agent confirms current role from LinkedIn profile
2. Asks about 1-3 main projects/initiatives
3. Collects one-sentence goals for each project
4. Creates project sub-milestones under current job

### 2. Ongoing Conversations
For returning users:
- Agent remembers previous projects and context
- Extracts milestones from career updates
- Asks specific follow-up questions
- Provides guidance based on career interest

### 3. Milestone Extraction
The system automatically:
- Categorizes messages (education, job, skill, project, etc.)
- Extracts skills and achievements
- Links updates to existing roles/organizations
- Generates clarifying questions

## Key Features

### Dynamic Memory
- **Working Memory**: Tracks current projects, goals, and career interest
- **Semantic Recall**: Finds relevant past conversations across all threads
- **Conversation History**: Maintains context within chat sessions

### Intelligent Categorization
- Automatically identifies milestone types
- Extracts technical and soft skills
- Links updates to existing career nodes
- Provides confidence scores for extractions

### Contextual Responses
- Adapts based on user's career interest (job search, growth, transition, startup)
- Remembers specific project names and goals
- Provides relevant follow-up questions

## Development Notes

### Custom Storage Adapter
The `StorageAdapter` class maps Mastra's memory interfaces to our database tables, providing:
- Message storage and retrieval
- Working memory persistence
- Embedding storage for semantic search
- User profile management

### Milestone Extractor
The `MilestoneExtractor` class provides sophisticated career milestone analysis:
- Context-aware extraction using LLM
- Skill categorization (technical, soft, domain-specific)
- Relationship detection with existing career nodes
- Follow-up question generation

### Error Handling
- Graceful fallbacks for missing services (Redis, Qdrant)
- Service initialization checks
- Streaming error recovery
- Memory persistence failures

## Troubleshooting

### Common Issues

1. **AI Service Initializing**: Wait for OpenAI connection to establish
2. **Memory Not Persisting**: Check Redis connection and DATABASE_URL
3. **No Semantic Recall**: Verify Qdrant is running and accessible
4. **Embedding Errors**: Ensure OpenAI API key has embedding access

### Debug Tips
- Check server logs for initialization messages
- Verify all external services are running
- Test API endpoints individually
- Monitor database connections

## Next Steps

Potential enhancements:
1. **Voice Integration**: Add speech-to-text and text-to-speech
2. **Advanced Analytics**: Career progression insights and trends
3. **Goal Tracking**: Automated progress tracking and reminders
4. **Integration**: Connect with calendar, email, or project management tools
5. **Multi-modal**: Support for document uploads and image analysis