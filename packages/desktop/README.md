# Lighthouse Insight Assistant - Desktop POC

Electron desktop app for LLM-powered real-time career profile editing with **network insights**.

## Overview

This POC demonstrates:
1. LLM-assisted profile editing with network-aware suggestions
2. Real-time AI insights using professional network context
3. Career path recommendations based on network patterns

## Features

- 🎯 **Intent-based editing** - Choose what to work on (job, education, project, insights)
- 🤖 **Real-time AI suggestions** - Get contextual feedback as you type (800ms debounce)
- 🌐 **Network-aware insights** - LLM uses your professional network context for better suggestions
- 💾 **Session-only editing** - Changes not persisted (POC only)
- 🎨 **Clean UI** - Three-screen flow: Profile → Intent → Editor

## Network Insights Integration

The app includes **network insights** that provide the LLM with context about:

- Your professional connections (names, roles, companies)
- Common companies and schools in your network
- Overlapping skills with your network
- Career path patterns from successful transitions in your network
- Industry distribution of your connections

This enables the LLM to provide suggestions like:
- "Based on Sarah Chen's transition from Senior to Staff Engineer at Google..."
- "Your network shows strong expertise in Microservices - consider highlighting this"
- "Common career path in your network: IC → Manager in 4-6 years"

## Tech Stack

- **Electron** 38+ with Forge + Vite
- **React** 18 with TypeScript
- **Vercel AI SDK** - OpenAI integration (GPT-4o-mini)
- **Anthropic Claude** (Haiku) for LLM
- **Sonner** for toast notifications
- **Tailwind CSS** for styling

## Setup

```bash
# Install dependencies (using npm for Electron compatibility)
npm install

# Start development server
npm start
```

## Configuration

### Using OpenAI with Network Insights (Recommended)

Set environment variables:

```bash
export LLM_ADAPTER=openai
export OPENAI_API_KEY=your_key_here
npm start
```

The OpenAI adapter (GPT-4o-mini via Vercel AI SDK) is optimized to use network insights for context-aware suggestions.

### Using Claude

```bash
export LLM_ADAPTER=claude
export ANTHROPIC_API_KEY=your_key_here
npm start
```

### Using Mock Adapter (Default)

No API key needed - runs with simulated suggestions:

```bash
npm start
```

## Usage

1. **Select Profile** - Click on a profile card
2. **Choose Intent** - Pick editing goal from the intent selector screen
3. **Start Editing** - Type in the textarea
4. **Receive Insights** - Toast notifications with network-aware suggestions appear after 800ms
5. **Stop Session** - Click "Stop Session" to return to profile selection

## Project Structure

```
src/
├── main/
│   ├── services/
│   │   ├── llm-service.ts          # LLM adapters (Mock, OpenAI, Claude)
│   │   ├── profile-loader.ts       # Load user profiles
│   │   └── network-insights-service.ts  # Generate network insights
│   └── main.ts                     # IPC handlers
├── renderer/
│   ├── App.tsx                     # Main React component
│   └── hooks/
│       └── useDebounce.ts          # Debounce hook
└── shared/
    └── types.ts                    # Shared types including NetworkInsights
```

## Network Insights Types

```typescript
interface NetworkInsights {
  connections: NetworkConnection[]        // Your network connections
  commonCompanies: string[]              // Shared employers
  commonSchools: string[]                // Shared education
  industryDistribution: Record<string, number>  // Industry breakdown
  skillOverlap: string[]                 // Common skills
  careerPaths: CareerPath[]             // Successful career transitions
}

interface CareerPath {
  description: string                    // Career transition pattern
  examplePeople: string[]               // People who took this path
  commonTransitions: string[]           // Steps in the transition
  timeframe: string                     // How long it typically takes
}
```

## LLM Behavior

- Suggestions appear after 800ms of inactivity
- Minimum 10 characters required
- Only shows suggestions with ≥80% confidence
- Toast notifications for suggestions and errors
- Retry button for recoverable errors
- **Network insights enhance suggestion quality and personalization**

## POC Limitations

- No persistence (session-only editing)
- Mock network data (not connected to real graph database)
- Single profile editing at a time
- No authentication
- No collaboration features

## Future Enhancements

- Connect to real network graph (LinkedIn, company directory)
- Real-time network updates
- Compare multiple career paths
- Network visualization
- Personalized insights dashboard
- Export career trajectory analysis

## Development Commands

```bash
npm start          # Start dev server
npm run package    # Package for distribution
npm run make       # Create installers
```

## License

MIT

---

**Status**: POC Complete
**Linear**: LIG-195
**Date**: 2025-10-07
