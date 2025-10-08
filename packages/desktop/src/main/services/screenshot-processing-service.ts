import { ScreenshotProcessingRequest, ScreenshotProcessingResponse } from '../../shared/types'
import { llmService } from './llm-service'
import { OllamaAdapter } from './ollama-adapter'

/**
 * Screenshot Processing Service
 *
 * Orchestrates vision-based screenshot processing:
 * 1. Extract text using vision model (OCR)
 * 2. Generate career insights using text model with network context
 * 3. Return structured results
 */
export class ScreenshotProcessingService {
  async processScreenshot(request: ScreenshotProcessingRequest): Promise<ScreenshotProcessingResponse> {
    const adapterType = llmService.getAdapterType()

    // Only Ollama adapter currently supports vision
    if (adapterType !== 'ollama') {
      throw new Error(
        `Screenshot processing requires Ollama adapter with vision support. ` +
        `Current adapter: ${adapterType}. Set LLM_ADAPTER=ollama in .env file.`
      )
    }

    const adapter = llmService.getAdapter()
    if (!(adapter instanceof OllamaAdapter)) {
      throw new Error('Screenshot processing requires OllamaAdapter instance')
    }

    try {
      // Step 1: Process screenshot with vision model to extract text
      console.log('📸 Processing screenshot with vision model...')
      const ocrResult = await adapter.processScreenshot(request.imageBase64)

      console.log(`✅ Text extracted (${ocrResult.extractedText.length} chars, confidence: ${ocrResult.confidence}%)`)
      if (ocrResult.structuredData) {
        console.log('📊 Structured data extracted:', Object.keys(ocrResult.structuredData))
      }

      // Step 2: Generate insights from extracted text with network context
      console.log('💡 Generating insights with network context...')
      const suggestions = await adapter.generateInsights({
        extractedText: ocrResult.extractedText,
        intent: request.intent,
        profileContext: request.profileContext
      })

      console.log(`✅ Generated ${suggestions.length} insights`)

      return {
        extractedText: ocrResult.extractedText,
        structuredData: ocrResult.structuredData,
        suggestions: suggestions,
        confidence: ocrResult.confidence
      }
    } catch (error: any) {
      console.error('❌ Screenshot processing failed:', error)

      // Provide helpful error messages
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Cannot connect to Ollama. Please ensure:\n' +
          '1. Ollama is installed (https://ollama.com)\n' +
          '2. Ollama is running: ollama serve\n' +
          '3. Vision model is pulled: ollama pull llama3.2-vision:11b'
        )
      }

      if (error.message.includes('model') && error.message.includes('not found')) {
        throw new Error(
          'Vision model not available. Please run:\n' +
          'ollama pull llama3.2-vision:11b'
        )
      }

      throw error
    }
  }

  /**
   * Check if screenshot processing is available (Ollama with vision model)
   */
  async checkAvailability(): Promise<{
    available: boolean
    adapterType: string
    visionModelAvailable: boolean
    error?: string
  }> {
    const adapterType = llmService.getAdapterType()

    if (adapterType !== 'ollama') {
      return {
        available: false,
        adapterType,
        visionModelAvailable: false,
        error: `Screenshot processing requires Ollama adapter (current: ${adapterType})`
      }
    }

    try {
      const health = await llmService.healthCheck()

      return {
        available: health.running && (health.visionModelAvailable || false),
        adapterType,
        visionModelAvailable: health.visionModelAvailable || false,
        error: health.error
      }
    } catch (error: any) {
      return {
        available: false,
        adapterType,
        visionModelAvailable: false,
        error: error.message
      }
    }
  }

  /**
   * Get recommended setup instructions for screenshot processing
   */
  getSetupInstructions(): string[] {
    return [
      '# Pull required models',
      'ollama pull llama3.2-vision:11b  # Vision model for OCR',
      'ollama pull llama3.2:3b          # Text model for insights',
      '',
      '# Start Ollama service',
      'ollama serve',
      '',
      '# Configure app (.env file)',
      'LLM_ADAPTER=ollama',
      'OLLAMA_BASE_URL=http://localhost:11434',
      'OLLAMA_TEXT_MODEL=llama3.2:3b',
      'OLLAMA_VISION_MODEL=llama3.2-vision:11b'
    ]
  }
}

export const screenshotProcessingService = new ScreenshotProcessingService()
