# Ollama Setup Flow - Implementation Guide

## Overview

This document explains how to implement an automatic model download flow that ensures users have Ollama and required models installed on first launch.

## Architecture

```
App Start → Check Ollama Status → Check Models → Download if Missing → Ready
```

## Flow States

1. **Checking** - Verifying Ollama installation and running status
2. **Not Installed** - Ollama not detected (show install instructions)
3. **Not Running** - Ollama installed but not running (show "ollama serve" command)
4. **Missing Models** - Ollama running but models not downloaded (auto-download)
5. **Downloading** - Models downloading with progress
6. **Ready** - Everything set up, proceed to app

## Implementation

### 1. Setup Screen Component (React)

```tsx
// src/renderer/components/SetupScreen.tsx
import { useState, useEffect } from 'react'

type SetupStatus =
  | 'checking'
  | 'not-installed'
  | 'not-running'
  | 'downloading'
  | 'ready'
  | 'error'

interface ModelProgress {
  model: string
  status: 'downloading' | 'verifying' | 'completed' | 'failed'
  progress: number
  total: number
  completed: number
}

export function SetupScreen({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState<SetupStatus>('checking')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Map<string, ModelProgress>>(new Map())
  const [installInstructions, setInstallInstructions] = useState<string[]>([])

  useEffect(() => {
    checkSetup()
  }, [])

  const checkSetup = async () => {
    try {
      // 1. Check if Ollama is installed and running
      const statusResult = await window.electron.invoke('ollama-check-status')

      if (!statusResult.success || !statusResult.data) {
        setError(statusResult.error || 'Failed to check Ollama status')
        setStatus('error')
        return
      }

      const ollamaStatus = statusResult.data

      // 2. Not installed - show instructions
      if (!ollamaStatus.installed || !ollamaStatus.running) {
        const instructionsResult = await window.electron.invoke('ollama-get-install-instructions')
        setInstallInstructions(instructionsResult.data || [])
        setStatus(ollamaStatus.running ? 'not-installed' : 'not-running')
        return
      }

      // 3. Check required models
      const modelsResult = await window.electron.invoke(
        'ollama-check-models',
        'llama3.2:3b',
        'llama3.2-vision:11b'
      )

      if (!modelsResult.success || !modelsResult.data) {
        setError(modelsResult.error || 'Failed to check models')
        setStatus('error')
        return
      }

      const { textModel, visionModel } = modelsResult.data

      // 4. Both models available - ready!
      if (textModel.available && visionModel.available) {
        setStatus('ready')
        setTimeout(() => onReady(), 1000)
        return
      }

      // 5. Download missing models
      const modelsToDownload = []
      if (!textModel.available) modelsToDownload.push(textModel.name)
      if (!visionModel.available) modelsToDownload.push(visionModel.name)

      setStatus('downloading')
      await downloadModels(modelsToDownload)

    } catch (err: any) {
      console.error('Setup check failed:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  const downloadModels = async (models: string[]) => {
    // Listen for progress updates
    const handleProgress = (_event: any, data: ModelProgress) => {
      setProgress(prev => new Map(prev).set(data.model, data))

      // Check if all complete
      if (data.status === 'completed') {
        const allComplete = Array.from(progress.values()).every(
          p => p.status === 'completed'
        )
        if (allComplete) {
          setStatus('ready')
          setTimeout(() => onReady(), 1000)
        }
      }
    }

    window.electron.on('ollama-model-progress', handleProgress)

    try {
      // Start batch download
      const result = await window.electron.invoke('ollama-pull-models', models)

      if (!result.success) {
        throw new Error(result.error || 'Download failed')
      }

      if (result.data.failed.length > 0) {
        setError(`Failed to download: ${result.data.failed.join(', ')}`)
        setStatus('error')
      }

    } catch (err: any) {
      setError(err.message)
      setStatus('error')
    } finally {
      window.electron.removeListener('ollama-model-progress', handleProgress)
    }
  }

  const retrySetup = () => {
    setStatus('checking')
    setError(null)
    setProgress(new Map())
    checkSetup()
  }

  // Render based on status
  return (
    <div className="setup-screen">
      {status === 'checking' && <CheckingView />}
      {status === 'not-installed' && (
        <NotInstalledView
          instructions={installInstructions}
          onRetry={retrySetup}
        />
      )}
      {status === 'not-running' && <NotRunningView onRetry={retrySetup} />}
      {status === 'downloading' && (
        <DownloadingView progress={Array.from(progress.values())} />
      )}
      {status === 'ready' && <ReadyView />}
      {status === 'error' && (
        <ErrorView error={error} onRetry={retrySetup} />
      )}
    </div>
  )
}

function CheckingView() {
  return (
    <div className="text-center">
      <div className="spinner" />
      <h2>Checking Ollama Setup...</h2>
      <p>This will only take a moment</p>
    </div>
  )
}

function NotInstalledView({
  instructions,
  onRetry
}: {
  instructions: string[]
  onRetry: () => void
}) {
  return (
    <div>
      <h2>🚀 Let's Set Up Ollama</h2>
      <p>Ollama is required to run AI models locally (free & privacy-first)</p>

      <div className="instructions">
        <h3>Installation Steps:</h3>
        <pre>{instructions.join('\n')}</pre>
      </div>

      <a
        href="https://ollama.com/download"
        target="_blank"
        className="btn btn-primary"
      >
        Download Ollama
      </a>

      <button onClick={onRetry} className="btn btn-secondary">
        I've Installed Ollama - Check Again
      </button>
    </div>
  )
}

function NotRunningView({ onRetry }: { onRetry: () => void }) {
  return (
    <div>
      <h2>⚡ Start Ollama</h2>
      <p>Ollama is installed but not running</p>

      <div className="instructions">
        <p>Open a terminal and run:</p>
        <pre>ollama serve</pre>
      </div>

      <button onClick={onRetry} className="btn btn-primary">
        Check Again
      </button>
    </div>
  )
}

function DownloadingView({
  progress
}: {
  progress: ModelProgress[]
}) {
  return (
    <div>
      <h2>📥 Downloading Models</h2>
      <p>This may take a few minutes depending on your internet speed</p>

      {progress.map(p => (
        <div key={p.model} className="progress-item">
          <div className="flex justify-between">
            <span>{p.model}</span>
            <span>{p.progress}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${p.progress}%` }}
            />
          </div>
          <div className="text-sm text-gray-500">
            {formatBytes(p.completed)} / {formatBytes(p.total)}
          </div>
        </div>
      ))}
    </div>
  )
}

function ReadyView() {
  return (
    <div className="text-center">
      <div className="text-6xl">✅</div>
      <h2>All Set!</h2>
      <p>Starting app...</p>
    </div>
  )
}

function ErrorView({
  error,
  onRetry
}: {
  error: string | null
  onRetry: () => void
}) {
  return (
    <div>
      <h2>⚠️ Setup Error</h2>
      <p className="error">{error}</p>

      <div className="actions">
        <button onClick={onRetry} className="btn btn-primary">
          Try Again
        </button>
        <button
          onClick={() => window.electron.invoke('open-external', 'https://github.com/ollama/ollama/issues')}
          className="btn btn-secondary"
        >
          Get Help
        </button>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
```

### 2. Integrate Setup Screen into App

```tsx
// src/renderer/App.tsx
import { useState, useEffect } from 'react'
import { SetupScreen } from './components/SetupScreen'

function App() {
  const [setupComplete, setSetupComplete] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(true)

  useEffect(() => {
    // On app start, check if setup is needed
    checkIfSetupNeeded()
  }, [])

  const checkIfSetupNeeded = async () => {
    // Check if Ollama adapter is being used
    const adapterType = process.env.LLM_ADAPTER || 'ollama'

    if (adapterType !== 'ollama') {
      // Using OpenAI/Claude - skip setup
      setSetupComplete(true)
      setCheckingSetup(false)
      return
    }

    // Quick health check
    const healthResult = await window.electron.invoke('llm-health-check')

    if (healthResult.success && healthResult.data.running &&
        healthResult.data.textModelAvailable &&
        healthResult.data.visionModelAvailable) {
      // Already set up
      setSetupComplete(true)
    }

    setCheckingSetup(false)
  }

  if (checkingSetup) {
    return <div>Loading...</div>
  }

  if (!setupComplete) {
    return <SetupScreen onReady={() => setSetupComplete(true)} />
  }

  return (
    <div className="app">
      {/* Your main app UI */}
    </div>
  )
}
```

### 3. Environment Detection

Add to `.env`:

```bash
# Skip setup flow if using cloud APIs
LLM_ADAPTER=ollama

# Or use cloud API to skip local setup
# LLM_ADAPTER=openai
# OPENAI_API_KEY=sk-...
```

## Alternative: Background Download

For better UX, download models in the background while user explores:

```tsx
function App() {
  const [modelsReady, setModelsReady] = useState(false)

  useEffect(() => {
    // Start background download
    startBackgroundDownload()
  }, [])

  const startBackgroundDownload = async () => {
    // Check and download models silently
    const result = await window.electron.invoke('ollama-check-models', ...)

    if (!result.data.textModel.available || !result.data.visionModel.available) {
      // Show subtle notification
      toast.info('Downloading AI models in background...')

      await window.electron.invoke('ollama-pull-models', [...])

      toast.success('AI models ready!')
      setModelsReady(true)
    }
  }

  return (
    <div>
      {/* Main app - works even while downloading */}
      {!modelsReady && (
        <div className="banner">
          AI features will be available once models finish downloading
        </div>
      )}
    </div>
  )
}
```

## Best Practices

1. **Graceful Degradation**: Let users use the app with cloud APIs while local models download
2. **Progress Feedback**: Always show download progress - models can be large (2-8GB)
3. **Retry Logic**: Network issues are common - allow easy retry
4. **Skip Option**: Let advanced users skip if they want to manage Ollama themselves
5. **Storage Warning**: Warn users about disk space (10-15GB for all models)

## Testing

```bash
# Test without Ollama
# Should show installation UI

# Test with Ollama but no models
ollama serve
# Should auto-download models

# Test with everything
ollama pull llama3.2:3b
ollama pull llama3.2-vision:11b
# Should go straight to app
```

## User Experience

**First Time User:**
1. Launch app → See "Setting up Ollama..."
2. Not installed? → Copy install command → Download link
3. Installed? → Auto-download models with progress
4. Complete! → Use app

**Total Time:** 3-5 minutes (one-time setup)

**Returning User:**
1. Launch app → Instant start (no setup check needed)
