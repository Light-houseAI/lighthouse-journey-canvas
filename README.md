# 🌟 Lighthouse AI - Career Journey Visualizer

**AI-powered career journey visualization with voice interaction**

**Live Demo**: https://lovable.dev/projects/31d9bc6d-96bd-4f61-8770-e46655d9b7f9

## 🚀 Overview

Lighthouse AI is a production-level web application that transforms career storytelling into an interactive, RPG-style visualization. Using advanced AI voice interaction, users can naturally describe their professional journey while the system creates a beautiful, node-based career map.

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/31d9bc6d-96bd-4f61-8770-e46655d9b7f9) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## 🛠️ Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS with custom RPG theme
- Framer Motion for animations
- React Flow for career journey visualization
- shadcn/ui component library

**Key Features:**
- 🎨 **RPG-Themed Design**: Dark fantasy aesthetic with glowing nodes and glass-morphism
- 🗺️ **Interactive Career Map**: Drag-and-drop career journey visualization
- 🎙️ **Voice Interaction**: AI-powered voice chat panel (UI ready for integration)
- 🌊 **Smooth Animations**: Framer Motion powered transitions
- 📱 **Responsive Design**: Works on desktop and mobile
- 🎯 **TypeScript**: Full type safety throughout

## 🏗️ Project Structure

```
src/
├── components/
│   ├── CareerJourney.tsx       # Main career visualization component
│   ├── MilestoneNode.tsx       # Individual career milestone nodes
│   ├── VoiceChatPanel.tsx      # AI voice interaction panel
│   └── ui/                     # shadcn/ui components
├── pages/
│   └── Index.tsx               # Main page
└── index.css                   # RPG-themed design system
```

## 🎮 Features

### Career Journey Visualization
- **Interactive Node Graph**: Drag, zoom, and explore your career path
- **Milestone Types**: Education, Jobs, Transitions, and Skills with unique styling
- **Dynamic Connections**: Automatically linked career progression
- **Beautiful Animations**: Smooth transitions and hover effects

### AI Voice Assistant (UI Ready)
- **Glass-morphism Panel**: Elegant floating chat interface
- **Mock Conversations**: Demonstrates AI career guidance flow
- **Real-time Transcription**: UI ready for speech-to-text integration
- **Milestone Extraction**: Automatically adds career milestones from conversations

### Design System
- **RPG Theme**: Dark fantasy aesthetic with purple/gold accents
- **Glass Effects**: Backdrop blur and transparency effects
- **Glow Animations**: Node highlighting and pulsing effects
- **Responsive Layout**: Mobile-friendly design

## 🔧 Development Setup

### Environment Variables (for future integrations)
Create a `.env.local` file:
```bash
# OpenAI Realtime API (for voice)
VITE_OPENAI_API_KEY=your_key_here

# Twilio (for WebRTC)
VITE_TWILIO_ACCOUNT_SID=your_sid_here
VITE_TWILIO_AUTH_TOKEN=your_token_here

# Backend API (when implemented)
VITE_API_BASE_URL=http://localhost:3001
```

### Running Locally
```bash
npm install
npm run dev
```

## 🚀 Production Features Ready for Integration

### Backend Architecture (Planned)
- **Node.js/Express** or **Python/FastAPI**
- **PostgreSQL** with Prisma/SQLAlchemy
- **WebSocket** real-time updates
- **OpenAPI** documentation

### Voice Integration (UI Complete)
- **WebRTC** or **Twilio** for voice
- **OpenAI Realtime API** for transcription
- **Real-time milestone extraction**

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/31d9bc6d-96bd-4f61-8770-e46655d9b7f9) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
