import { LLMRequest, LLMResponse, LLMSuggestion, NetworkInsights } from '../../shared/types'

export interface OllamaConfig {
  baseUrl: string
  textModel: string
  visionModel: string
  timeout: number
}

export interface OllamaGenerateRequest {
  model: string
  prompt: string
  system?: string
  images?: string[]
  stream: boolean
  options?: {
    temperature?: number
    top_p?: number
    top_k?: number
  }
}

export interface OllamaGenerateResponse {
  model: string
  created_at: string
  response: string
  done: boolean
  context?: number[]
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  eval_count?: number
  eval_duration?: number
}

export interface ScreenshotProcessingResult {
  extractedText: string
  structuredData?: {
    jobTitle?: string
    company?: string
    dates?: string
    achievements?: string[]
    skills?: string[]
  }
  confidence: number
}

export interface InsightGenerationRequest {
  extractedText: string
  intent: string
  profileContext: {
    userName: string
    currentRole: string | null
    networkInsights?: NetworkInsights
  }
}

/**
 * Ollama LLM Adapter with Vision Support
 *
 * Supports two modes:
 * 1. Text-based suggestions (like OpenAI/Claude adapters)
 * 2. Vision-based screenshot processing with OCR and insight generation
 */
export class OllamaAdapter {
  private config: OllamaConfig

  constructor(config?: Partial<OllamaConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || 'http://localhost:11434',
      textModel: config?.textModel || 'llama3.2:3b',
      visionModel: config?.visionModel || 'llama3.2-vision:11b',
      timeout: config?.timeout || 30000
    }
  }

  /**
   * Get text-based writing suggestions (compatible with existing flow)
   */
  async getSuggestion(request: LLMRequest): Promise<LLMResponse> {
    try {
      console.log(`🤖 [Ollama] Generating suggestion using LOCAL model: ${this.config.textModel}`)
      const systemPrompt = this.buildSystemPrompt(request.intent)
      const userPrompt = this.buildUserPrompt(request)

      const response = await this.generateText({
        model: this.config.textModel,
        prompt: userPrompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9
        }
      })

      console.log(`✅ [Ollama] Received response from LOCAL model (${response.response.length} chars)`)

      // Parse JSON response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return {
          suggestion: null,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Could not parse JSON from Ollama response',
            retryable: false
          }
        }
      }

      const suggestion = JSON.parse(jsonMatch[0]) as LLMSuggestion

      // Validate confidence
      if (suggestion.confidence < 80) {
        return { suggestion: null, error: null }
      }

      return { suggestion, error: null }
    } catch (error: any) {
      console.error('Ollama API error:', error)
      return {
        suggestion: null,
        error: {
          code: error.code === 'ECONNREFUSED' ? 'CONNECTION_REFUSED' : 'NETWORK_ERROR',
          message: error.code === 'ECONNREFUSED'
            ? 'Cannot connect to Ollama. Make sure Ollama is running (ollama serve)'
            : error.message || 'Failed to connect to Ollama API',
          retryable: true
        }
      }
    }
  }

  /**
   * Process screenshot with vision model to extract text and structure
   */
  async processScreenshot(imageBase64: string): Promise<ScreenshotProcessingResult> {
    try {
      const prompt = `Extract all text from this screenshot. Preserve formatting and structure.

If this appears to be a professional document (resume, job description, requirements doc):
- Identify job titles, company names, dates
- Extract bullet points and achievements
- List technical skills mentioned

Respond with:
1. Full extracted text (preserve formatting)
2. Structured data in JSON format if applicable

Example response format:
{
  "text": "full extracted text here...",
  "structured": {
    "jobTitle": "Senior Software Engineer",
    "company": "TechCorp",
    "dates": "2020-Present",
    "achievements": ["Led team of 5", "Reduced costs by 40%"],
    "skills": ["React", "Node.js", "AWS"]
  }
}`

      const response = await this.generateText({
        model: this.config.visionModel,
        prompt,
        images: [imageBase64],
        stream: false,
        options: {
          temperature: 0.3 // Lower temperature for more accurate OCR
        }
      })

      // Try to parse structured response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          return {
            extractedText: parsed.text || response.response,
            structuredData: parsed.structured,
            confidence: 85
          }
        } catch {
          // Fallback to raw text
          return {
            extractedText: response.response,
            confidence: 75
          }
        }
      }

      return {
        extractedText: response.response,
        confidence: 70
      }
    } catch (error: any) {
      console.error('Ollama vision error:', error)
      throw new Error(
        error.code === 'ECONNREFUSED'
          ? 'Cannot connect to Ollama. Make sure Ollama is running and vision model is pulled (ollama pull llama3.2-vision:11b)'
          : `Screenshot processing failed: ${error.message}`
      )
    }
  }

  /**
   * Generate insights from extracted text with network context
   */
  async generateInsights(request: InsightGenerationRequest): Promise<LLMSuggestion[]> {
    try {
      const networkContext = request.profileContext.networkInsights
        ? `\n\nNetwork Intelligence:
- Professional Network: ${request.profileContext.networkInsights.connections.length} connections
- Companies: ${request.profileContext.networkInsights.commonCompanies.slice(0, 5).join(', ')}
- Top Skills: ${request.profileContext.networkInsights.skillOverlap.slice(0, 8).join(', ')}
- Career Patterns:
${request.profileContext.networkInsights.careerPaths.slice(0, 3).map(p => `  • ${p.description}`).join('\n')}`
        : ''

      const prompt = `You are a career writing assistant. Analyze this text and provide 3 specific, actionable suggestions.

User Context:
- Name: ${request.profileContext.userName}
- Current Role: ${request.profileContext.currentRole || 'N/A'}${networkContext}

Text to Analyze (${request.intent}):
${request.extractedText}

Provide exactly 3 suggestions in JSON array format:
[
  {
    "message": "specific actionable suggestion",
    "confidence": 85-100,
    "reasoning": "why this matters based on context",
    "examples": ["example improvement"]
  }
]

Focus on:
- Strong action verbs and quantifiable metrics
- Network-aware recommendations (reference patterns generically)
- Specific improvements tailored to the intent`

      const response = await this.generateText({
        model: this.config.textModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.7
        }
      })

      // Parse JSON array response
      const jsonMatch = response.response.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('Could not parse suggestions from response')
      }

      const suggestions = JSON.parse(jsonMatch[0]) as LLMSuggestion[]

      // Filter by confidence
      return suggestions.filter(s => s.confidence >= 85)
    } catch (error: any) {
      console.error('Ollama insight generation error:', error)
      throw new Error(`Insight generation failed: ${error.message}`)
    }
  }

  /**
   * Check if Ollama is running and models are available
   */
  async healthCheck(): Promise<{
    running: boolean
    textModelAvailable: boolean
    visionModelAvailable: boolean
    error?: string
  }> {
    try {
      // Check if Ollama is running
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        return {
          running: false,
          textModelAvailable: false,
          visionModelAvailable: false,
          error: 'Ollama is not responding'
        }
      }

      const data = await response.json()
      const models = data.models || []
      const modelNames = models.map((m: any) => m.name)

      const textModelAvailable = modelNames.some((name: string) =>
        name.includes(this.config.textModel) || name.startsWith('llama3.2:')
      )
      const visionModelAvailable = modelNames.some((name: string) =>
        name.includes(this.config.visionModel) || name.includes('llama3.2-vision')
      )

      return {
        running: true,
        textModelAvailable,
        visionModelAvailable,
        error: undefined
      }
    } catch (error: any) {
      return {
        running: false,
        textModelAvailable: false,
        visionModelAvailable: false,
        error: error.code === 'ECONNREFUSED'
          ? 'Ollama is not running. Start it with: ollama serve'
          : error.message
      }
    }
  }

  // Private helper methods

  private async generateText(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details')
        console.error('Ollama API error details:', errorText)
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private buildSystemPrompt(intent: string): string {
    const basePrompt = `You are an expert writing assistant helping users create professional documents.

Analyze the user's current text and network insights to provide ONE actionable suggestion to improve it.

IMPORTANT: Reference network patterns generically (e.g., "professionals at similar companies") without naming individuals.

Respond with JSON:
{
  "message": "brief, actionable suggestion",
  "confidence": 0-100,
  "reasoning": "why this suggestion matters",
  "examples": ["optional", "example text"]
}

ONLY suggest if confidence >= 80.`

    const intentGuidance: Record<string, string> = {
      resume_writing: '\n\nFor resume writing: Use strong action verbs (Led, Architected, Implemented). Include quantifiable metrics (X%, $Y, Z users). Focus on impact and outcomes.',
      requirements_documentation: '\n\nFor requirements: Be specific and testable. Use "shall/must" language. Include measurable acceptance criteria. Specify performance metrics (latency, throughput, uptime).'
    }

    return basePrompt + (intentGuidance[intent] || '')
  }

  private buildUserPrompt(request: LLMRequest): string {
    const networkContext = request.profileContext.networkInsights
      ? `\n\nNetwork Intelligence:
- Network Size: ${request.profileContext.networkInsights.connections.length} connections
- Companies: ${request.profileContext.networkInsights.commonCompanies.join(', ')}
- Top Skills: ${request.profileContext.networkInsights.skillOverlap.join(', ')}
- Career Patterns: ${request.profileContext.networkInsights.careerPaths.map(p => p.description).join('; ')}`
      : ''

    return `User Profile:
- Name: ${request.profileContext.userName}
- Current Role: ${request.profileContext.currentRole || 'N/A'}
- Skills: ${request.profileContext.skills.join(', ') || 'N/A'}${networkContext}

Current Text (${request.intent}):
${request.currentText}

Provide ONE specific suggestion to improve this text.`
  }
}
