/**
 * Ollama Model Manager
 *
 * Handles model lifecycle:
 * - Check if Ollama is installed and running
 * - List available models
 * - Download/pull models with progress tracking
 * - Verify model readiness
 */

export interface ModelInfo {
  name: string
  size: number
  digest: string
  modified_at: string
}

export interface ModelDownloadProgress {
  model: string
  status: 'downloading' | 'verifying' | 'completed' | 'failed'
  progress: number // 0-100
  total: number // bytes
  completed: number // bytes
  error?: string
}

export interface OllamaStatus {
  installed: boolean
  running: boolean
  version?: string
  error?: string
}

export interface ModelAvailability {
  textModel: {
    name: string
    available: boolean
    size?: number
  }
  visionModel: {
    name: string
    available: boolean
    size?: number
  }
}

export class OllamaModelManager {
  private baseUrl: string
  private downloadCallbacks = new Map<string, (progress: ModelDownloadProgress) => void>()

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl
  }

  /**
   * Check if Ollama is installed and running
   */
  async checkOllamaStatus(): Promise<OllamaStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      })

      if (!response.ok) {
        return {
          installed: false,
          running: false,
          error: 'Ollama is not responding'
        }
      }

      const data = await response.json()
      return {
        installed: true,
        running: true,
        version: data.version
      }
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.name === 'TimeoutError') {
        return {
          installed: false, // We can't tell if installed if not running
          running: false,
          error: 'Ollama is not running. Please start it with: ollama serve'
        }
      }

      return {
        installed: false,
        running: false,
        error: error.message
      }
    }
  }

  /**
   * List all downloaded models
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`)
      }

      const data = await response.json()
      return data.models || []
    } catch (error: any) {
      console.error('Failed to list models:', error)
      throw new Error(`Cannot list models: ${error.message}`)
    }
  }

  /**
   * Check if specific models are available
   */
  async checkModelsAvailability(
    textModel: string,
    visionModel: string
  ): Promise<ModelAvailability> {
    try {
      const models = await this.listModels()
      const modelNames = models.map(m => m.name)

      const textModelInfo = models.find(m => m.name.includes(textModel) || m.name === textModel)
      const visionModelInfo = models.find(m => m.name.includes(visionModel) || m.name === visionModel)

      return {
        textModel: {
          name: textModel,
          available: !!textModelInfo,
          size: textModelInfo?.size
        },
        visionModel: {
          name: visionModel,
          available: !!visionModelInfo,
          size: visionModelInfo?.size
        }
      }
    } catch (error: any) {
      console.error('Failed to check model availability:', error)
      return {
        textModel: { name: textModel, available: false },
        visionModel: { name: visionModel, available: false }
      }
    }
  }

  /**
   * Download/pull a model with progress tracking
   */
  async pullModel(
    modelName: string,
    onProgress?: (progress: ModelDownloadProgress) => void
  ): Promise<void> {
    try {
      console.log(`📥 Starting download of ${modelName}...`)

      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: modelName,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let totalBytes = 0
      let completedBytes = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log(`✅ Model ${modelName} downloaded successfully`)
          if (onProgress) {
            onProgress({
              model: modelName,
              status: 'completed',
              progress: 100,
              total: totalBytes,
              completed: completedBytes
            })
          }
          break
        }

        // Decode chunk and parse JSON lines
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const data = JSON.parse(line)

            // Update progress
            if (data.total && data.completed !== undefined) {
              totalBytes = data.total
              completedBytes = data.completed
              const progress = Math.round((completedBytes / totalBytes) * 100)

              if (onProgress) {
                onProgress({
                  model: modelName,
                  status: data.status === 'pulling manifest' ? 'downloading' : 'verifying',
                  progress,
                  total: totalBytes,
                  completed: completedBytes
                })
              }
            }

            // Check for errors
            if (data.error) {
              throw new Error(data.error)
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            console.warn('Failed to parse progress line:', line)
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ Failed to pull model ${modelName}:`, error)
      if (onProgress) {
        onProgress({
          model: modelName,
          status: 'failed',
          progress: 0,
          total: 0,
          completed: 0,
          error: error.message
        })
      }
      throw error
    }
  }

  /**
   * Pull multiple models sequentially
   */
  async pullModels(
    models: string[],
    onProgress?: (model: string, progress: ModelDownloadProgress) => void
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = []
    const failed: string[] = []

    for (const model of models) {
      try {
        await this.pullModel(model, (progress) => {
          if (onProgress) {
            onProgress(model, progress)
          }
        })
        success.push(model)
      } catch (error) {
        console.error(`Failed to pull ${model}:`, error)
        failed.push(model)
      }
    }

    return { success, failed }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelName })
      })

      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.statusText}`)
      }

      console.log(`🗑️  Model ${modelName} deleted successfully`)
    } catch (error: any) {
      console.error(`Failed to delete model ${modelName}:`, error)
      throw error
    }
  }

  /**
   * Get installation instructions for Ollama
   */
  getInstallInstructions(): string[] {
    return [
      '# Start Ollama',
      'ollama serve'
    ]
  }

  /**
   * Get recommended models for the app
   */
  getRecommendedModels(): {
    text: { name: string; size: string; description: string }[]
    vision: { name: string; size: string; description: string }[]
  } {
    return {
      text: [
        { name: 'llama3.2:3b', size: '2.0GB', description: 'Fast, good quality (Recommended)' },
        { name: 'qwen2.5:7b', size: '4.7GB', description: 'Excellent quality, multilingual' },
        { name: 'gemma2:9b', size: '5.4GB', description: 'Google model, high quality' }
      ],
      vision: [
        { name: 'llama3.2-vision:11b', size: '7.9GB', description: 'OCR + understanding (Recommended)' },
        { name: 'llava:latest', size: '4.7GB', description: 'Fast, good OCR' },
        { name: 'llama3.2-vision:90b', size: '55GB', description: 'Best quality (requires GPU)' }
      ]
    }
  }
}

export const ollamaModelManager = new OllamaModelManager()
