/**
 * SessionService
 * Business logic layer for desktop session management
 * (LIG-247: Desktop Session to Work Track Mapping)
 *
 * Coordinates between:
 * - SessionClassifierService (AI classification)
 * - SessionMappingRepository (database operations)
 * - HierarchyService (timeline node management)
 */

import {
  CategoriesResponse,
  CategoryDefinition,
  ListSessionsQuery,
  ListSessionsResponse,
  NodeSessionsQuery,
  NodeSessionsResponse,
  PushSessionRequest,
  PushSessionResponse,
  ReclassifySessionRequest,
  RemapSessionRequest,
  SessionFeedbackType,
  SessionMappingAction,
  SessionMappingItem,
  SessionUpdateResponse,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
  TimelineNodeType,
  WORK_TRACK_CATEGORY_GROUPS,
  WORK_TRACK_CATEGORY_LABELS,
  WORK_TRACK_CATEGORY_TO_NODE_TYPE,
  WorkTrackCategory,
  WorkTrackMappingAction,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';
import type {
  SessionMapping,
  SessionMappingRepository,
} from '../repositories/session-mapping.repository.js';
import type { HierarchyService, CreateNodeDTO } from './hierarchy-service.js';
import type { EmbeddingService } from './interfaces/index.js';
import type { SessionClassifierService } from './session-classifier.service.js';
import type { UserService } from './user-service.js';

// ============================================================================
// SERVICE
// ============================================================================

export class SessionService {
  private readonly sessionClassifierService: SessionClassifierService;
  private readonly sessionMappingRepository: SessionMappingRepository;
  private readonly hierarchyService: HierarchyService;
  private readonly embeddingService: EmbeddingService;
  private readonly userService: UserService;
  private readonly logger: Logger;

  constructor({
    sessionClassifierService,
    sessionMappingRepository,
    hierarchyService,
    openAIEmbeddingService,
    userService,
    logger,
  }: {
    sessionClassifierService: SessionClassifierService;
    sessionMappingRepository: SessionMappingRepository;
    hierarchyService: HierarchyService;
    openAIEmbeddingService: EmbeddingService;
    userService: UserService;
    logger: Logger;
  }) {
    this.sessionClassifierService = sessionClassifierService;
    this.sessionMappingRepository = sessionMappingRepository;
    this.hierarchyService = hierarchyService;
    this.embeddingService = openAIEmbeddingService;
    this.userService = userService;
    this.logger = logger;
  }

  // --------------------------------------------------------------------------
  // PUSH SESSION
  // --------------------------------------------------------------------------

  /**
   * Push a session from desktop app
   * This is the main entry point when user clicks "Push Session"
   */
  async pushSession(
    sessionData: PushSessionRequest,
    userId: number
  ): Promise<PushSessionResponse> {
    this.logger.info('Processing session push', {
      userId,
      sessionId: sessionData.sessionId,
      workflowName: sessionData.workflowName,
      journeyNodeId: sessionData.journeyNodeId,
    });

    // Check if session already exists (idempotency)
    const existing = await this.sessionMappingRepository.getByDesktopSessionId(
      userId,
      sessionData.sessionId
    );

    if (existing) {
      this.logger.info('Session already pushed, returning existing mapping', {
        sessionMappingId: existing.id,
      });

      const existingCategory = existing.category as WorkTrackCategory;
      const existingAction = (existing.mappingAction || SessionMappingAction.MatchedExisting) as SessionMappingAction;

      return {
        success: true,
        sessionMappingId: existing.id,
        classification: {
          category: existingCategory,
          confidence: existing.categoryConfidence || 0,
          nodeType: WORK_TRACK_CATEGORY_TO_NODE_TYPE[existingCategory],
          signals: ['already_processed'],
        },
        nodeMapping: {
          action: existingAction,
          nodeId: existing.nodeId || '',
          confidence: existing.nodeMatchConfidence || 0,
        },
        message: 'Session was already pushed',
      };
    }

    try {
      // Calculate duration
      const durationSeconds = Math.round(
        (sessionData.endTime - sessionData.startTime) / 1000
      );

      // Use journeyNodeId or projectId directly - no classification needed
      // The desktop app already determines which node to associate the session with
      // But we need to verify the node exists to avoid FK constraint violations
      let finalNodeId = sessionData.journeyNodeId || sessionData.projectId || undefined;
      let nodeValidationStatus: 'valid' | 'not_found' | 'no_node' | 'auto_created' = finalNodeId ? 'valid' : 'no_node';

      // Validate that the node exists in the database (avoid FK constraint violation)
      // If node doesn't exist, try to find an existing node with matching title before creating
      if (finalNodeId) {
        const nodeExists = await this.sessionMappingRepository.nodeExists(finalNodeId);
        if (!nodeExists) {
          this.logger.info('Node ID does not exist in database, searching for existing node by title', {
            providedNodeId: finalNodeId,
            userId,
            sessionId: sessionData.sessionId,
            workflowName: sessionData.workflowName,
          });

          // First try to find an existing node with the same title (to avoid duplicates)
          const trackName = sessionData.workflowName || 'Untitled Track';
          const existingNode = await this.sessionMappingRepository.findNodeByTitle(userId, trackName);

          if (existingNode) {
            this.logger.info('Found existing node with matching title, using it instead of creating new', {
              existingNodeId: existingNode.id,
              trackName,
              userId,
              sessionId: sessionData.sessionId,
            });
            finalNodeId = existingNode.id;
            nodeValidationStatus = 'valid';
          } else {
            // No existing node found, auto-create a new track (project node) so the session appears in web app
            try {
              const newTrackNode = await this.hierarchyService.createNode(
                {
                  type: 'project',
                  parentId: null, // Top-level track
                  meta: {
                    title: trackName,
                    name: trackName,
                    description: `Auto-created track from desktop session: ${trackName}`,
                    isWorkTrack: true,
                    createdFromDesktop: true,
                  },
                } as CreateNodeDTO,
                userId
              );

              this.logger.info('Auto-created track for session', {
                newTrackId: newTrackNode.id,
                trackName,
                userId,
                sessionId: sessionData.sessionId,
              });

              // Use the newly created track ID
              finalNodeId = newTrackNode.id;
              nodeValidationStatus = 'auto_created';

              // Complete onboarding when first track is created from desktop app
              // This ensures user sees the main app instead of the download page
              try {
                await this.userService.completeOnboarding(userId);
                this.logger.info('Completed onboarding for user after auto-creating track', { userId });
              } catch (onboardingError) {
                // Non-fatal: user may already have completed onboarding
                this.logger.warn('Failed to complete onboarding (may already be complete)', {
                  userId,
                  error: onboardingError instanceof Error ? onboardingError.message : String(onboardingError),
                });
              }
            } catch (createError) {
              // If track creation fails, save session without node association
              this.logger.warn('Failed to auto-create track, saving session without node association', {
                providedNodeId: finalNodeId,
                userId,
                sessionId: sessionData.sessionId,
                error: createError instanceof Error ? createError.message : String(createError),
              });
              nodeValidationStatus = 'not_found';
              finalNodeId = undefined;
            }
          }
        }
      } else if (sessionData.workflowName && sessionData.workflowName !== 'Untitled Session') {
        // No nodeId provided but we have a workflow name
        // First try to find an existing node with matching title to avoid duplicates
        const trackName = sessionData.workflowName;
        const existingNode = await this.sessionMappingRepository.findNodeByTitle(userId, trackName);

        if (existingNode) {
          this.logger.info('Found existing node with matching workflow name, using it', {
            existingNodeId: existingNode.id,
            trackName,
            userId,
            sessionId: sessionData.sessionId,
          });
          finalNodeId = existingNode.id;
          nodeValidationStatus = 'valid';
        } else {
          // No existing node found, create a new track
          this.logger.info('No existing node found for workflow name, auto-creating track', {
            userId,
            sessionId: sessionData.sessionId,
            workflowName: sessionData.workflowName,
          });

          try {
            const newTrackNode = await this.hierarchyService.createNode(
              {
                type: 'project',
                parentId: null,
                meta: {
                  title: trackName,
                  name: trackName,
                  description: `Auto-created track from desktop session: ${trackName}`,
                  isWorkTrack: true,
                  createdFromDesktop: true,
                },
              } as CreateNodeDTO,
              userId
            );

            this.logger.info('Auto-created track from workflow name', {
              newTrackId: newTrackNode.id,
              trackName,
              userId,
              sessionId: sessionData.sessionId,
            });

            finalNodeId = newTrackNode.id;
            nodeValidationStatus = 'auto_created';

            // Complete onboarding when first track is created from desktop app
            // This ensures user sees the main app instead of the download page
            try {
              await this.userService.completeOnboarding(userId);
              this.logger.info('Completed onboarding for user after auto-creating track', { userId });
            } catch (onboardingError) {
              // Non-fatal: user may already have completed onboarding
              this.logger.warn('Failed to complete onboarding (may already be complete)', {
                userId,
                error: onboardingError instanceof Error ? onboardingError.message : String(onboardingError),
              });
            }
          } catch (createError) {
            this.logger.warn('Failed to auto-create track from workflow name', {
              userId,
              sessionId: sessionData.sessionId,
              workflowName: sessionData.workflowName,
              error: createError instanceof Error ? createError.message : String(createError),
            });
            // Continue without node association
          }
        }
      }

      // Default category for sessions without classification
      const defaultCategory = WorkTrackCategory.CoreWork;
      const defaultNodeType = WORK_TRACK_CATEGORY_TO_NODE_TYPE[defaultCategory];

      // Detect schema version (V1: chapters, V2: workflows)
      const schemaVersion = sessionData.summary?.schema_version === 2 ||
                            sessionData.summary?.workflows
                            ? 2 : 1;
      this.logger.info('Detected schema version', {
        schemaVersion,
        sessionId: sessionData.sessionId,
        hasWorkflows: !!sessionData.summary?.workflows,
        hasChapters: !!sessionData.summary?.chapters,
      });

      // Generate embedding for future similarity searches
      // V2: Use workflow_summary (preferred) or workflow intents; V1: Use highLevelSummary
      let embedding: number[] = [];
      let embeddingText: string | null = null;

      if (schemaVersion === 2 && sessionData.summary?.workflows?.length > 0) {
        // V2: Prefer workflow_summary, fallback to level_1_intent
        embeddingText = sessionData.summary.workflows
          .map(w => w.workflow_summary || w.classification?.level_1_intent || '')
          .filter(Boolean)
          .join('. ');
      } else if (sessionData.summary?.highLevelSummary) {
        embeddingText = sessionData.summary.highLevelSummary;
      }

      if (embeddingText) {
        try {
          const embeddingResult = await this.embeddingService.generateEmbedding(embeddingText);
          embedding = Array.from(embeddingResult);
        } catch (error) {
          this.logger.warn('Failed to generate embedding, continuing without it', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Extract session title from summary
      // V2: workflows[0].classification.level_1_intent
      // V1: chapters[0].title
      let generatedTitle: string | null = null;

      if (schemaVersion === 2 && sessionData.summary?.workflows?.[0]?.classification?.level_1_intent) {
        // V2: Use first workflow's intent as title
        generatedTitle = sessionData.summary.workflows[0].classification.level_1_intent;
        this.logger.info('Using workflow intent as session title (V2)', {
          generatedTitle,
          sessionId: sessionData.sessionId,
        });
      } else if (sessionData.summary?.chapters?.[0]?.title) {
        // V1: Use first chapter's title
        generatedTitle = sessionData.summary.chapters[0].title;
        this.logger.info('Using chapter title as session title (V1)', {
          generatedTitle,
          sessionId: sessionData.sessionId,
        });
      }

      // If no chapter title, try to generate one from highLevelSummary
      const isUntitled = !sessionData.workflowName ||
                         sessionData.workflowName === 'Untitled Session' ||
                         sessionData.workflowName.toLowerCase().includes('untitled');

      if (!generatedTitle && isUntitled && sessionData.summary?.highLevelSummary) {
        try {
          generatedTitle = await this.sessionClassifierService.generateSessionTitle(
            sessionData.summary.highLevelSummary
          );
        } catch (error) {
          this.logger.warn('Failed to generate session title, continuing without it', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Create session mapping record
      // For V2, generate highLevelSummary if not provided
      let highLevelSummary = sessionData.summary?.highLevelSummary;
      if (!highLevelSummary && schemaVersion === 2 && sessionData.summary?.workflows?.length > 0) {
        // Generate summary from workflow intents
        highLevelSummary = sessionData.summary.workflows
          .map(w => w.classification?.level_1_intent || '')
          .filter(Boolean)
          .join('. ');
      }

      this.logger.info('Creating session mapping record', {
        userId,
        desktopSessionId: sessionData.sessionId,
        finalNodeId,
        schemaVersion,
        hasEmbedding: embedding.length > 0,
        hasHighLevelSummary: !!highLevelSummary,
        hasSummary: !!sessionData.summary,
        summaryKeys: sessionData.summary ? Object.keys(sessionData.summary) : [],
        hasWorkflows: !!sessionData.summary?.workflows,
        workflowsCount: sessionData.summary?.workflows?.length,
        hasChapters: !!sessionData.summary?.chapters,
        chaptersCount: sessionData.summary?.chapters?.length,
      });

      // Debug: Log summary before passing to repository
      const summaryToStore = sessionData.summary || undefined;
      this.logger.debug('DEBUG: Summary data before repository create', {
        hasSummaryToStore: !!summaryToStore,
        summaryToStoreType: typeof summaryToStore,
        summaryToStoreKeys: summaryToStore ? Object.keys(summaryToStore) : [],
        summaryToStoreSchemaVersion: (summaryToStore as any)?.schema_version,
        summaryToStoreWorkflowsCount: (summaryToStore as any)?.workflows?.length,
        summaryToStoreChaptersCount: (summaryToStore as any)?.chapters?.length,
        summaryToStoreJSON: summaryToStore ? JSON.stringify(summaryToStore).substring(0, 500) : 'null',
      });

      const sessionMapping = await this.sessionMappingRepository.create({
        userId,
        desktopSessionId: sessionData.sessionId,
        category: defaultCategory,
        categoryConfidence: 1.0,
        nodeId: finalNodeId,
        nodeMatchConfidence: 1.0,
        mappingAction: finalNodeId ? SessionMappingAction.UserSelected : SessionMappingAction.CreatedNew,
        workflowName: sessionData.workflowName,
        startedAt: new Date(sessionData.startTime),
        endedAt: new Date(sessionData.endTime),
        durationSeconds,
        summaryEmbedding: embedding,
        highLevelSummary: highLevelSummary || undefined,
        generatedTitle,
        userNotes: sessionData.userNotes || null,
        // Store full summary including chapters (V1) or workflows (V2) with semantic_steps
        summary: summaryToStore,
      });

      this.logger.info('Session push complete', {
        userId,
        sessionMappingId: sessionMapping.id,
        nodeId: finalNodeId,
        summaryStored: !!(sessionMapping as any).summary,
      });

      // Build journey URL for web viewing
      const journeyUrl = finalNodeId
        ? `/timeline/node/${finalNodeId}`
        : undefined;

      // Build response message based on what happened
      let message = 'Session pushed successfully';
      let signals: string[] = ['direct_push'];

      if (nodeValidationStatus === 'auto_created') {
        message = `Session pushed successfully. A new track "${sessionData.workflowName || 'Untitled Track'}" was created.`;
        signals = ['direct_push', 'track_auto_created'];
      } else if (nodeValidationStatus === 'not_found') {
        message = 'Session saved, but the selected track no longer exists. Please refresh your tracks.';
        signals = ['direct_push', 'node_not_found'];
      }

      return {
        success: true,
        sessionMappingId: sessionMapping.id,
        classification: {
          category: defaultCategory,
          confidence: 1.0,
          nodeType: defaultNodeType,
          signals,
        },
        nodeMapping: {
          action: nodeValidationStatus === 'auto_created'
            ? SessionMappingAction.CreatedNew
            : (finalNodeId ? SessionMappingAction.UserSelected : SessionMappingAction.CreatedNew),
          nodeId: finalNodeId || '',
          confidence: 1.0,
        },
        journeyUrl,
        message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Session push failed: ${errorMessage}`, {
        userId,
        sessionId: sessionData.sessionId,
        journeyNodeId: sessionData.journeyNodeId,
      });
      throw error;
    }
  }

  /**
   * Build user-friendly success message
   */
  private buildSuccessMessage(
    classification: PushSessionResponse['classification'],
    nodeMatch: PushSessionResponse['nodeMapping']
  ): string {
    const categoryLabel = WORK_TRACK_CATEGORY_LABELS[classification.category];

    if (nodeMatch.action === SessionMappingAction.UserSelected) {
      return `Session saved to your selected node`;
    }

    if (nodeMatch.action === SessionMappingAction.CreatedNew) {
      return `Session classified as "${categoryLabel}" and a new node was created`;
    }

    const confidence = Math.round(nodeMatch.confidence * 100);
    return `Session classified as "${categoryLabel}" and matched to existing node (${confidence}% confidence)`;
  }

  // --------------------------------------------------------------------------
  // RECLASSIFY / REMAP
  // --------------------------------------------------------------------------

  /**
   * Reclassify a session into a different category
   */
  async reclassifySession(
    sessionMappingId: string,
    request: ReclassifySessionRequest,
    userId: number
  ): Promise<SessionUpdateResponse> {
    // Verify ownership
    const belongs = await this.sessionMappingRepository.belongsToUser(
      sessionMappingId,
      userId
    );
    if (!belongs) {
      throw new Error('Session not found or access denied');
    }

    // Get current mapping
    const current = await this.sessionMappingRepository.getById(sessionMappingId);
    if (!current) {
      throw new Error('Session mapping not found');
    }

    // Update the mapping
    await this.sessionMappingRepository.update(sessionMappingId, {
      category: request.newCategory,
      categoryConfidence: 1.0, // User-corrected, so 100% confidence
    });

    // Log feedback for RLHF
    const feedback = await this.sessionMappingRepository.createFeedback({
      userId,
      sessionMappingId,
      originalCategory: current.category as WorkTrackCategory,
      correctedCategory: request.newCategory,
      originalNodeId: current.nodeId || undefined,
      feedbackType: SessionFeedbackType.CategoryChanged,
      userReason: request.reason,
    });

    this.logger.info('Session reclassified', {
      sessionMappingId,
      originalCategory: current.category,
      newCategory: request.newCategory,
      feedbackId: feedback.id,
    });

    return {
      success: true,
      sessionMappingId,
      feedbackId: feedback.id,
      message: `Session reclassified to "${WORK_TRACK_CATEGORY_LABELS[request.newCategory]}"`,
    };
  }

  /**
   * Remap a session to a different node
   */
  async remapSession(
    sessionMappingId: string,
    request: RemapSessionRequest,
    userId: number
  ): Promise<SessionUpdateResponse> {
    // Verify ownership
    const belongs = await this.sessionMappingRepository.belongsToUser(
      sessionMappingId,
      userId
    );
    if (!belongs) {
      throw new Error('Session not found or access denied');
    }

    // Get current mapping
    const current = await this.sessionMappingRepository.getById(sessionMappingId);
    if (!current) {
      throw new Error('Session mapping not found');
    }

    // Update the mapping
    await this.sessionMappingRepository.update(sessionMappingId, {
      nodeId: request.newNodeId,
      nodeMatchConfidence: 1.0, // User-selected, so 100% confidence
      mappingAction: SessionMappingAction.UserSelected,
    });

    // Log feedback for RLHF
    const feedback = await this.sessionMappingRepository.createFeedback({
      userId,
      sessionMappingId,
      originalCategory: current.category as WorkTrackCategory,
      originalNodeId: current.nodeId || undefined,
      correctedNodeId: request.newNodeId,
      feedbackType: SessionFeedbackType.NodeChanged,
      userReason: request.reason,
    });

    this.logger.info('Session remapped', {
      sessionMappingId,
      originalNodeId: current.nodeId,
      newNodeId: request.newNodeId,
      feedbackId: feedback.id,
    });

    return {
      success: true,
      sessionMappingId,
      feedbackId: feedback.id,
      message: 'Session remapped to new node',
    };
  }

  // --------------------------------------------------------------------------
  // LIST / GET SESSIONS
  // --------------------------------------------------------------------------

  /**
   * List sessions with filtering and pagination
   */
  async listSessions(
    query: ListSessionsQuery,
    userId: number
  ): Promise<ListSessionsResponse> {
    const { sessions, total } =
      await this.sessionMappingRepository.listWithNodeInfo(
        {
          userId,
          category: query.category,
          nodeId: query.nodeId,
          startDate: query.startDate ? new Date(query.startDate) : undefined,
          endDate: query.endDate ? new Date(query.endDate) : undefined,
        },
        { page: query.page, limit: query.limit }
      );

    const items: SessionMappingItem[] = sessions.map((s) =>
      this.mapToSessionItem(s)
    );

    return {
      success: true,
      data: {
        sessions: items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          hasNext: query.page * query.limit < total,
          hasPrev: query.page > 1,
        },
      },
    };
  }

  /**
   * Get sessions for a specific node
   */
  async getNodeSessions(
    nodeId: string,
    query: NodeSessionsQuery,
    userId: number
  ): Promise<NodeSessionsResponse> {
    this.logger.info('Getting sessions for node', {
      nodeId,
      userId,
      page: query.page,
      limit: query.limit,
    });

    const { sessions, total, totalDurationSeconds, nodeMeta } =
      await this.sessionMappingRepository.getByNodeIdWithMeta(nodeId, {
        page: query.page,
        limit: query.limit,
      });

    this.logger.info('Found sessions for node', {
      nodeId,
      total,
      sessionCount: sessions.length,
      totalDurationSeconds,
      hasChapters: !!nodeMeta?.chapters,
    });

    // Map sessions and include chapters from node metadata if available
    const items: SessionMappingItem[] = sessions.map((s) =>
      this.mapToSessionItem(s, nodeMeta?.chapters)
    );

    return {
      success: true,
      data: {
        nodeId,
        sessions: items,
        totalDurationSeconds,
        sessionCount: total,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          hasNext: query.page * query.limit < total,
          hasPrev: query.page > 1,
        },
      },
    };
  }

  /**
   * Map database record to API response item
   */
  private mapToSessionItem(
    s: SessionMapping & { nodeTitle?: string; nodeType?: string },
    chapters?: any[]
  ): SessionMappingItem {
    return {
      id: s.id,
      desktopSessionId: s.desktopSessionId,
      category: s.category as WorkTrackCategory,
      categoryConfidence: s.categoryConfidence,
      nodeId: s.nodeId,
      nodeTitle: s.nodeTitle,
      nodeType: s.nodeType as TimelineNodeType | undefined,
      workflowName: s.workflowName,
      highLevelSummary: s.highLevelSummary,
      generatedTitle: (s as any).generatedTitle ?? null,
      startedAt: s.startedAt?.toISOString() || null,
      endedAt: s.endedAt?.toISOString() || null,
      durationSeconds: s.durationSeconds,
      mappingAction: s.mappingAction as SessionMappingAction | null,
      createdAt: s.createdAt.toISOString(),
      chapters: chapters || undefined,
    };
  }

  // --------------------------------------------------------------------------
  // CATEGORIES
  // --------------------------------------------------------------------------

  /**
   * Get all category definitions for UI
   */
  getCategories(): CategoriesResponse {
    const categories: CategoryDefinition[] = Object.values(WorkTrackCategory).map(
      (value) => ({
        value,
        label: WORK_TRACK_CATEGORY_LABELS[value],
        nodeType: WORK_TRACK_CATEGORY_TO_NODE_TYPE[value],
        group: this.getCategoryGroup(value),
      })
    );

    const groups = Object.entries(WORK_TRACK_CATEGORY_GROUPS).map(
      ([key, group]) => ({
        key,
        label: group.label,
        categories: group.categories,
      })
    );

    return {
      success: true,
      data: {
        categories,
        groups,
      },
    };
  }

  /**
   * Get the group key for a category
   */
  private getCategoryGroup(category: WorkTrackCategory): string {
    for (const [key, group] of Object.entries(WORK_TRACK_CATEGORY_GROUPS)) {
      if (group.categories.includes(category)) {
        return key;
      }
    }
    return 'other';
  }

  // --------------------------------------------------------------------------
  // FEEDBACK
  // --------------------------------------------------------------------------

  /**
   * Submit explicit feedback (for analytics/RLHF)
   */
  async submitFeedback(
    request: SubmitFeedbackRequest,
    userId: number
  ): Promise<SubmitFeedbackResponse> {
    // Verify ownership
    const belongs = await this.sessionMappingRepository.belongsToUser(
      request.sessionMappingId,
      userId
    );
    if (!belongs) {
      throw new Error('Session not found or access denied');
    }

    const feedback = await this.sessionMappingRepository.createFeedback({
      userId,
      sessionMappingId: request.sessionMappingId,
      originalCategory: request.originalCategory,
      originalNodeId: request.originalNodeId,
      correctedCategory: request.correctedCategory,
      correctedNodeId: request.correctedNodeId,
      feedbackType: request.feedbackType,
      userRole: request.userRole,
      userReason: request.reason,
    });

    this.logger.info('Feedback submitted', {
      feedbackId: feedback.id,
      sessionMappingId: request.sessionMappingId,
      feedbackType: request.feedbackType,
    });

    return {
      success: true,
      feedbackId: feedback.id,
      message: 'Thank you for your feedback!',
    };
  }
}


