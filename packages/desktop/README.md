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
- 📸 **Screenshot Processing** ✨ NEW - Upload screenshots for OCR and automatic insight generation (Ollama only)
- 🔒 **Privacy-First Local LLMs** - Run entirely on-device with Ollama (no cloud APIs)
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
- **LLM Options:**
  - **Ollama** - Local models (Llama 3.2, Qwen, Gemma, etc.) with vision support ⭐ Recommended
  - **Vercel AI SDK** - OpenAI integration (GPT-4o-mini)
  - **Anthropic Claude** (Haiku)
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

### Using Ollama - Local & Privacy-First (Recommended) ✨

**NEW**: Run entirely locally with no cloud APIs required!

```bash
# 1. Pull required models
ollama pull llama3.2:3b           # Text model (fast, 4GB RAM)
ollama pull llava:7b-v1.6-mistral-q4_0   # Vision model for screenshots (4GB RAM)

# 2. Start Ollama
ollama serve

# 3. Configure app (create .env file)
echo "LLM_ADAPTER=ollama" > .env
echo "OLLAMA_TEXT_MODEL=llama3.2:3b" >> .env
echo "OLLAMA_VISION_MODEL=llava:7b-v1.6-mistral-q4_0" >> .env

# 4. Start app
npm start
```

**Benefits:**
- ✅ **100% Free** - No API costs
- ✅ **Privacy-First** - All processing on-device
- ✅ **Offline Capable** - Works without internet
- ✅ **Screenshot Processing** - Vision models for OCR and insight extraction
- ✅ **Model Choice** - Use any compatible Ollama model

**Screenshot Processing (Vision Feature):**
With Ollama, you can now upload screenshots of resumes or documents for automatic:
- Text extraction (OCR)
- Structured data parsing
- Context-aware suggestions based on extracted content

### Using OpenAI

Cloud-based with excellent quality:

```bash
export LLM_ADAPTER=openai
export OPENAI_API_KEY=your_key_here
npm start
```

### Using Claude

```bash
export LLM_ADAPTER=claude
export ANTHROPIC_API_KEY=your_key_here
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
│   │   ├── llm-service.ts                    # LLM service with adapter support
│   │   ├── ollama-adapter.ts                 # Ollama adapter (text + vision)
│   │   ├── screenshot-processing-service.ts  # Screenshot OCR and insights
│   │   ├── profile-loader.ts                 # Load user profiles
│   │   └── network-insights-service.ts       # Generate network insights
│   └── main.ts                               # IPC handlers
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

## Available Ollama Models

### Text Models (for suggestions)

| Model | Size | RAM | Speed | Quality | Command |
|-------|------|-----|-------|---------|---------|
| **llama3.2:3b** ⭐ | 3B | 4GB | Very Fast | Good | `ollama pull llama3.2:3b` |
| llama3.2:11b | 11B | 8GB | Fast | Very Good | `ollama pull llama3.2:11b` |
| qwen2.5:7b | 7B | 6GB | Fast | Excellent | `ollama pull qwen2.5:7b` |
| gemma2:9b | 9B | 8GB | Medium | Excellent | `ollama pull gemma2:9b` |
| mistral:7b | 7B | 6GB | Fast | Very Good | `ollama pull mistral:7b` |

### Vision Models (for screenshots)

| Model | Size | RAM | OCR Accuracy | Command |
|-------|------|-----|--------------|---------|
| **llama3.2-vision:11b** ⭐ | 11B | 8GB | 85-90% | `ollama pull llama3.2-vision:11b` |
| llama3.2-vision:90b | 90B | 64GB | 95%+ | `ollama pull llama3.2-vision:90b` |
| llava:latest | 7B | 6GB | 80-85% | `ollama pull llava:latest` |
| minicpm-v:latest | 8B | 8GB | 85-90% | `ollama pull minicpm-v:latest` |

**Change models via .env:**
```bash
OLLAMA_TEXT_MODEL=qwen2.5:7b
OLLAMA_VISION_MODEL=llama3.2-vision:11b
```

## LLM Behavior

- Suggestions appear after 800ms of inactivity
- Minimum 10 characters required
- Only shows suggestions with ≥80% confidence
- Toast notifications for suggestions and errors
- Retry button for recoverable errors
- **Network insights enhance suggestion quality and personalization**
- **Screenshot processing extracts text and generates 3 tailored suggestions** (Ollama only)

## POC Limitations

- No persistence (session-only editing)
- Mock network data (not connected to real graph database)
- Single profile editing at a time
- No authentication
- No collaboration features
- Screenshot processing requires Ollama (not available with OpenAI/Claude adapters)

## Future Enhancements

### Implemented ✅
- Local LLM support via Ollama
- Screenshot OCR and processing with vision models
- Multiple adapter support (Ollama/OpenAI/Claude)
- User-configurable model selection

### Planned 🚀
- UI for screenshot upload and processing
- Batch screenshot processing
- Screenshot history and comparison
- Connect to real network graph (LinkedIn, company directory)
- Real-time network updates
- Compare multiple career paths
- Network visualization
- Personalized insights dashboard
- Export career trajectory analysis
- Fine-tuned local models for career writing

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
