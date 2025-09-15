# Project Overview - Lighthouse Journey Canvas

## Purpose

The Lighthouse Journey Canvas is an intelligent, interactive career visualization platform that combines a dynamic timeline with AI-powered conversations. Users can track their professional journey through an intuitive React Flow-based interface that automatically organizes experiences, projects, and skills while providing contextual insights through natural language interaction.

## Tech Stack

- **Frontend**: React 18.3.1 with TypeScript, Vite build system
- **State Management**: Zustand 5.0.6
- **Timeline Visualization**: React Flow (@xyflow/react 12.8.2)
- **UI Components**: Radix UI components with shadcn/ui, Tailwind CSS
- **Backend**: Node.js with Express 4.21.2
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenAI GPT with Mastra framework (@mastra/core 0.11.1)
- **Authentication**: Passport.js with express-session
- **Vector DB**: Qdrant for semantic search (optional)
- **Caching**: Redis for session storage
- **Testing**: Newman for API testing, Postman collections

## Key Features

- Interactive timeline with React Flow nodes and edges
- AI-powered chat interface for career guidance
- Automatic skill extraction and tracking
- STAR format story collection
- Real-time UI updates via WebSocket
- Progressive information capture based on available time
- Professional journey visualization with work, education, and project nodes
