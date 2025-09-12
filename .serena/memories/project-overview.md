# Project Overview: Lighthouse

## Purpose
Lighthouse is a professional timeline and career journey visualization application. It allows users to create, manage, and share their professional experiences in an interactive timeline format. The application is currently being enhanced with a new Profile List View feature that transforms the existing timeline visualization into a simplified tree-based list format.

## Current Feature Under Development
**Timeline Journey Profile View**: A new profile page that displays career journey nodes in a simplified tree-based list format, separating current and past experiences using a hierarchical tree structure.

## Tech Stack

### Frontend (React SPA)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter (lightweight routing library)
- **State Management**: 
  - Zustand for client state management
  - TanStack Query (React Query) for server state
- **UI Library**: Radix UI components with Tailwind CSS styling
- **Authentication**: JWT tokens with custom token manager
- **Testing**: Vitest + React Testing Library + Playwright

### Backend (Node.js API)
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with session management
- **API Documentation**: OpenAPI/Swagger schema

### Development Tools
- **Package Manager**: pnpm
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier with Tailwind plugin
- **Git Hooks**: Husky with lint-staged
- **Build**: Vite for client, esbuild for server

## Architecture Patterns
- **Monorepo**: Client and server in same repository with shared types
- **Store Architecture**: Separate concerns between data fetching (TanStack Query) and UI state (Zustand)
- **Component Structure**: Radix UI primitives with custom styling
- **Testing Strategy**: Contract tests, unit tests, integration tests, and E2E tests