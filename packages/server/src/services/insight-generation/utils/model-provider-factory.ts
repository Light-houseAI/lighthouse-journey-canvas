/**
 * Model Provider Factory for Insight Generation Agents
 *
 * Creates LLM providers with agent-specific model configurations:
 * - A1, A3, A4-Web, A4-Company: Gemini 2.5 Flash (fast, cost-effective)
 * - A2 Judge: GPT-4 (high quality for LLM-as-judge evaluation)
 */

import { AISDKLLMProvider, type LLMProvider, type LLMConfig } from '../../../core/llm-provider.js';
import {
  type AgentId,
  type AgentModelConfig,
  type InsightModelConfiguration,
  DEFAULT_MODEL_CONFIG,
} from '../types.js';

/**
 * Map of agent IDs to their model configuration keys
 */
const AGENT_CONFIG_MAP: Record<AgentId, keyof InsightModelConfiguration> = {
  A1_RETRIEVAL: 'a1Retrieval',
  A2_JUDGE: 'a2Judge',
  A3_COMPARATOR: 'a3Comparator',
  A4_WEB: 'a4Web',
  A4_COMPANY: 'a4Company',
  A5_FEATURE_ADOPTION: 'a5FeatureAdoption',
};

/**
 * Cache for created LLM providers to avoid creating duplicates
 */
const providerCache = new Map<string, LLMProvider>();

/**
 * Get the cache key for a model configuration
 */
function getCacheKey(config: AgentModelConfig): string {
  return `${config.provider}:${config.model}:${config.temperature}:${config.maxTokens}`;
}

/**
 * Get the API key for a provider
 */
function getApiKey(provider: 'openai' | 'google'): string {
  const keyMap = {
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_API_KEY,
  };

  const apiKey = keyMap[provider];
  if (!apiKey) {
    throw new Error(
      `API key not found for ${provider}. Please set ${provider.toUpperCase()}_API_KEY environment variable.`
    );
  }

  return apiKey;
}

/**
 * Create an LLM provider for a specific agent model configuration
 */
function createProviderFromConfig(config: AgentModelConfig): LLMProvider {
  const cacheKey = getCacheKey(config);

  // Return cached provider if available
  const cached = providerCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Create new provider
  const llmConfig: LLMConfig = {
    provider: config.provider,
    apiKey: getApiKey(config.provider),
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  };

  const provider = new AISDKLLMProvider(llmConfig);
  providerCache.set(cacheKey, provider);

  return provider;
}

/**
 * Get the model configuration for a specific agent
 */
export function getAgentModelConfig(
  agentId: AgentId,
  customConfig?: Partial<InsightModelConfiguration>
): AgentModelConfig {
  const configKey = AGENT_CONFIG_MAP[agentId];
  const customAgentConfig = customConfig?.[configKey];
  const defaultAgentConfig = DEFAULT_MODEL_CONFIG[configKey];

  // Merge custom config with defaults
  return {
    ...defaultAgentConfig,
    ...customAgentConfig,
  };
}

/**
 * Create an LLM provider for a specific agent
 *
 * @param agentId - The agent identifier
 * @param customConfig - Optional custom model configuration
 * @returns LLM provider configured for the agent
 */
export function createAgentLLMProvider(
  agentId: AgentId,
  customConfig?: Partial<InsightModelConfiguration>
): LLMProvider {
  const modelConfig = getAgentModelConfig(agentId, customConfig);
  return createProviderFromConfig(modelConfig);
}

/**
 * Create all LLM providers for the insight generation system
 *
 * @param customConfig - Optional custom model configuration
 * @returns Map of agent IDs to their LLM providers
 */
export function createAllAgentProviders(
  customConfig?: Partial<InsightModelConfiguration>
): Map<AgentId, LLMProvider> {
  const providers = new Map<AgentId, LLMProvider>();

  const agentIds: AgentId[] = [
    'A1_RETRIEVAL',
    'A2_JUDGE',
    'A3_COMPARATOR',
    'A4_WEB',
    'A4_COMPANY',
    'A5_FEATURE_ADOPTION',
  ];

  for (const agentId of agentIds) {
    providers.set(agentId, createAgentLLMProvider(agentId, customConfig));
  }

  return providers;
}

/**
 * Get a description of the model configuration for logging
 */
export function getModelConfigDescription(
  customConfig?: Partial<InsightModelConfiguration>
): Record<AgentId, string> {
  const agentIds: AgentId[] = [
    'A1_RETRIEVAL',
    'A2_JUDGE',
    'A3_COMPARATOR',
    'A4_WEB',
    'A4_COMPANY',
    'A5_FEATURE_ADOPTION',
  ];

  const descriptions: Partial<Record<AgentId, string>> = {};

  for (const agentId of agentIds) {
    const config = getAgentModelConfig(agentId, customConfig);
    descriptions[agentId] = `${config.provider}/${config.model} (temp=${config.temperature})`;
  }

  return descriptions as Record<AgentId, string>;
}

/**
 * Clear the provider cache (useful for testing)
 */
export function clearProviderCache(): void {
  providerCache.clear();
}
