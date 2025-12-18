/**
 * SessionClassifierService
 * AI-powered service for classifying desktop sessions into work track categories
 * and matching them to existing timeline nodes.
 * (LIG-247: Desktop Session to Work Track Mapping)
 *
 * Key Insight: Classification uses the already-generated summary from the desktop app,
 * NOT raw screenshots. By the time the user clicks "Push Session", the desktop app
 * has already analyzed screenshots and generated a comprehensive summary.
 */

import {
  CATEGORY_CLASSIFICATION_SIGNALS,
  ClassificationResult,
  NodeInfo,
  NodeMappingResult,
  PushSessionRequest,
  SessionMappingAction,
  TimelineNodeType,
  WORK_TRACK_CATEGORY_LABELS,
  WORK_TRACK_CATEGORY_TO_NODE_TYPE,
  WorkTrackCategory,
} from '@journey/schema';
import { z } from 'zod';

import type { LLMProvider } from '../core/llm-provider.js';
import type { Logger } from '../core/logger.js';
import type { HierarchyRepository } from '../repositories/hierarchy-repository.js';
import type { SessionMappingRepository } from '../repositories/session-mapping.repository.js';
import type { EmbeddingService } from './interfaces/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ClassifyAndMatchResult {
  classification: ClassificationResult;
  nodeMatch: NodeMappingResult;
}

interface UserLearningContext {
  categoryAdjustments: Partial<
    Record<WorkTrackCategory, { boost: number; reason: string }>
  >;
  appPatterns: Record<string, WorkTrackCategory>;
}

// ============================================================================
// SERVICE
// ============================================================================

export class SessionClassifierService {
  private readonly llmProvider: LLMProvider;
  private readonly embeddingService: EmbeddingService;
  private readonly hierarchyRepository: HierarchyRepository;
  private readonly sessionMappingRepository: SessionMappingRepository;
  private readonly logger: Logger;

  // Confidence threshold for matching to existing node
  private readonly NODE_MATCH_THRESHOLD = 0.65;
  private readonly CATEGORY_CONFIDENCE_THRESHOLD = 0.7;

  constructor({
    llmProvider,
    openAIEmbeddingService,
    hierarchyRepository,
    sessionMappingRepository,
    logger,
  }: {
    llmProvider: LLMProvider;
    openAIEmbeddingService: EmbeddingService;
    hierarchyRepository: HierarchyRepository;
    sessionMappingRepository: SessionMappingRepository;
    logger: Logger;
  }) {
    this.llmProvider = llmProvider;
    this.embeddingService = openAIEmbeddingService;
    this.hierarchyRepository = hierarchyRepository;
    this.sessionMappingRepository = sessionMappingRepository;
    this.logger = logger;
  }

  /**
   * Main entry point: Classify session and match to timeline node
   * Uses pre-processed summary data from desktop app (NOT raw screenshots)
   */
  async classifyAndMatch(
    sessionData: PushSessionRequest,
    userId: number
  ): Promise<ClassifyAndMatchResult> {
    this.logger.info('Starting session classification and matching', {
      userId,
      sessionId: sessionData.sessionId,
      workflowName: sessionData.workflowName,
      hasUserSelectedNode: !!sessionData.journeyNodeId,
    });

    // If user pre-selected a node (current manual flow), skip classification
    if (sessionData.journeyNodeId) {
      return this.handleUserSelectedNode(sessionData, userId);
    }

    // Stage 1: Classify into category using existing summary
    const classification = await this.classifyFromSummary(sessionData, userId);

    // Stage 2: Match to existing node or create new
    const nodeMatch = await this.matchToNode(
      classification,
      sessionData,
      userId
    );

    this.logger.info('Session classification and matching complete', {
      userId,
      sessionId: sessionData.sessionId,
      category: classification.category,
      categoryConfidence: classification.confidence,
      nodeAction: nodeMatch.action,
      nodeId: nodeMatch.nodeId,
    });

    return { classification, nodeMatch };
  }

  /**
   * Handle case where user pre-selected a node (backward compatibility)
   */
  private async handleUserSelectedNode(
    sessionData: PushSessionRequest,
    userId: number
  ): Promise<ClassifyAndMatchResult> {
    const nodeId = sessionData.journeyNodeId!;

    // Get node info
    const node = await this.hierarchyRepository.getNodeById(nodeId, userId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Infer category from node type
    const category = this.inferCategoryFromNodeType(node.type as TimelineNodeType);

    return {
      classification: {
        category,
        confidence: 1.0, // User selected, so 100% confidence
        nodeType: node.type as TimelineNodeType,
        signals: ['user_selected'],
      },
      nodeMatch: {
        action: SessionMappingAction.UserSelected,
        nodeId,
        node: {
          id: node.id,
          type: node.type as TimelineNodeType,
          title: (node.meta as any)?.title || 'Unknown',
          meta: node.meta as Record<string, any>,
        },
        confidence: 1.0,
      },
    };
  }

  /**
   * Stage 1: Classify session into category using existing summary text
   * Uses the already-generated summary from desktop app's screenshot analysis
   */
  private async classifyFromSummary(
    sessionData: PushSessionRequest,
    userId: number
  ): Promise<ClassificationResult> {
    // Build classification context from existing summary
    const classificationText = this.buildClassificationText(sessionData);

    // Get user's learned preferences for RLHF adjustments
    const userPreferences = await this.getUserPreferences(userId);

    // Use LLM to classify into category
    const llmResult = await this.classifyWithLLM(
      classificationText,
      sessionData.appsUsed || [],
      userPreferences
    );

    return llmResult;
  }

  /**
   * Build classification text from session summary
   */
  private buildClassificationText(sessionData: PushSessionRequest): string {
    const parts: string[] = [];

    // Workflow name (user-provided title)
    parts.push(`Session Title: ${sessionData.workflowName}`);

    // High-level summary
    if (sessionData.summary.highLevelSummary) {
      parts.push(`Summary: ${sessionData.summary.highLevelSummary}`);
    }

    // Chapter titles and summaries
    if (sessionData.summary.chapters?.length > 0) {
      const chapterTexts = sessionData.summary.chapters
        .map((c) => `- ${c.title}: ${c.summary}`)
        .join('\n');
      parts.push(`Activities:\n${chapterTexts}`);
    }

    // Apps used
    if (sessionData.appsUsed && sessionData.appsUsed.length > 0) {
      parts.push(`Apps Used: ${sessionData.appsUsed.join(', ')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Classify using LLM with structured output
   */
  private async classifyWithLLM(
    classificationText: string,
    appsUsed: string[],
    userPreferences: UserLearningContext
  ): Promise<ClassificationResult> {
    // Build category descriptions for the LLM
    const categoryDescriptions = Object.entries(WORK_TRACK_CATEGORY_LABELS)
      .map(([value, label]) => {
        const signals = CATEGORY_CLASSIFICATION_SIGNALS[value as WorkTrackCategory];
        const nodeType = WORK_TRACK_CATEGORY_TO_NODE_TYPE[value as WorkTrackCategory];
        return `- ${value}: ${label} (maps to ${nodeType}). Keywords: ${signals.keywords.slice(0, 3).join(', ')}. Apps: ${signals.apps.slice(0, 3).join(', ')}`;
      })
      .join('\n');

    const systemPrompt = `You are a session classifier that categorizes work activities into one of 27 predefined categories.
Analyze the session data and determine the most appropriate category based on:
1. The session title/workflow name
2. The high-level summary
3. The chapter titles and their content
4. The apps used during the session

Categories:
${categoryDescriptions}

Be precise and choose the single best-matching category.`;

    const userPrompt = `Classify this work session:

${classificationText}

Return the classification as JSON with:
- category: the category value (e.g., "work_project", "job_search")
- confidence: a number between 0 and 1 indicating confidence
- signals: array of 2-4 specific phrases from the input that triggered this classification`;

    const ClassificationSchema = z.object({
      category: z.nativeEnum(WorkTrackCategory),
      confidence: z.number().min(0).max(1),
      signals: z.array(z.string()),
    });

    try {
      const response = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ClassificationSchema,
        { temperature: 0.1, maxTokens: 500 }
      );

      const result = response.content;

      // Apply RLHF adjustments from user preferences
      const adjustedResult = this.applyUserPreferences(result, userPreferences, appsUsed);

      // Get the mapped node type
      const nodeType = WORK_TRACK_CATEGORY_TO_NODE_TYPE[adjustedResult.category];

      return {
        category: adjustedResult.category,
        confidence: adjustedResult.confidence,
        nodeType,
        signals: adjustedResult.signals,
      };
    } catch (error) {
      this.logger.error('LLM classification failed, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback: use keyword matching
      return this.fallbackClassification(classificationText, appsUsed);
    }
  }

  /**
   * Fallback classification using keyword matching
   */
  private fallbackClassification(
    classificationText: string,
    appsUsed: string[]
  ): ClassificationResult {
    const textLower = classificationText.toLowerCase();
    const appsLower = appsUsed.map((a) => a.toLowerCase());

    let bestCategory = WorkTrackCategory.GeneralBrowsing;
    let bestScore = 0;
    const signals: string[] = [];

    for (const [category, categorySignals] of Object.entries(
      CATEGORY_CLASSIFICATION_SIGNALS
    )) {
      let score = 0;

      // Check keywords
      for (const keyword of categorySignals.keywords) {
        if (textLower.includes(keyword.toLowerCase())) {
          score += 2;
          signals.push(keyword);
        }
      }

      // Check apps
      for (const app of categorySignals.apps) {
        if (appsLower.some((a) => a.includes(app.toLowerCase()))) {
          score += 1;
          signals.push(`App: ${app}`);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = category as WorkTrackCategory;
      }
    }

    const nodeType = WORK_TRACK_CATEGORY_TO_NODE_TYPE[bestCategory];

    return {
      category: bestCategory,
      confidence: Math.min(0.5 + bestScore * 0.1, 0.8), // Cap at 0.8 for fallback
      nodeType,
      signals: signals.slice(0, 4),
    };
  }

  /**
   * Stage 2: Match to existing node or create new
   */
  private async matchToNode(
    classification: ClassificationResult,
    sessionData: PushSessionRequest,
    userId: number
  ): Promise<NodeMappingResult> {
    const nodeType = classification.nodeType;

    // Get user's existing nodes of the target type
    const existingNodes = await this.hierarchyRepository.getNodesByType(
      userId,
      nodeType
    );

    if (existingNodes.length === 0) {
      // No existing nodes, create new
      return this.createNewNode(sessionData, classification, userId);
    }

    // Generate embedding for session summary
    const sessionEmbedding = await this.embeddingService.generateEmbedding(
      sessionData.summary.highLevelSummary
    );

    // Find best matching node using semantic similarity
    const matches = await this.findBestMatchingNodes(
      existingNodes,
      sessionEmbedding,
      sessionData,
      userId
    );

    if (matches.length === 0 || matches[0].score < this.NODE_MATCH_THRESHOLD) {
      // No good match, create new node
      const result = await this.createNewNode(sessionData, classification, userId);
      // Include alternatives for user review
      result.alternativeNodes = matches.slice(0, 3).map((m) => m.node);
      return result;
    }

    // Use best match
    const bestMatch = matches[0];

    return {
      action: SessionMappingAction.MatchedExisting,
      nodeId: bestMatch.node.id,
      node: bestMatch.node,
      confidence: bestMatch.score,
      alternativeNodes: matches.slice(1, 4).map((m) => m.node),
    };
  }

  /**
   * Find best matching nodes using semantic similarity
   */
  private async findBestMatchingNodes(
    nodes: any[],
    sessionEmbedding: Float32Array,
    sessionData: PushSessionRequest,
    userId: number
  ): Promise<Array<{ node: NodeInfo; score: number }>> {
    const matches: Array<{ node: NodeInfo; score: number }> = [];

    for (const node of nodes) {
      // Get or generate node embedding
      const nodeText = this.buildNodeText(node);
      const nodeEmbedding = await this.embeddingService.generateEmbedding(nodeText);

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(sessionEmbedding, nodeEmbedding);

      // Apply temporal boost (recent nodes get higher scores)
      const temporalBoost = this.calculateTemporalBoost(node);

      // Final score
      const score = similarity * 0.7 + temporalBoost * 0.3;

      matches.push({
        node: {
          id: node.id,
          type: node.type as TimelineNodeType,
          title: (node.meta as any)?.title || 'Unknown',
          meta: node.meta as Record<string, any>,
        },
        score,
      });
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return matches;
  }

  /**
   * Build text representation of a node for embedding
   */
  private buildNodeText(node: any): string {
    const meta = node.meta || {};
    const parts: string[] = [];

    if (meta.title) parts.push(meta.title);
    if (meta.description) parts.push(meta.description);
    if (meta.role) parts.push(meta.role);
    if (meta.company) parts.push(meta.company);
    if (meta.technologies) parts.push(meta.technologies.join(', '));

    return parts.join(' ');
  }

  /**
   * Calculate temporal boost based on node activity recency
   */
  private calculateTemporalBoost(node: any): number {
    const updatedAt = new Date(node.updatedAt);
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay: recent nodes get higher boost
    // Full boost (1.0) for today, ~0.5 for 7 days ago, ~0.1 for 30 days ago
    return Math.exp(-daysSinceUpdate / 10);
  }

  /**
   * Cosine similarity between two embeddings
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Create a new timeline node for the session
   */
  private async createNewNode(
    sessionData: PushSessionRequest,
    classification: ClassificationResult,
    userId: number
  ): Promise<NodeMappingResult> {
    const nodeType = classification.nodeType;

    // Build node metadata based on type
    const meta = this.buildNodeMeta(sessionData, classification);

    // Create the node
    const newNode = await this.hierarchyRepository.createNode({
      userId,
      type: nodeType,
      parentId: undefined, // Root-level node, can be moved later
      meta,
    });

    return {
      action: SessionMappingAction.CreatedNew,
      nodeId: newNode.id,
      node: {
        id: newNode.id,
        type: nodeType,
        title: meta.title || sessionData.workflowName,
        meta,
      },
      confidence: classification.confidence,
    };
  }

  /**
   * Build node metadata based on session data and classification
   */
  private buildNodeMeta(
    sessionData: PushSessionRequest,
    classification: ClassificationResult
  ): Record<string, any> {
    const meta: Record<string, any> = {
      title: sessionData.workflowName,
      description: sessionData.summary.highLevelSummary,
      // Store chapters from session
      chapters: sessionData.summary.chapters,
      // Classification metadata
      workTrackCategory: classification.category,
      autoClassified: true,
      classificationConfidence: classification.confidence,
    };

    // Add type-specific fields
    switch (classification.nodeType) {
      case TimelineNodeType.Project:
        meta.projectType = this.inferProjectType(classification.category);
        meta.status = 'active';
        break;
      case TimelineNodeType.Education:
        // Could extract course name, platform, etc. from summary
        break;
      case TimelineNodeType.Job:
        // Could extract role, company from summary
        break;
    }

    return meta;
  }

  /**
   * Infer project type from category
   */
  private inferProjectType(category: WorkTrackCategory): string {
    switch (category) {
      case WorkTrackCategory.WorkProject:
        return 'professional';
      case WorkTrackCategory.SideProject:
        return 'personal';
      case WorkTrackCategory.OpenSource:
        return 'open-source';
      case WorkTrackCategory.FreelanceWork:
        return 'freelance';
      default:
        return 'personal';
    }
  }

  /**
   * Infer category from node type (for backward compatibility)
   */
  private inferCategoryFromNodeType(nodeType: TimelineNodeType): WorkTrackCategory {
    // Return the most common category for each node type
    switch (nodeType) {
      case TimelineNodeType.Job:
        return WorkTrackCategory.CoreWork;
      case TimelineNodeType.Education:
        return WorkTrackCategory.OnlineCourse;
      case TimelineNodeType.Project:
        return WorkTrackCategory.WorkProject;
      case TimelineNodeType.Event:
        return WorkTrackCategory.ConferenceEvent;
      case TimelineNodeType.Action:
        return WorkTrackCategory.AdminTasks;
      case TimelineNodeType.CareerTransition:
        return WorkTrackCategory.JobSearch;
      default:
        return WorkTrackCategory.GeneralBrowsing;
    }
  }

  /**
   * Get user's learned preferences from RLHF feedback
   */
  private async getUserPreferences(userId: number): Promise<UserLearningContext> {
    try {
      // Get recent feedback for this user
      const { feedback } = await this.sessionMappingRepository.getFeedbackByUser(
        userId,
        { page: 1, limit: 50 }
      );

      const categoryAdjustments: UserLearningContext['categoryAdjustments'] = {};
      const appPatterns: Record<string, WorkTrackCategory> = {};

      // Analyze feedback patterns
      for (const fb of feedback) {
        if (fb.correctedCategory && fb.correctedCategory !== fb.originalCategory) {
          // User corrected this category - boost the corrected one
          const existing = categoryAdjustments[fb.correctedCategory];
          categoryAdjustments[fb.correctedCategory] = {
            boost: (existing?.boost || 0) + 0.1,
            reason: `User frequently corrects to ${fb.correctedCategory}`,
          };
        }
      }

      return { categoryAdjustments, appPatterns };
    } catch (error) {
      this.logger.warn('Failed to get user preferences, using defaults', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { categoryAdjustments: {}, appPatterns: {} };
    }
  }

  /**
   * Apply user preferences to classification result
   */
  private applyUserPreferences(
    result: { category: WorkTrackCategory; confidence: number; signals: string[] },
    preferences: UserLearningContext,
    appsUsed: string[]
  ): { category: WorkTrackCategory; confidence: number; signals: string[] } {
    // Check if user has learned app patterns
    for (const app of appsUsed) {
      const preferredCategory = preferences.appPatterns[app.toLowerCase()];
      if (preferredCategory) {
        // User has a strong preference for this app -> category mapping
        return {
          category: preferredCategory,
          confidence: Math.min(result.confidence + 0.1, 1.0),
          signals: [...result.signals, `User preference: ${app} -> ${preferredCategory}`],
        };
      }
    }

    // Check for category adjustments
    const adjustment = preferences.categoryAdjustments[result.category];
    if (adjustment) {
      return {
        ...result,
        confidence: Math.min(result.confidence + adjustment.boost, 1.0),
        signals: [...result.signals, adjustment.reason],
      };
    }

    return result;
  }
}

