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

## Recent Changes

### January 23, 2025 - ZenRows Integration Success
- **Real LinkedIn Data Extraction**: Successfully configured ZenRows API with premium proxies
- **Authenticated Scraping**: Confirmed extraction of authentic profile data including:
  - Names, locations, professional headlines
  - Complete work experience history (11+ positions)
  - Education background with institution details
  - Full about sections and descriptions
- **Multiple Fallback Methods**: Implemented direct HTTP requests and alternative scraping approaches
- **Enhanced Parsing**: Added JSDOM support and improved JSON-LD structured data extraction
- **Comprehensive Error Handling**: Added detailed logging, graceful fallbacks, and debugging capabilities

### January 23, 2025 - Multi-Source Data Aggregation & PDL Priority
- **Comprehensive Profile Extraction**: Built multi-source data aggregation system
- **People Data Labs Priority Integration**: Successfully implemented PDL-first extraction (10+ experiences, 5+ education, 15+ skills)
- **Smart Data Prioritization**: PDL takes priority when comprehensive professional data available, LinkedIn as fallback
- **Enhanced Professional Data**: Real-time extraction from 1.5B profile database with detailed work history and education
- **GitHub Integration**: Added GitHub profile and repository language extraction for technical skills
- **Professional Directories**: Integrated Crunchbase and AngelList directory searching
- **Web Search Enhancement**: Implemented ZenRows-powered web search for additional profile information
- **Smart Source Selection**: System intelligently determines when to search additional sources based on LinkedIn data completeness
- **Data Merging**: Safe profile data merging with deduplication and validation
- **Enhanced Frontend**: Updated UI to reflect comprehensive multi-platform extraction capabilities

### January 23, 2025 - Research Section Removal
- **Removed Additional Research Feature**: Completely removed research content extraction and UI components
- **Cleaned Schema**: Removed ProfileResearch type and research field from ProfileData schema
- **Simplified Extraction**: Streamlined extraction process to focus on core professional data (experiences, education, skills)
- **UI Cleanup**: Removed research selection interface from profile review page
- **Service Cleanup**: Deleted research-extractor.ts service and removed all research-related logic

### January 24, 2025 - Complete Authentication System Implementation
- **Full User Authentication**: Implemented comprehensive signup/signin with bcryptjs password hashing and PostgreSQL sessions
- **2-Step Onboarding Flow**: Built complete onboarding with career interest selection and profile extraction
- **Protected Routes**: All profile features now require authentication and completed onboarding
- **Session Management**: Users maintain login state across page reloads with secure session storage
- **Navigation Fixes**: Resolved authentication routing issues with proper page reloads and query cache invalidation
- **Onboarding Completion**: Fixed post-extraction flow to redirect users to home page after successful onboarding

### January 24, 2025 - Professional Journey Timeline Implementation
- **Professional Journey Component**: Built comprehensive timeline component to display career progression
- **Visual Timeline**: Created beautiful timeline visualization with company/education icons and career progression
- **Multi-Source Data Display**: Shows extracted experiences and education from People Data Labs and LinkedIn
- **Complete Onboarding Flow**: signup → interest → LinkedIn extraction → profile review → professional journey → home
- **Data Integration**: Connected saved profile data to journey visualization with proper API endpoints
- **Timeline Features**: Chronological display, date ranges, descriptions, location info, and visual career progression

### January 24, 2025 - RPG-Themed Career Journey with Voice Integration
- **GitHub Integration**: Successfully integrated RPG-themed career journey visualizer from user's lighthouse-journey-canvas repository
- **React Flow Implementation**: Beautiful interactive milestone nodes with glassmorphism effects and purple gradients
- **Chronological Data Flow**: Selected profile data from extraction properly displayed in chronological order
- **Voice Chat Panel**: AI-powered voice assistant for adding career milestones via audio input
- **Real-time Updates**: Voice-generated milestones automatically appear as new nodes in the journey visualization
- **Interactive Features**: Click nodes for details, voice recording with microphone access, text input fallback
- **Complete Integration**: Voice panel with floating action button, milestone extraction from audio, and seamless UI

### January 24, 2025 - Complete Onboarding System and Journey-First UX
- **Automatic Onboarding Chat**: Built intelligent conversation flow that starts when users land on journey page
- **Smart Role Confirmation**: AI confirms current position from LinkedIn data with personalized welcome message
- **Project Collection**: Multi-step conversation gathers user's top 1-3 current projects and initiatives
- **Context Gathering**: AI asks detailed questions about each project to understand goals and scope
- **Visual Sub-Journey Creation**: All projects automatically added as connected sub-nodes under current experience
- **Sequential Project Positioning**: Fixed positioning system to display multiple sub-milestones without overlap
- **Journey-First Navigation**: Authenticated users now redirect directly to professional journey instead of extraction page
- **Enhanced UX**: Improved label spacing, styling, and visual hierarchy for better user experience
- **Complete Flow**: signup → interest → LinkedIn extraction → profile review → professional journey with automatic onboarding

### January 24, 2025 - Onboarding Context Persistence Implementation
- **Database Schema Updates**: Added `projects` field to profiles table and `hasCompletedOnboarding` flag to users table for permanent storage
- **Project Persistence**: Projects collected during onboarding now saved to database via `/api/save-projects` endpoint
- **Onboarding Completion Tracking**: Added `/api/onboarding/complete` endpoint to mark users as having completed onboarding
- **Smart Onboarding Detection**: Chat now checks user's `hasCompletedOnboarding` flag instead of relying on temporary UI state
- **Session Persistence**: Projects and onboarding status maintained across login sessions with proper database storage
- **Context-Aware Chat**: Returning users see different welcome messages and skip onboarding questions
- **Enhanced Storage Interface**: Extended storage layer with `saveProjectMilestones()` and `getProjectMilestones()` methods
- **Profile Data Enhancement**: Profile API now includes user data for onboarding status checking
- **Automatic Project Loading**: Saved projects automatically loaded and displayed as sub-nodes when users return