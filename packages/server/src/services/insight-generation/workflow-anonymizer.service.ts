/**
 * Workflow Anonymizer Service
 *
 * Implements Section 1.5 of Insight_Assistant_Plan.txt:
 * "Anonymized Platform Workflow Store"
 *
 * This service:
 * 1. Extracts workflow/step patterns from user sessions
 * 2. Removes all user-identifying information (PII)
 * 3. Generates hashes for deduplication
 * 4. Stores anonymized patterns in platform tables for peer comparison
 *
 * The anonymized data enables:
 * - Cross-user pattern analysis
 * - Peer workflow comparison (A3 Comparator Agent)
 * - Benchmarking against efficient workflows
 */

import crypto from 'crypto';
import type { Logger } from '../../core/logger.js';
import type { EmbeddingService } from '../interfaces/index.js';
import type { SessionChapter, GranularStep } from '@journey/schema';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Raw session data from user (input to anonymization)
 */
export interface RawSessionData {
  sessionId: string;
  userId: number;
  workflowName: string;
  highLevelSummary: string;
  chapters: SessionChapter[];
  startTime: number;
  endTime: number;
  appsUsed: string[];
  category: string;
  roleCategory?: string;
}

/**
 * Anonymized workflow pattern (ready for storage)
 */
export interface AnonymizedWorkflowPattern {
  workflowHash: string;
  workflowType: string;
  roleCategory: string | null;
  stepCount: number;
  avgDurationSeconds: number;
  stepSequence: AnonymizedStepSequence[];
  toolPatterns: Record<string, number>;
  embedding?: number[];
}

/**
 * Anonymized step in sequence
 */
export interface AnonymizedStepSequence {
  order: number;
  type: string;
  toolCategory: string;
  avgDuration: number;
  description?: string;
}

/**
 * Anonymized step pattern (ready for storage)
 */
export interface AnonymizedStepPattern {
  stepHash: string;
  stepType: string;
  toolCategory: string | null;
  avgDurationSeconds: number;
  efficiencyIndicators: {
    contextSwitches?: number;
    idlePercentage?: number;
    reworkRate?: number;
  };
  embedding?: number[];
}

// ============================================================================
// PII PATTERNS
// ============================================================================

/**
 * Regular expressions for detecting and removing PII
 */
const PII_PATTERNS = {
  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // URLs with potential user data
  urlWithPath: /https?:\/\/[^\s]+/g,

  // File paths that might contain usernames
  filePath: /(?:\/Users\/|\/home\/|C:\\Users\\)[^\s\/\\]+/gi,

  // Names (capitalized words that aren't tools/apps)
  potentialName: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,

  // Phone numbers
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,

  // IP addresses
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,

  // UUIDs (might identify specific resources)
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,

  // API keys and tokens (common patterns)
  apiKey: /(?:api[_-]?key|token|secret|password|auth)[=:]\s*[^\s,;]+/gi,
};

/**
 * Known tool/app names that should NOT be anonymized
 */
const KNOWN_TOOLS = new Set([
  // Browsers
  'chrome',
  'firefox',
  'safari',
  'edge',
  'arc',
  'brave',
  // IDEs
  'vscode',
  'visual studio code',
  'intellij',
  'webstorm',
  'pycharm',
  'cursor',
  'zed',
  'sublime',
  'atom',
  'vim',
  'neovim',
  'emacs',
  // Communication
  'slack',
  'discord',
  'teams',
  'zoom',
  'meet',
  'skype',
  // Productivity
  'notion',
  'obsidian',
  'google docs',
  'microsoft word',
  'excel',
  'sheets',
  'figma',
  'miro',
  // Development
  'terminal',
  'iterm',
  'warp',
  'github',
  'gitlab',
  'bitbucket',
  'postman',
  'insomnia',
  // Other
  'finder',
  'explorer',
  'spotify',
  'notes',
  'calendar',
  'mail',
  'outlook',
]);

/**
 * Tool categories for grouping
 */
const TOOL_CATEGORIES: Record<string, string> = {
  chrome: 'browser',
  firefox: 'browser',
  safari: 'browser',
  edge: 'browser',
  arc: 'browser',
  brave: 'browser',
  vscode: 'ide',
  'visual studio code': 'ide',
  intellij: 'ide',
  webstorm: 'ide',
  pycharm: 'ide',
  cursor: 'ide',
  zed: 'ide',
  sublime: 'ide',
  atom: 'ide',
  vim: 'terminal',
  neovim: 'terminal',
  emacs: 'ide',
  terminal: 'terminal',
  iterm: 'terminal',
  warp: 'terminal',
  slack: 'communication',
  discord: 'communication',
  teams: 'communication',
  zoom: 'video',
  meet: 'video',
  skype: 'video',
  notion: 'notes',
  obsidian: 'notes',
  'google docs': 'docs',
  'microsoft word': 'docs',
  figma: 'design',
  miro: 'design',
  github: 'vcs',
  gitlab: 'vcs',
  bitbucket: 'vcs',
  postman: 'api',
  insomnia: 'api',
};

// ============================================================================
// SERVICE
// ============================================================================

export interface WorkflowAnonymizerDeps {
  logger: Logger;
  openAIEmbeddingService: EmbeddingService;
}

export class WorkflowAnonymizerService {
  private readonly logger: Logger;
  private readonly embeddingService: EmbeddingService;

  constructor(deps: WorkflowAnonymizerDeps) {
    this.logger = deps.logger;
    this.embeddingService = deps.openAIEmbeddingService;
  }

  // --------------------------------------------------------------------------
  // MAIN ANONYMIZATION METHODS
  // --------------------------------------------------------------------------

  /**
   * Anonymize a user session and extract workflow/step patterns
   */
  async anonymizeSession(
    session: RawSessionData
  ): Promise<{
    workflowPattern: AnonymizedWorkflowPattern;
    stepPatterns: AnonymizedStepPattern[];
  }> {
    this.logger.info('Anonymizing session', {
      sessionId: session.sessionId,
      chapterCount: session.chapters.length,
    });

    // Extract and anonymize workflow pattern
    const workflowPattern = await this.extractWorkflowPattern(session);

    // Extract and anonymize step patterns
    const stepPatterns = await this.extractStepPatterns(session);

    this.logger.info('Session anonymized', {
      workflowHash: workflowPattern.workflowHash,
      stepCount: stepPatterns.length,
    });

    return { workflowPattern, stepPatterns };
  }

  /**
   * Extract workflow-level pattern from session
   */
  private async extractWorkflowPattern(
    session: RawSessionData
  ): Promise<AnonymizedWorkflowPattern> {
    // Calculate total duration
    const durationSeconds = Math.round((session.endTime - session.startTime) / 1000);

    // Count total steps across all chapters
    const totalSteps = session.chapters.reduce(
      (sum, chapter) => sum + (chapter.granular_steps?.length || 0),
      0
    );

    // Extract step sequence (anonymized)
    const stepSequence = this.extractStepSequence(session.chapters);

    // Calculate tool distribution
    const toolPatterns = this.calculateToolPatterns(session.chapters, session.appsUsed);

    // Generate workflow hash for deduplication
    const workflowHash = this.generateWorkflowHash(
      session.category,
      stepSequence,
      toolPatterns
    );

    // Anonymize the summary for embedding
    const anonymizedSummary = this.anonymizeText(session.highLevelSummary);

    // Generate embedding for semantic search
    let embedding: number[] | undefined;
    try {
      embedding = await this.embeddingService.generateEmbedding(anonymizedSummary);
    } catch (error) {
      this.logger.warn('Failed to generate workflow embedding', { error });
    }

    return {
      workflowHash,
      workflowType: this.normalizeWorkflowType(session.category),
      roleCategory: session.roleCategory || null,
      stepCount: totalSteps,
      avgDurationSeconds: durationSeconds,
      stepSequence,
      toolPatterns,
      embedding,
    };
  }

  /**
   * Extract step-level patterns from session chapters
   */
  private async extractStepPatterns(
    session: RawSessionData
  ): Promise<AnonymizedStepPattern[]> {
    const patterns: AnonymizedStepPattern[] = [];

    for (const chapter of session.chapters) {
      if (!chapter.granular_steps) continue;

      for (const step of chapter.granular_steps) {
        const pattern = await this.extractStepPattern(step, chapter);
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Extract a single step pattern
   */
  private async extractStepPattern(
    step: GranularStep,
    chapter: SessionChapter
  ): Promise<AnonymizedStepPattern> {
    // Determine step type from description
    const stepType = this.classifyStepType(step.description);

    // Get tool category
    const toolCategory = this.getToolCategory(step.app || chapter.primary_app || '');

    // Calculate duration (estimate if not available)
    const avgDurationSeconds = this.estimateStepDuration(step, chapter);

    // Generate step hash
    const stepHash = this.generateStepHash(stepType, toolCategory, step.description);

    // Anonymize description for embedding
    const anonymizedDescription = this.anonymizeText(step.description);

    // Generate embedding
    let embedding: number[] | undefined;
    try {
      embedding = await this.embeddingService.generateEmbedding(anonymizedDescription);
    } catch (error) {
      this.logger.warn('Failed to generate step embedding', { error });
    }

    return {
      stepHash,
      stepType,
      toolCategory,
      avgDurationSeconds,
      efficiencyIndicators: {},
      embedding,
    };
  }

  // --------------------------------------------------------------------------
  // ANONYMIZATION HELPERS
  // --------------------------------------------------------------------------

  /**
   * Remove PII from text while preserving meaning
   */
  private anonymizeText(text: string): string {
    let anonymized = text;

    // Remove emails
    anonymized = anonymized.replace(PII_PATTERNS.email, '[EMAIL]');

    // Remove URLs (keep domain only for context)
    anonymized = anonymized.replace(PII_PATTERNS.urlWithPath, (url) => {
      try {
        const domain = new URL(url).hostname;
        return `[URL:${domain}]`;
      } catch {
        return '[URL]';
      }
    });

    // Remove file paths with usernames
    anonymized = anonymized.replace(PII_PATTERNS.filePath, '[PATH]');

    // Remove UUIDs
    anonymized = anonymized.replace(PII_PATTERNS.uuid, '[ID]');

    // Remove API keys/tokens
    anonymized = anonymized.replace(PII_PATTERNS.apiKey, '[CREDENTIAL]');

    // Remove phone numbers
    anonymized = anonymized.replace(PII_PATTERNS.phone, '[PHONE]');

    // Remove IP addresses
    anonymized = anonymized.replace(PII_PATTERNS.ipAddress, '[IP]');

    return anonymized;
  }

  /**
   * Extract step sequence from chapters (anonymized)
   */
  private extractStepSequence(chapters: SessionChapter[]): AnonymizedStepSequence[] {
    const sequence: AnonymizedStepSequence[] = [];
    let order = 0;

    for (const chapter of chapters) {
      if (!chapter.granular_steps) continue;

      for (const step of chapter.granular_steps) {
        order++;
        sequence.push({
          order,
          type: this.classifyStepType(step.description),
          toolCategory: this.getToolCategory(step.app || chapter.primary_app || ''),
          avgDuration: this.estimateStepDuration(step, chapter),
          description: this.anonymizeText(step.description),
        });
      }
    }

    return sequence;
  }

  /**
   * Calculate tool usage distribution
   */
  private calculateToolPatterns(
    chapters: SessionChapter[],
    appsUsed: string[]
  ): Record<string, number> {
    const patterns: Record<string, number> = {};

    // Count from chapters
    for (const chapter of chapters) {
      const tool = chapter.primary_app?.toLowerCase() || 'unknown';
      const category = this.getToolCategory(tool);
      patterns[category] = (patterns[category] || 0) + 1;
    }

    // Add from appsUsed list
    for (const app of appsUsed) {
      const category = this.getToolCategory(app.toLowerCase());
      patterns[category] = (patterns[category] || 0) + 1;
    }

    return patterns;
  }

  /**
   * Classify step type from description
   */
  private classifyStepType(description: string): string {
    const lower = description.toLowerCase();

    if (lower.includes('search') || lower.includes('google') || lower.includes('query')) {
      return 'search';
    }
    if (lower.includes('read') || lower.includes('view') || lower.includes('open')) {
      return 'read';
    }
    if (lower.includes('write') || lower.includes('create') || lower.includes('new')) {
      return 'write';
    }
    if (lower.includes('edit') || lower.includes('modify') || lower.includes('update')) {
      return 'edit';
    }
    if (lower.includes('navigate') || lower.includes('switch') || lower.includes('go to')) {
      return 'navigate';
    }
    if (lower.includes('copy') || lower.includes('clipboard')) {
      return 'copy';
    }
    if (lower.includes('paste')) {
      return 'paste';
    }
    if (lower.includes('review') || lower.includes('check') || lower.includes('verify')) {
      return 'review';
    }
    if (lower.includes('compile') || lower.includes('build')) {
      return 'compile';
    }
    if (lower.includes('run') || lower.includes('execute') || lower.includes('test')) {
      return 'run';
    }
    if (lower.includes('debug') || lower.includes('fix') || lower.includes('error')) {
      return 'debug';
    }
    if (lower.includes('commit') || lower.includes('push') || lower.includes('git')) {
      return 'commit';
    }
    if (lower.includes('deploy') || lower.includes('release')) {
      return 'deploy';
    }
    if (lower.includes('message') || lower.includes('chat') || lower.includes('call')) {
      return 'communicate';
    }
    if (lower.includes('wait') || lower.includes('idle') || lower.includes('pause')) {
      return 'idle';
    }

    return 'other';
  }

  /**
   * Get tool category from app name
   */
  private getToolCategory(app: string): string {
    const lower = app.toLowerCase();
    return TOOL_CATEGORIES[lower] || 'other';
  }

  /**
   * Normalize workflow type to standard categories
   */
  private normalizeWorkflowType(category: string): string {
    const lower = category.toLowerCase();

    const mappings: Record<string, string> = {
      research: 'research',
      coding: 'coding',
      development: 'coding',
      programming: 'coding',
      documentation: 'documentation',
      docs: 'documentation',
      writing: 'writing',
      debugging: 'debugging',
      testing: 'testing',
      design: 'design',
      planning: 'planning',
      learning: 'learning',
      communication: 'communication',
      meeting: 'meeting',
      analysis: 'analysis',
      deployment: 'deployment',
      code_review: 'code_review',
      review: 'code_review',
      market_analysis: 'market_analysis',
    };

    return mappings[lower] || 'other';
  }

  /**
   * Estimate step duration (when not explicitly provided)
   */
  private estimateStepDuration(step: GranularStep, chapter: SessionChapter): number {
    // If chapter has time boundaries, estimate from those
    if (chapter.time_start && chapter.time_end) {
      const chapterSteps = chapter.granular_steps?.length || 1;
      const start = new Date(chapter.time_start).getTime();
      const end = new Date(chapter.time_end).getTime();
      const chapterDuration = (end - start) / 1000;
      return Math.round(chapterDuration / chapterSteps);
    }

    // Default estimates based on step type
    const stepType = this.classifyStepType(step.description);
    const defaultDurations: Record<string, number> = {
      search: 30,
      read: 60,
      write: 120,
      edit: 45,
      navigate: 10,
      copy: 5,
      paste: 5,
      review: 90,
      compile: 30,
      run: 60,
      debug: 180,
      commit: 30,
      deploy: 120,
      communicate: 60,
      idle: 30,
      other: 30,
    };

    return defaultDurations[stepType] || 30;
  }

  // --------------------------------------------------------------------------
  // HASHING
  // --------------------------------------------------------------------------

  /**
   * Generate workflow hash for deduplication
   */
  private generateWorkflowHash(
    category: string,
    stepSequence: AnonymizedStepSequence[],
    toolPatterns: Record<string, number>
  ): string {
    // Create a normalized representation
    const normalized = {
      category: this.normalizeWorkflowType(category),
      stepTypes: stepSequence.map((s) => s.type),
      toolCategories: Object.keys(toolPatterns).sort(),
      stepCount: stepSequence.length,
    };

    const content = JSON.stringify(normalized);
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 64);
  }

  /**
   * Generate step hash for deduplication
   */
  private generateStepHash(
    stepType: string,
    toolCategory: string,
    description: string
  ): string {
    // Anonymize and normalize the description
    const anonymized = this.anonymizeText(description);
    const normalized = anonymized.toLowerCase().replace(/\s+/g, ' ').trim();

    const content = JSON.stringify({
      type: stepType,
      tool: toolCategory,
      desc: normalized.substring(0, 100), // Limit description length
    });

    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 64);
  }
}
