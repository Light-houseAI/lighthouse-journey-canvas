import { LLMRequest, LLMResponse, LLMSuggestion } from '../../shared/types'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { OllamaAdapter } from './ollama-adapter'
import Anthropic from '@anthropic-ai/sdk'

// Claude LLM Adapter
class ClaudeLLMAdapter {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async getSuggestion(request: LLMRequest): Promise<LLMResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(request.intent)
      const userPrompt = this.buildUserPrompt(request)

      const message = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      })

      const content = message.content[0]
      if (content.type !== 'text') {
        return {
          suggestion: null,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Invalid response format from Claude',
            retryable: false
          }
        }
      }

      // Parse JSON response
      const response = JSON.parse(content.text) as LLMSuggestion

      // Validate confidence
      if (response.confidence < 80) {
        return { suggestion: null, error: null }
      }

      return { suggestion: response, error: null }
    } catch (error: any) {
      console.error('Claude API error:', error)
      return {
        suggestion: null,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Failed to connect to Claude API',
          retryable: true
        }
      }
    }
  }

  private buildSystemPrompt(intent: string): string {
    const basePrompt = `You are an expert writing assistant helping users create professional documents.

Analyze the user's current text and provide ONE actionable suggestion to improve it.

Respond with JSON:
{
  "message": "brief, actionable suggestion",
  "confidence": 0-100,
  "reasoning": "why this suggestion matters",
  "examples": ["optional", "example text"]
}

ONLY suggest if confidence >= 80. Return null if confidence < 80.`

    const intentGuidance: Record<string, string> = {
      resume_job_description: '\n\nFor resume job descriptions: Use strong action verbs (Led, Architected, Implemented). Include quantifiable metrics (X%, $Y, Z users). Focus on impact and outcomes, not just duties.',
      resume_achievements: '\n\nFor resume achievements: Quantify business impact. Show before/after improvements. Use CAR format (Challenge-Action-Result). Highlight revenue, cost savings, efficiency gains.',
      resume_summary: '\n\nFor resume summaries: Lead with years of experience and key strength. Mention 1-2 impressive achievements. Keep it concise (2-3 sentences). Tailor to target role.',
      requirements_functional: '\n\nFor functional requirements: Be specific and testable. Use "shall/must" language. Include acceptance criteria. Focus on what the system does, not how.',
      requirements_technical: '\n\nFor technical requirements: Specify performance metrics, constraints, dependencies. Include scalability, security, compatibility needs. Use measurable criteria.',
      requirements_user_stories: '\n\nFor user stories: Use "As a [role], I want [feature] so that [benefit]" format. Include acceptance criteria. Keep stories small and testable. Focus on user value.'
    }

    return basePrompt + (intentGuidance[intent] || '')
  }

  private buildUserPrompt(request: LLMRequest): string {
    const networkContext = request.profileContext.networkInsights
      ? `\n\nNetwork Insights:
- Connections: ${request.profileContext.networkInsights.connections.length} people in your network
- Common Companies: ${request.profileContext.networkInsights.commonCompanies.join(', ')}
- Top Skills in Network: ${request.profileContext.networkInsights.skillOverlap.join(', ')}
- Career Paths from Network:
${request.profileContext.networkInsights.careerPaths.map(p => `  • ${p.description}`).join('\n')}`
      : ''

    return `Profile Context:
- User: ${request.profileContext.userName}
- Current Role: ${request.profileContext.currentRole || 'N/A'}
- Recent Projects: ${request.profileContext.recentProjects.join(', ') || 'N/A'}
- Skills: ${request.profileContext.skills.join(', ') || 'N/A'}
- Education: ${request.profileContext.education.join(', ') || 'N/A'}${networkContext}

Current Text (Intent: ${request.intent}):
${request.currentText}

Provide a suggestion to improve this text. Use network insights to provide context-aware recommendations.`
  }
}

// OpenAI LLM Adapter (using GPT-4o-mini via Vercel AI SDK)
class OpenAILLMAdapter {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async getSuggestion(request: LLMRequest): Promise<LLMResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(request.intent)
      const userPrompt = this.buildUserPrompt(request)

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        temperature: 0.7,
        maxTokens: 1000,
        system: systemPrompt,
        prompt: userPrompt,
      })

      // Parse JSON response
      const response = JSON.parse(text) as LLMSuggestion

      // Validate confidence
      if (response.confidence < 80) {
        return { suggestion: null, error: null }
      }

      return { suggestion: response, error: null }
    } catch (error: any) {
      console.error('OpenAI API error:', error)
      return {
        suggestion: null,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Failed to connect to OpenAI API',
          retryable: true
        }
      }
    }
  }

  private buildSystemPrompt(intent: string): string {
    const basePrompt = `You are an expert writing assistant helping users create professional documents.

Analyze the user's current text and network insights to provide ONE actionable suggestion to improve it.

IMPORTANT: Do NOT mention specific people's names in your suggestions. Reference roles, companies, or patterns generically (e.g., "senior engineers at top tech companies" rather than naming individuals).

Respond with JSON:
{
  "message": "brief, actionable suggestion",
  "confidence": 0-100,
  "reasoning": "why this suggestion matters (reference network patterns generically)",
  "examples": ["optional", "example text"]
}

ONLY suggest if confidence >= 80. Return {"suggestion": null} if confidence < 80.`

    const intentGuidance: Record<string, string> = {
      resume_writing: '\n\nFor resume writing: Use strong action verbs (Led, Architected, Implemented, Reduced, Increased). Include quantifiable metrics showing impact (X%, $Y, Z users). Focus on outcomes and business value, not just tasks. Highlight achievements that align with career paths common in the network.',
      requirements_documentation: '\n\nFor requirements documentation: Be specific and testable. Use "shall/must" language for functional requirements. Include measurable acceptance criteria. For technical requirements, specify performance metrics (latency, throughput, uptime), constraints, and dependencies. For user stories, use "As a [role], I want [capability] so that [benefit]" format with clear acceptance criteria.'
    }

    return basePrompt + (intentGuidance[intent] || '')
  }

  private buildUserPrompt(request: LLMRequest): string {
    const userInsightsContext = request.profileContext.userInsights && request.profileContext.userInsights.length > 0
      ? `\n\nUser's Key Achievements & Insights:
${request.profileContext.userInsights.map(insight => `  • ${insight}`).join('\n')}`
      : ''

    const networkContext = request.profileContext.networkInsights
      ? `\n\nNetwork Intelligence (use this to provide personalized recommendations):
- Professional Network: ${request.profileContext.networkInsights.connections.length} connections
- Companies in Network: ${request.profileContext.networkInsights.commonCompanies.join(', ')}
- Common Skills & Technologies: ${request.profileContext.networkInsights.skillOverlap.join(', ')}
- Successful Career Patterns:
${request.profileContext.networkInsights.careerPaths.map(p => `  • ${p.description} (${p.timeframe})`).join('\n')}
- Key Network Connections:
${request.profileContext.networkInsights.connections.slice(0, 3).map(c => `  • ${c.name} - ${c.currentRole} at ${c.currentCompany} (${c.relationshipStrength} connection)`).join('\n')}`
      : ''

    const previousInsightsContext = request.previousInsights && request.previousInsights.length > 0
      ? `\n\nPrevious Insights Already Shown (DO NOT repeat or suggest similar ideas):
${request.previousInsights.map(insight => `  • ${insight}`).join('\n')}`
      : ''

    return `User Profile:
- Name: ${request.profileContext.userName}
- Current Position: ${request.profileContext.currentRole || 'N/A'}
- Recent Projects: ${request.profileContext.recentProjects.join(', ') || 'N/A'}
- Technical Skills: ${request.profileContext.skills.join(', ') || 'N/A'}
- Education: ${request.profileContext.education.join(', ') || 'N/A'}${userInsightsContext}${networkContext}${previousInsightsContext}

Current Text Being Written (${request.intent}):
${request.currentText}

Based on the user's profile, achievements, and professional network, provide ONE specific, actionable suggestion to improve this text. Reference patterns from their network generically (e.g., "professionals at similar companies", "senior leaders in the field") without naming specific individuals. IMPORTANT: Your suggestion must be DIFFERENT from all previous insights listed above.`
  }
}

// LLM Service with Multiple Adapter Support
export class LLMService {
  private adapter: OpenAILLMAdapter | ClaudeLLMAdapter | OllamaAdapter
  private adapterType: 'openai' | 'claude' | 'ollama'

  constructor() {
    const adapterType = (process.env.LLM_ADAPTER || 'ollama').toLowerCase()

    if (adapterType === 'ollama') {
      this.adapterType = 'ollama'
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
      const ollamaTextModel = process.env.OLLAMA_TEXT_MODEL || 'llama3.2:3b'
      const ollamaVisionModel = process.env.OLLAMA_VISION_MODEL || 'llama3.2-vision:11b'

      this.adapter = new OllamaAdapter({
        baseUrl: ollamaBaseUrl,
        textModel: ollamaTextModel,
        visionModel: ollamaVisionModel
      })
      console.log(`✅ Using Ollama adapter (Text: ${ollamaTextModel}, Vision: ${ollamaVisionModel})`)
      console.log(`   Base URL: ${ollamaBaseUrl}`)
    } else if (adapterType === 'claude') {
      this.adapterType = 'claude'
      const claudeKey = process.env.ANTHROPIC_API_KEY || ''
      if (!claudeKey || claudeKey === 'your-anthropic-api-key-here') {
        throw new Error('⚠️  Anthropic API key is required for Claude adapter. Add to .env file.')
      }
      this.adapter = new ClaudeLLMAdapter(claudeKey)
      console.log('✅ Using Claude adapter (Haiku)')
    } else if (adapterType === 'openai') {
      this.adapterType = 'openai'
      const openaiKey = process.env.OPENAI_API_KEY || ''
      if (!openaiKey || !openaiKey.startsWith('sk-') || openaiKey === 'your-openai-api-key-here') {
        throw new Error('⚠️  OpenAI API key is required for OpenAI adapter. Add to .env file (must start with sk-).')
      }
      this.adapter = new OpenAILLMAdapter(openaiKey)
      console.log('✅ Using OpenAI adapter (GPT-4o-mini)')
    } else {
      throw new Error(`❌ Unknown LLM adapter: ${adapterType}. Valid options: ollama, openai, claude`)
    }
  }

  async getSuggestion(request: LLMRequest): Promise<LLMResponse> {
    return this.adapter.getSuggestion(request)
  }

  getAdapterType(): 'openai' | 'claude' | 'ollama' {
    return this.adapterType
  }

  getAdapter(): OpenAILLMAdapter | ClaudeLLMAdapter | OllamaAdapter {
    return this.adapter
  }

  /**
   * Health check for Ollama adapter (returns true for other adapters)
   */
  async healthCheck(): Promise<{
    running: boolean
    textModelAvailable?: boolean
    visionModelAvailable?: boolean
    error?: string
  }> {
    if (this.adapterType === 'ollama' && this.adapter instanceof OllamaAdapter) {
      return await this.adapter.healthCheck()
    }
    // For OpenAI/Claude, always return healthy (we'll catch errors during actual requests)
    return { running: true }
  }
}

export const llmService = new LLMService()
