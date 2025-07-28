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

### January 24, 2025 - Enhanced Chat Experience with Visual Cues
- **Glowing Chat Icon**: Implemented video game-style glowing chat icon with pulsing animation for new users
- **Intelligent Chat Prompts**: Chat bubble automatically appears with personalized welcome message based on LinkedIn data
- **Automatic Update Processing**: Fixed infinite loop issue - chat now properly creates sub-milestones without repetitive questions
- **Enhanced Project Matching**: Improved AI logic to intelligently match user updates to correct journey nodes
- **Visual Notification System**: Added notification dot and glow effects when users need to interact with chat
- **Contextual Welcome Messages**: Different messages for new users (onboarding) vs returning users (project updates)
- **Smart Timing**: Chat prompts appear after 2 seconds for new users, 1.5 seconds for returning users
- **Proper User Data Flow**: Fixed onboarding detection by properly passing user authentication data to chat component
- **JavaScript Error Fix**: Resolved "Cannot access 'profile' before initialization" by reordering hook declarations
- **Logout Functionality**: Added logout button to professional journey dashboard header with proper session termination

### January 24, 2025 - Intelligent Conversational AI System Implementation
- **Complete AI Conversation Rewrite**: Implemented proper step-by-step update processing following milestone capture guide
- **Parse → Classify → Preview → Confirm Flow**: AI now parses user updates, classifies as milestones vs subtasks, shows preview, and waits for confirmation
- **Intelligent Context Understanding**: AI identifies which company/project updates relate to and suggests appropriate placement
- **Voice Update Persistence Fixed**: Voice chat updates now properly saved to database and persist across page reloads
- **Smart Classification System**: Automatic detection of milestones (major achievements) vs subtasks (progress steps)
- **Preview-Before-Save**: Users see exactly what will be added and can confirm or edit before saving
- **Edit/Delete Node Functionality**: Users can click on update nodes to edit titles/descriptions or delete them
- **Contextual Response System**: AI provides different responses based on conversation state and user input context
- **Seamless Deletion with Hierarchy Management**: When deleting nodes, child milestones automatically connect to deleted node's parents, maintaining journey flow
- **PDF-Guided Conversation System**: Implemented comprehensive 8-step update processing following milestone capture guide
- **Enhanced Milestone Classification**: AI now follows PDF criteria to distinguish milestones (significant events) vs subtasks (supporting steps)
- **Improved Preview Format**: Preview messages follow PDF format with proper milestone/subtask grouping and confirmation workflow
- **Fixed Milestone Positioning**: Milestone labels now positioned further from parent nodes to prevent covering icons

### January 24, 2025 - Overlay Chat Interface Implementation
- **Complete Chat UX Redesign**: Replaced window-based chat panel with overlay-style interface inspired by lighthouse-journey-canvas project
- **Center-Screen Message Display**: Messages now appear directly on screen and auto-fade after 8 seconds instead of persistent chat window
- **Beautiful Gradient Messages**: User messages in green gradient, AI messages in purple gradient with glass-morphism effects
- **Bottom Control Bar**: Voice and text input controls positioned at bottom of screen with smooth animations
- **Processing Indicators**: Real-time visual feedback for listening, processing, and transcription states
- **Immersive Experience**: Chat now feels integrated with the journey visualization rather than separate window overlay
- **Fixed New User Onboarding**: Corrected onboarding detection so new users are immediately prompted with proper 4-step conversation flow
- **PDF-Guided Onboarding**: Implemented complete onboarding sequence following attached guide (welcome → projects → goals → completion)
- **Automatic Chat Launch**: New users now have chat automatically opened to begin onboarding immediately after profile extraction

### January 25, 2025 - Enhanced Chat Experience and Manual Milestone Addition
- **Smart Chat Minimize Functionality**: Chat properly minimizes when clicking on journey areas, allowing full-screen journey visualization
- **Responsive Layout System**: Journey visualization adjusts layout to use full screen space when chat is minimized
- **Manual Milestone Addition**: Added '+' buttons on career milestones that trigger contextual AI conversations for adding sub-projects
- **Context-Aware Conversations**: Plus button clicks clear chat history and start fresh conversations specific to milestone creation
- **Improved Input Positioning**: Text field and microphone button now properly positioned below chat messages for better user experience
- **AI-Assisted Milestone Creation**: Backend endpoint `/api/create-milestone` processes user input and creates structured milestone data
- **Enhanced User Experience**: Seamless flow from milestone selection to AI conversation to visual addition on journey canvas

### January 25, 2025 - Complete OpenAI Integration and Chat UX Improvements
- **Real OpenAI Integration**: Replaced all mock AI responses with authentic OpenAI GPT-4o powered conversations
- **Context-Aware Plus Button**: Fixed '+' button functionality to properly remember company context (e.g., Walmart vs Amazon)
- **Progressive STAR Conversation**: Implemented step-by-step STAR format (Situation → Task → Action → Result) without repetitive questions
- **OpenAI Whisper Voice Integration**: Added two-way voice conversations using OpenAI's Whisper API for transcription
- **Enhanced Message Management**: Messages now fade at top but remain scrollable with timestamps for older messages
- **Intelligent Message Opacity**: Recent messages appear at full opacity, older messages fade to 40% but stay accessible
- **File Upload Support**: Added multer middleware for audio file processing and transcription
- **Company-Specific Context**: Plus buttons now trigger conversations specific to the clicked milestone's organization
- **Persistent Chat History**: All messages remain in scrollable history with proper visual hierarchy
- **Professional AI Responses**: OpenAI responses are concise, encouraging, and focus on career development goals

### January 25, 2025 - Milestone Persistence and Horizontal Layout Implementation
- **Fixed Database Persistence**: Enhanced `/api/save-milestone` endpoint with comprehensive logging and error tracking to ensure milestones persist across login sessions
- **Horizontal Milestone Layout**: Implemented horizontal positioning system for sub-milestones matching reference design - milestones now appear to the right of parent nodes at same vertical level
- **Enhanced Parent Node Detection**: Improved company name matching logic to correctly identify parent nodes (e.g., Walmart experience) for proper milestone connection
- **Smart Positioning Algorithm**: Sub-milestones positioned at parentNode.x + 200 + (count * 250) spacing for clean horizontal timeline layout
- **Persistent Loading Logic**: Fixed milestone loading from database to recreate nodes with correct horizontal positioning and parent connections
- **Visual Consistency**: Sub-milestones now display in horizontal timeline format consistent with user's reference screenshot design

### January 25, 2025 - Redis Connection Optimization & Replit Database Migration
- **Replaced Redis with Replit Database**: Completely migrated from Redis/Upstash to Replit's native key-value store for AI chat memory
- **Redis Adapter Layer**: Created Redis-compatible interface for seamless integration with existing AI memory management code
- **Clean Server Startup**: Eliminated all Redis connection errors and network issues in Replit environment
- **Environment-Native Storage**: Using Replit Database ensures reliable connectivity without external service dependencies
- **Memory Management**: Chat conversations, thread management, and AI context now stored in Replit's built-in database
- **Zero Configuration**: No external credentials or connection strings needed - works automatically in Replit environment
- **Centralized Adapter**: Created `/server/adapters/redis-adapter.ts` with Redis-compatible interface for clean, maintainable code architecture
- **Eliminated Code Duplication**: Replaced all duplicate Redis adapter implementations with single centralized adapter instance

### January 25, 2025 - Chat System JSON Parsing & Data Structure Fixes
- **Fixed Critical JSON Parsing Bug**: Resolved thread creation issue where Replit Database returned nested `{ok: true, value: ...}` structures
- **Smart Data Unwrapping**: Enhanced RedisAdapter to automatically unwrap nested response structures from Replit Database
- **Corruption Detection**: Added thread data validation to detect and fix corrupted thread records automatically
- **Chat Functionality Restored**: AI conversations, voice transcription, and milestone creation now working seamlessly
- **Memory Persistence Fixed**: Short-term and long-term conversation memory now properly maintained across sessions
- **Thread Management**: Clean thread creation, rotation, and archival working with proper data structures
- **Streaming Responses**: Real-time AI conversation streaming fully operational with OpenAI integration
- **Production Ready**: Chat system now stable and reliable for professional journey conversations and milestone capture

### January 25, 2025 - Project Updates Scroll Fix & Profile Data Management
- **Fixed Project Updates Scrolling**: Resolved modal scroll issue in both ProjectUpdatesModal and MilestoneNode components
- **Enhanced Modal Layout**: Restructured modals with proper flexbox layout using `max-h-[80vh]` and dedicated scroll areas
- **Improved User Experience**: Project updates now properly scrollable with fixed headers and flexible content areas
- **Profile Data Management**: Added capability to delete user profiles and associated data for username reclamation
- **Database Cleanup**: Successfully removed keshah profile data to allow new user registration with same extracted LinkedIn data

### January 25, 2025 - RPG-Themed Authentication UI Implementation
- **Complete Auth Screen Redesign**: Updated Sign In and Sign Up pages to match journey visualization design language
- **Dark Purple Gradient Background**: Implemented consistent background with slate-900 to purple-900 gradient matching main canvas
- **Starfield Pattern Integration**: Added same dotted/starfield background pattern as journey visualization with purple star colors
- **Glassmorphism Authentication Cards**: Floating cards with translucent background, backdrop blur, and purple border glow effects
- **Gradient Typography**: Purple-to-pink gradient headings with themed messaging ("Welcome back", "Begin Your Journey")
- **Enhanced Input Styling**: Semi-translucent inputs with purple borders, white text, and focus glow effects matching node aesthetics
- **Gradient Button Design**: Purple-to-pink gradient buttons with hover scaling, glow shadows, and loading spinner animations
- **Smooth Animations**: Framer Motion entrance animations with staggered timing for card, form, and link elements
- **Consistent Link Styling**: Purple accent links with hover effects and gradient underlines matching canvas design system