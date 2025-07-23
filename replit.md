# LinkedIn Profile Extractor Application

## Overview

This is a full-stack TypeScript application that extracts LinkedIn profile data and allows users to review and selectively save profile information. The application features a React frontend with a Node.js/Express backend, using Drizzle ORM for database operations and modern UI components from shadcn/ui.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: React Hook Form for form handling, TanStack Query for server state
- **Build Tool**: Vite with hot module replacement and development plugins

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Style**: RESTful JSON APIs
- **Request Handling**: Express middleware for JSON parsing and logging
- **Error Handling**: Centralized error middleware with status code mapping

### Database & ORM
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: Shared schema definitions in `/shared/schema.ts`
- **Migrations**: Drizzle Kit for schema migrations
- **Connection**: Uses Neon Database serverless PostgreSQL
- **Storage Abstraction**: Interface-based storage layer with in-memory fallback

## Key Components

### Data Extraction Service
- **LinkedIn Extractor**: Dual-mode extraction using ZenRows API and Playwright fallback
- **Profile Parsing**: Structured extraction of profile data including experiences, education, and skills
- **Error Handling**: Graceful fallback between extraction methods

### Profile Management
- **Data Validation**: Zod schemas for type-safe profile data validation
- **Selective Storage**: Users can choose which profile fields to save
- **Duplicate Prevention**: Checks for existing profiles before extraction

### UI Components
- **Design System**: Comprehensive shadcn/ui component library
- **Form Handling**: React Hook Form with Zod validation
- **Responsive Design**: Mobile-first Tailwind CSS styling
- **User Feedback**: Toast notifications and loading states

### Session Management
- **Temporary Storage**: SessionStorage for profile data during review process
- **State Persistence**: Profile data maintained between extraction and review pages

## Data Flow

1. **Profile Extraction**:
   - User enters LinkedIn username
   - System attempts ZenRows API extraction
   - Falls back to Playwright if ZenRows fails
   - Returns structured profile data

2. **Profile Review**:
   - Extracted data stored in SessionStorage
   - User navigates to review page
   - Selective checkbox interface for data fields
   - Real-time preview of selected data

3. **Profile Saving**:
   - Validated profile data sent to backend
   - Duplicate check performed
   - Data saved to PostgreSQL database
   - Success confirmation displayed

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **playwright**: Web scraping fallback for LinkedIn extraction
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form state and validation

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **class-variance-authority**: Component variant management

### Development Dependencies
- **vite**: Build tool and development server
- **tsx**: TypeScript execution for development
- **esbuild**: Production bundling

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React app to `dist/public`
- **Backend**: esbuild bundles server code to `dist/index.js`
- **Database**: Drizzle migrations applied via `db:push` command

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **ZENROWS_API_KEY**: Optional API key for enhanced extraction
- **NODE_ENV**: Environment detection for development features

### Development Setup
- **Hot Reload**: Vite HMR for frontend changes
- **Auto-restart**: tsx for backend development
- **Error Overlay**: Runtime error display in development
- **Logging**: Request/response logging for API endpoints

### Production Considerations
- **Static Serving**: Express serves built frontend assets
- **Error Handling**: Production-safe error responses
- **Bundle Optimization**: Separate frontend/backend build processes
- **Database Migrations**: Schema changes via Drizzle Kit