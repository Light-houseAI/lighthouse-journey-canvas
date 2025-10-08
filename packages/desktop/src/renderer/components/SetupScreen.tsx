import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'

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
  error?: string
}

interface SetupScreenProps {
  onReady: () => void
}

export function SetupScreen({ onReady }: SetupScreenProps) {
  const [status, setStatus] = useState<SetupStatus>('checking')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Map<string, ModelProgress>>(new Map())

  useEffect(() => {
    checkSetup()
  }, [])

  const checkSetup = async () => {
    try {
      setStatus('checking')
      setError(null)

      // 1. Check if Ollama is installed and running
      console.log('Checking Ollama status...')
      const statusResult = await window.electron.invoke('ollama-check-status')

      if (!statusResult.success || !statusResult.data) {
        setError(statusResult.error || 'Failed to check Ollama status')
        setStatus('error')
        return
      }

      const ollamaStatus = statusResult.data
      console.log('Ollama status:', ollamaStatus)

      // 2. Not running - show start instructions
      if (!ollamaStatus.running) {
        setStatus('not-running')
        return
      }

      // 3. Check required models
      console.log('Checking required models...')
      const modelsResult = await window.electron.invoke(
        'ollama-check-models',
        'llama3.2:3b',
        'llava:7b-v1.6-mistral-q4_0'
      )

      if (!modelsResult.success || !modelsResult.data) {
        setError(modelsResult.error || 'Failed to check models')
        setStatus('error')
        return
      }

      const { textModel, visionModel } = modelsResult.data
      console.log('Model availability:', { textModel, visionModel })

      // 4. Both models available - ready!
      if (textModel.available && visionModel.available) {
        console.log('All models available!')
        setStatus('ready')
        setTimeout(() => onReady(), 1000)
        return
      }

      // 5. Download missing models
      const modelsToDownload: string[] = []
      if (!textModel.available) modelsToDownload.push(textModel.name)
      if (!visionModel.available) modelsToDownload.push(visionModel.name)

      console.log('Downloading models:', modelsToDownload)
      setStatus('downloading')
      await downloadModels(modelsToDownload)

    } catch (err: any) {
      console.error('Setup check failed:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  const downloadModels = async (models: string[]) => {
    // Initialize progress for each model
    models.forEach(model => {
      setProgress(prev => new Map(prev).set(model, {
        model,
        status: 'downloading',
        progress: 0,
        total: 0,
        completed: 0
      }))
    })

    // Listen for progress updates
    const handleProgress = (_event: any, data: ModelProgress) => {
      console.log('Model progress:', data)
      setProgress(prev => new Map(prev).set(data.model, data))

      // Check if all complete
      if (data.status === 'completed') {
        setProgress(prev => {
          const updated = new Map(prev)
          const allComplete = Array.from(updated.values()).every(
            p => p.status === 'completed'
          )
          if (allComplete) {
            setTimeout(() => {
              setStatus('ready')
              setTimeout(() => onReady(), 1000)
            }, 500)
          }
          return updated
        })
      }

      if (data.status === 'failed') {
        setError(`Failed to download ${data.model}: ${data.error}`)
        setStatus('error')
      }
    }

    window.electron.on('ollama-model-progress', handleProgress)

    try {
      // Start batch download
      const result = await window.electron.invoke('ollama-pull-models', models)

      if (!result.success) {
        throw new Error(result.error || 'Download failed')
      }

      if (result.data && result.data.failed.length > 0) {
        setError(`Failed to download: ${result.data.failed.join(', ')}`)
        setStatus('error')
      }

    } catch (err: any) {
      console.error('Download failed:', err)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
        {status === 'checking' && <CheckingView />}
        {status === 'not-running' && (
          <NotRunningView onRetry={retrySetup} />
        )}
        {status === 'downloading' && (
          <DownloadingView progress={Array.from(progress.values())} />
        )}
        {status === 'ready' && <ReadyView />}
        {status === 'error' && (
          <ErrorView error={error} onRetry={retrySetup} />
        )}
      </div>
    </div>
  )
}

function CheckingView() {
  return (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Checking Ollama Setup</h2>
      <p className="text-gray-600">This will only take a moment...</p>
    </div>
  )
}

function NotRunningView({
  onRetry
}: {
  onRetry: () => void
}) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="py-8">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">⚡</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Start Ollama</h2>
        <p className="text-gray-600">Ollama needs to be running to use local AI models</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Quick Start:</h3>
        <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm mb-3">
          ollama serve
        </div>
        <button
          onClick={() => copyToClipboard('ollama serve')}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Copy Command
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          Check Again
        </button>
      </div>
    </div>
  )
}

function DownloadingView({ progress }: { progress: ModelProgress[] }) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  return (
    <div className="py-8">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">📥</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Downloading Models</h2>
        <p className="text-gray-600">
          This may take a few minutes depending on your internet speed
        </p>
      </div>

      <div className="space-y-6">
        {progress.map(p => (
          <div key={p.model} className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-gray-800">{p.model}</span>
              <span className="text-sm text-gray-600">
                {p.status === 'downloading' && '⬇️ Downloading'}
                {p.status === 'verifying' && '✓ Verifying'}
                {p.status === 'completed' && '✅ Complete'}
                {p.status === 'failed' && '❌ Failed'}
              </span>
            </div>

            <div className="bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  p.status === 'completed' ? 'bg-green-500' :
                  p.status === 'failed' ? 'bg-red-500' :
                  'bg-blue-600'
                }`}
                style={{ width: `${p.progress}%` }}
              />
            </div>

            <div className="flex justify-between text-sm text-gray-500">
              <span>{p.progress}%</span>
              {p.total > 0 && (
                <span>
                  {formatBytes(p.completed)} / {formatBytes(p.total)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center text-sm text-gray-500">
        💡 Tip: You can use the app while models download
      </div>
    </div>
  )
}

function ReadyView() {
  return (
    <div className="text-center py-12">
      <div className="text-8xl mb-6">✅</div>
      <h2 className="text-3xl font-bold text-gray-800 mb-2">All Set!</h2>
      <p className="text-gray-600 mb-4">Local AI models are ready to use</p>
      <div className="animate-pulse text-blue-600 font-medium">Starting app...</div>
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
    <div className="py-8">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Setup Error</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 font-mono text-sm">{error}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          Try Again
        </button>
        <a
          href="https://github.com/ollama/ollama/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg text-center transition"
        >
          Get Help
        </a>
      </div>
    </div>
  )
}
