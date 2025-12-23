/**
 * SessionClassifierService
 * AI-powered service for classifying desktop sessions into goal-oriented Work Tracks.
 * (LIG-247: Desktop Session to Work Track Mapping - Track-First Architecture)
 *
 * The service now operates on a "Track-First" architecture:
 * 1. Primary: Match sessions to dynamic, long-running Work Tracks (e.g., "Desktop MVP Release")
 * 2. Secondary: Classify activity type using 27 categories (for analytics/metadata)
 *
 * Key Insight: Classification uses the already-generated summary from the desktop app,
 * NOT raw screenshots. By the time the user clicks "Push Session", the desktop app
 * has already analyzed screenshots and generated a comprehensive summary.
 */

import {
  ACTIVITY_CATEGORY_TO_ARCHETYPE,
  ARCHETYPE_TO_DEFAULT_TEMPLATE,
  CATEGORY_CLASSIFICATION_SIGNALS,
  ClassificationResult,
  JourneyInfo,
  NodeInfo,
  NodeMappingResult,
  PushSessionRequest,
  SessionMappingAction,
  TimelineNodeType,
  TRACK_TEMPLATE_TYPE_LABELS,
  TrackMatchingResult,
  TrackTemplateType,
  WORK_TRACK_ARCHETYPE_LABELS,
  WORK_TRACK_CATEGORY_LABELS,
  WORK_TRACK_CATEGORY_TO_NODE_TYPE,
  WorkTrackArchetype,
  WorkTrackCategory,
  WorkTrackInfo,
  WorkTrackMappingAction,
  WorkTrackMappingResult,
} from '@journey/schema';
import { z } from 'zod';

import type { LLMProvider } from '../core/llm-provider.js';
import type { Logger } from '../core/logger.js';
import type { IHierarchyRepository } from '../repositories/interfaces/hierarchy.repository.interface.js';
import type { SessionMappingRepository } from '../repositories/session-mapping.repository.js';
import type { EmbeddingService } from './interfaces/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ClassifyAndMatchResult {
  classification: ClassificationResult;
  nodeMatch: NodeMappingResult;
  trackMatch?: WorkTrackMappingResult;
}

interface UserLearningContext {
  categoryAdjustments: Partial<
    Record<WorkTrackCategory, { boost: number; reason: string }>
  >;
  appPatterns: Record<string, WorkTrackCategory>;
  trackPreferences: Partial<
    Record<string, { boost: number; reason: string }>
  >;
}

/**
 * Active work track context for LLM matching
 * Now includes journey (role) context for hierarchical classification
 */
interface ActiveWorkTrackContext {
  // Available journeys (roles) the user has
  journeys: JourneyInfo[];
  journeyDescriptions: string;
  
  // Work tracks nested under journeys
  tracks: WorkTrackInfo[];
  trackDescriptions: string;
  
  // Mapping of journey ID to its child work tracks
  journeyToTracks: Map<string, WorkTrackInfo[]>;
}

// ============================================================================
// SERVICE
// ============================================================================

export class SessionClassifierService {
  private readonly llmProvider: LLMProvider;
  private readonly embeddingService: EmbeddingService;
  private readonly hierarchyRepository: IHierarchyRepository;
  private readonly sessionMappingRepository: SessionMappingRepository;
  private readonly logger: Logger;

  // Confidence thresholds
  private readonly NODE_MATCH_THRESHOLD = 0.65;
  private readonly TRACK_MATCH_THRESHOLD = 0.6;
  private readonly CATEGORY_CONFIDENCE_THRESHOLD = 0.7;
  
  // Maximum active tracks to include in LLM context
  private readonly MAX_ACTIVE_TRACKS_FOR_CONTEXT = 10;

  constructor({
    llmProvider,
    openAIEmbeddingService,
    hierarchyRepository,
    sessionMappingRepository,
    logger,
  }: {
    llmProvider: LLMProvider;
    openAIEmbeddingService: EmbeddingService;
    hierarchyRepository: IHierarchyRepository;
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
   * Main entry point: Classify session and match to Work Track (Track-First Architecture)
   * Uses pre-processed summary data from desktop app (NOT raw screenshots)
   * 
   * Flow:
   * 1. Get user's active Work Tracks for context
   * 2. Use LLM to match session to existing track or suggest new track
   * 3. Classify activity type (secondary, for analytics)
   * 4. Match to timeline node (legacy, for backward compatibility)
   */
  async classifyAndMatch(
    sessionData: PushSessionRequest,
    userId: number
  ): Promise<ClassifyAndMatchResult> {
    this.logger.info('Starting session classification and track matching', {
      userId,
      sessionId: sessionData.sessionId,
      workflowName: sessionData.workflowName,
      hasUserSelectedNode: !!sessionData.journeyNodeId,
    });

    // If user pre-selected a node (current manual flow), skip classification
    if (sessionData.journeyNodeId) {
      return this.handleUserSelectedNode(sessionData, userId);
    }

    // Get user's active work tracks for LLM context
    const activeTracksContext = await this.getActiveWorkTracksContext(userId);

    // Stage 1: Match to Work Track (primary grouping)
    const trackMatch = await this.matchToWorkTrack(
      sessionData,
      activeTracksContext,
      userId
    );

    // Stage 2: Build classification result (includes both track and activity info)
    const classification = this.buildClassificationFromTrackMatch(trackMatch);

    // Stage 3: Match to timeline node (legacy, for backward compatibility)
    const nodeMatch = await this.matchToNode(
      classification,
      sessionData,
      userId
    );

    this.logger.info('Session classification and track matching complete', {
      userId,
      sessionId: sessionData.sessionId,
      category: classification.category,
      trackArchetype: classification.trackArchetype,
      trackAction: trackMatch.action,
      trackId: trackMatch.trackId,
      nodeAction: nodeMatch.action,
      nodeId: nodeMatch.nodeId,
    });

    return { classification, nodeMatch, trackMatch };
  }

  /**
   * Handle case where user pre-selected a node
   * 
   * KEY INSIGHT: If user selects a "journey" node (Job, Education, CareerTransition),
   * we should still create/match a work track UNDER that journey.
   * Only if user selects an actual work track (Project) do we use it directly.
   */
  private async handleUserSelectedNode(
    sessionData: PushSessionRequest,
    userId: number
  ): Promise<ClassifyAndMatchResult> {
    const nodeId = sessionData.journeyNodeId!;

    // Get node info
    const node = await this.hierarchyRepository.getById(nodeId, userId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const nodeType = node.type as TimelineNodeType;
    const isJourneyNode = [
      TimelineNodeType.Job,
      TimelineNodeType.Education,
      TimelineNodeType.CareerTransition,
    ].includes(nodeType);

    // If user selected a JOURNEY (role), we still need to create/match a work track under it
    if (isJourneyNode) {
      this.logger.info('User selected journey node, creating/matching work track under it', {
        journeyNodeId: nodeId,
        journeyType: nodeType,
        journeyTitle: (node.meta as any)?.role || (node.meta as any)?.title,
      });

      // Get active work tracks context (for matching to existing tracks under this journey)
      const activeTracksContext = await this.getActiveWorkTracksContext(userId);
      
      // Filter context to focus on this specific journey
      const journeyTracks = activeTracksContext.tracks.filter(
        (t) => t.parentJourneyId === nodeId
      );
      const contextWithJourney: ActiveWorkTrackContext = {
        ...activeTracksContext,
        tracks: journeyTracks,
        trackDescriptions: this.buildTrackDescriptions(journeyTracks),
      };

      // Perform work track matching under the selected journey
      const trackMatch = await this.matchToWorkTrackUnderJourney(
        sessionData,
        contextWithJourney,
        nodeId,
        node,
        userId
      );

      // Build classification from track match
      const classification = this.buildClassificationFromTrackMatch(trackMatch);

      return {
        classification,
        nodeMatch: {
          action: SessionMappingAction.UserSelected,
          nodeId: trackMatch.trackId || nodeId, // Use the work track if created
          node: {
            id: trackMatch.trackId || nodeId,
            type: trackMatch.track ? TimelineNodeType.Project : nodeType,
            title: trackMatch.track?.title || (node.meta as any)?.title || 'Unknown',
            meta: trackMatch.track ? { title: trackMatch.track.title } : (node.meta as Record<string, any>),
          },
          confidence: trackMatch.confidence,
        },
        trackMatch,
      };
    }

    // If user selected an actual WORK TRACK (Project), use it directly
    const category = this.inferCategoryFromNodeType(nodeType);
    const archetype = ACTIVITY_CATEGORY_TO_ARCHETYPE[category];

    return {
      classification: {
        category,
        confidence: 1.0, // User selected, so 100% confidence
        nodeType,
        signals: ['user_selected'],
        trackArchetype: archetype,
        narrativeContribution: `Working on ${(node.meta as any)?.title || 'selected item'}`,
      },
      nodeMatch: {
        action: SessionMappingAction.UserSelected,
        nodeId,
        node: {
          id: node.id,
          type: nodeType,
          title: (node.meta as any)?.title || 'Unknown',
          meta: node.meta as Record<string, any>,
        },
        confidence: 1.0,
      },
    };
  }

  /**
   * Match/create a work track under a specific journey that user selected
   */
  private async matchToWorkTrackUnderJourney(
    sessionData: PushSessionRequest,
    context: ActiveWorkTrackContext,
    journeyId: string,
    journeyNode: any,
    userId: number
  ): Promise<WorkTrackMappingResult> {
    // Build classification context
    const classificationText = this.buildClassificationTextWithTracks(sessionData, context);

    try {
      // Use LLM to determine work track
      const trackMatchResult = await this.matchToWorkTrackWithLLM(
        classificationText,
        context,
        sessionData.appsUsed || []
      );

      const journeyInfo: JourneyInfo = {
        id: journeyId,
        title: this.buildJourneyTitle(journeyNode),
        type: journeyNode.type as TimelineNodeType,
        description: (journeyNode.meta as any)?.description,
      };

      // Check if matched to an existing track under this journey
      if (trackMatchResult.targetTrackId) {
        const matchedTrack = context.tracks.find((t) => t.id === trackMatchResult.targetTrackId);
        if (matchedTrack) {
          return {
            action: WorkTrackMappingAction.MatchedExisting,
            journeyId,
            journey: journeyInfo,
            trackId: matchedTrack.id,
            track: matchedTrack,
            templateType: trackMatchResult.recommendedTemplate,
            confidence: trackMatchResult.confidence,
            narrativeContribution: trackMatchResult.narrativeContribution,
          };
        }
      }

      // Create new work track under this journey
      if (trackMatchResult.suggestedNewTrackTitle) {
        const newTrack = await this.createNewWorkTrack(
          trackMatchResult.suggestedNewTrackTitle,
          trackMatchResult.trackArchetype,
          trackMatchResult.recommendedTemplate,
          journeyId, // Parent journey ID
          sessionData,
          userId
        );

        this.logger.info('Created new work track under user-selected journey', {
          journeyId,
          trackId: newTrack.id,
          trackTitle: newTrack.title,
          template: trackMatchResult.recommendedTemplate,
        });

        return {
          action: WorkTrackMappingAction.CreatedNew,
          journeyId,
          journey: journeyInfo,
          trackId: newTrack.id,
          track: newTrack,
          templateType: trackMatchResult.recommendedTemplate,
          confidence: trackMatchResult.confidence,
          narrativeContribution: trackMatchResult.narrativeContribution,
        };
      }

      // Fallback: Create a generic work track based on session content
      const defaultTitle = this.generateWorkTrackTitle(sessionData);
      const defaultArchetype = this.inferArchetypeFromSessionContent(sessionData);
      const defaultTemplate = ARCHETYPE_TO_DEFAULT_TEMPLATE[defaultArchetype];

      const fallbackTrack = await this.createNewWorkTrack(
        defaultTitle,
        defaultArchetype,
        defaultTemplate,
        journeyId,
        sessionData,
        userId
      );

      return {
        action: WorkTrackMappingAction.CreatedNew,
        journeyId,
        journey: journeyInfo,
        trackId: fallbackTrack.id,
        track: fallbackTrack,
        templateType: defaultTemplate,
        confidence: 0.5,
        narrativeContribution: `Working on ${defaultTitle}`,
      };
    } catch (err) {
      this.logger.error(
        'Work track matching under journey failed',
        err instanceof Error ? err : new Error(String(err))
      );

      // Ultimate fallback: create generic track
      const journeyInfo: JourneyInfo = {
        id: journeyId,
        title: this.buildJourneyTitle(journeyNode),
        type: journeyNode.type as TimelineNodeType,
      };

      const fallbackTitle = this.generateWorkTrackTitle(sessionData);
      const fallbackTrack = await this.createNewWorkTrack(
        fallbackTitle,
        WorkTrackArchetype.BuildProduct,
        TrackTemplateType.WorkflowApproach,
        journeyId,
        sessionData,
        userId
      );

      return {
        action: WorkTrackMappingAction.CreatedNew,
        journeyId,
        journey: journeyInfo,
        trackId: fallbackTrack.id,
        track: fallbackTrack,
        templateType: TrackTemplateType.WorkflowApproach,
        confidence: 0.3,
        narrativeContribution: `Working on ${fallbackTitle}`,
      };
    }
  }

  /**
   * Generate a work track title from session data
   */
  private generateWorkTrackTitle(sessionData: PushSessionRequest): string {
    // Try to extract a meaningful title from the session
    const workflowName = sessionData.workflowName;
    const summary = sessionData.summary?.highLevelSummary || '';
    const appsUsed = sessionData.appsUsed || [];

    // If workflow name is descriptive, use it
    if (workflowName && !this.isGenericRoleTrack(workflowName)) {
      return workflowName;
    }

    // Try to extract key topic from summary
    const keyPhrases = summary.match(/(?:working on|building|developing|creating|researching|analyzing|writing|designing)\s+(?:a\s+)?([^.,]+)/i);
    if (keyPhrases && keyPhrases[1]) {
      return keyPhrases[1].trim().slice(0, 50);
    }

    // Use primary app as hint
    if (appsUsed.length > 0) {
      const primaryApp = appsUsed[0];
      if (primaryApp.toLowerCase().includes('cursor') || primaryApp.toLowerCase().includes('vscode')) {
        return 'Development Work';
      }
      if (primaryApp.toLowerCase().includes('figma')) {
        return 'Design Work';
      }
      if (primaryApp.toLowerCase().includes('chrome') || primaryApp.toLowerCase().includes('safari')) {
        return 'Research & Analysis';
      }
    }

    return 'General Work';
  }

  /**
   * Infer archetype from session content
   */
  private inferArchetypeFromSessionContent(sessionData: PushSessionRequest): WorkTrackArchetype {
    const combined = `${sessionData.workflowName || ''} ${sessionData.summary?.highLevelSummary || ''}`.toLowerCase();
    const appsUsed = (sessionData.appsUsed || []).map((a) => a.toLowerCase()).join(' ');

    if (combined.match(/fundrais|invest|pitch|investor|deck/)) {
      return WorkTrackArchetype.SalesFundraising;
    }
    if (combined.match(/market|growth|content|seo|campaign|social|ads/)) {
      return WorkTrackArchetype.GrowthMarketing;
    }
    if (combined.match(/hire|recruit|team|onboard|interview/)) {
      return WorkTrackArchetype.OperationsHiring;
    }
    if (combined.match(/learn|course|study|tutorial|document/)) {
      return WorkTrackArchetype.LearningDevelopment;
    }
    if (appsUsed.match(/cursor|vscode|terminal|github|xcode|android/)) {
      return WorkTrackArchetype.BuildProduct;
    }

    return WorkTrackArchetype.BuildProduct;
  }

  // ============================================================================
  // WORK TRACK MATCHING (Track-First Architecture)
  // ============================================================================

  /**
   * Get user's Journeys (roles) and their child Work Tracks for LLM context
   * 
   * Hierarchy:
   * - Journeys (Job, Education, CareerTransition nodes) = Roles/Contexts
   * - Work Tracks (Project nodes with parentId pointing to a journey) = Initiatives
   */
  private async getActiveWorkTracksContext(
    userId: number
  ): Promise<ActiveWorkTrackContext> {
    try {
      // Step 1: Get all journey-level nodes (Job, Education, CareerTransition)
      // These are the "roles" like "Founder", "Research Assistant at X", "Masters at Y"
      const journeyTypes = [
        TimelineNodeType.Job,
        TimelineNodeType.Education,
        TimelineNodeType.CareerTransition,
      ];
      
      const allJourneys: JourneyInfo[] = [];
      for (const nodeType of journeyTypes) {
        const nodes = await this.hierarchyRepository.getNodesByType(userId, nodeType);
        for (const node of nodes) {
          // Only include current/active journeys (no end date or end date in future)
          const meta = node.meta as any;
          const endDate = meta?.endDate;
          const isActive = !endDate || new Date(endDate) >= new Date();
          
          if (isActive) {
            allJourneys.push({
              id: node.id,
              title: this.buildJourneyTitle(node),
              type: node.type as TimelineNodeType,
              description: meta?.description,
            });
          }
        }
      }

      // Step 2: Get all work tracks (Project nodes that are children of journeys)
      const projectNodes = await this.hierarchyRepository.getNodesByType(
        userId,
        TimelineNodeType.Project
      );

      // Build journey-to-tracks mapping
      const journeyToTracks = new Map<string, WorkTrackInfo[]>();
      const allTracks: WorkTrackInfo[] = [];

      for (const node of projectNodes) {
        const meta = node.meta as any;
        const track: WorkTrackInfo = {
          id: node.id,
          title: meta?.title || 'Untitled Track',
          description: meta?.description,
          archetype: this.inferArchetypeFromNode(node),
          templateType: meta?.templateType || this.inferTemplateFromNode(node),
          parentJourneyId: node.parentId || undefined,
          lastActivityAt: node.updatedAt?.toISOString(),
        };

        // Only include specific tracks (not generic role-based ones)
        if (!this.isGenericRoleTrack(track.title)) {
          allTracks.push(track);
          
          // Group by parent journey
          if (node.parentId) {
            const existing = journeyToTracks.get(node.parentId) || [];
            existing.push(track);
            journeyToTracks.set(node.parentId, existing);
          }
        }
      }

      // Build human-readable descriptions for LLM context
      const journeyDescriptions = this.buildJourneyDescriptions(allJourneys, journeyToTracks);
      const trackDescriptions = this.buildTrackDescriptions(allTracks);

      return {
        journeys: allJourneys.slice(0, this.MAX_ACTIVE_TRACKS_FOR_CONTEXT),
        journeyDescriptions,
        tracks: allTracks.slice(0, this.MAX_ACTIVE_TRACKS_FOR_CONTEXT),
        trackDescriptions,
        journeyToTracks,
      };
    } catch (error) {
      this.logger.warn('Failed to get active work tracks context', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        journeys: [],
        journeyDescriptions: 'No journeys found.',
        tracks: [],
        trackDescriptions: 'No work tracks yet.',
        journeyToTracks: new Map(),
      };
    }
  }

  /**
   * Build a human-readable title for a journey node
   */
  private buildJourneyTitle(node: any): string {
    const meta = node.meta as any;
    const nodeType = node.type as TimelineNodeType;

    switch (nodeType) {
      case TimelineNodeType.Job:
        // "Role at Company" or just "Role"
        const role = meta?.role || meta?.title || 'Unknown Role';
        // Try to get company name - might need org lookup
        return role;
      case TimelineNodeType.Education:
        // "Degree at Institution"
        const degree = meta?.degree || 'Studies';
        return degree;
      case TimelineNodeType.CareerTransition:
        return meta?.title || 'Career Transition';
      default:
        return meta?.title || 'Journey';
    }
  }

  /**
   * Build formatted journey descriptions for LLM context
   */
  private buildJourneyDescriptions(
    journeys: JourneyInfo[],
    journeyToTracks: Map<string, WorkTrackInfo[]>
  ): string {
    if (journeys.length === 0) {
      return 'No active journeys/roles found. You may need to create a new journey.';
    }

    const lines: string[] = ['=== YOUR ACTIVE JOURNEYS (Roles/Contexts) ==='];
    
    for (let i = 0; i < journeys.length; i++) {
      const j = journeys[i];
      const tracks = journeyToTracks.get(j.id) || [];
      
      lines.push(`\n${i + 1}. "${j.title}" [${j.type}] (ID: ${j.id})`);
      
      if (tracks.length > 0) {
        lines.push(`   Work Tracks under this journey:`);
        for (const track of tracks.slice(0, 5)) {
          const templateLabel = track.templateType 
            ? TRACK_TEMPLATE_TYPE_LABELS[track.templateType] 
            : 'Default';
          lines.push(`   - "${track.title}" (${WORK_TRACK_ARCHETYPE_LABELS[track.archetype]}, ${templateLabel})`);
        }
        if (tracks.length > 5) {
          lines.push(`   ... and ${tracks.length - 5} more tracks`);
        }
      } else {
        lines.push(`   (No work tracks yet - create one!)`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Build formatted track descriptions for LLM context
   */
  private buildTrackDescriptions(tracks: WorkTrackInfo[]): string {
    if (tracks.length === 0) {
      return 'No specific work tracks yet. Create a NEW specific track for this session.';
    }

    return tracks
      .map((t, i) => {
        const templateLabel = t.templateType 
          ? TRACK_TEMPLATE_TYPE_LABELS[t.templateType] 
          : 'Default';
        return `${i + 1}. "${t.title}" (${WORK_TRACK_ARCHETYPE_LABELS[t.archetype]}, Template: ${templateLabel})`;
      })
      .join('\n');
  }

  /**
   * Check if a track title is a generic role-based name
   */
  private isGenericRoleTrack(title: string): boolean {
    const genericPatterns = /^(founder|ceo|cto|cfo|coo|engineer|developer|manager|designer|director|vp|head of|chief|lead|senior|junior|intern|executive|officer|president|owner|partner|consultant|analyst|specialist|coordinator|work|core work|my job|daily tasks|general work)$/i;
    return genericPatterns.test(title.trim());
  }

  /**
   * Infer template type from node metadata
   */
  private inferTemplateFromNode(node: any): TrackTemplateType {
    const meta = node.meta as any;
    
    // If explicitly set, use that
    if (meta?.templateType) {
      return meta.templateType as TrackTemplateType;
    }
    
    // Otherwise infer from archetype
    const archetype = this.inferArchetypeFromNode(node);
    return ARCHETYPE_TO_DEFAULT_TEMPLATE[archetype];
  }

  /**
   * Infer archetype from existing node data
   */
  private inferArchetypeFromNode(node: any): WorkTrackArchetype {
    const meta = node.meta || {};
    const title = (meta.title || '').toLowerCase();
    const description = (meta.description || '').toLowerCase();
    const combined = `${title} ${description}`;

    // Simple keyword matching for archetype inference
    if (combined.match(/fundrais|invest|pitch|series|seed|vc|angel/)) {
      return WorkTrackArchetype.SalesFundraising;
    }
    if (combined.match(/market|growth|content|seo|campaign|ads|social/)) {
      return WorkTrackArchetype.GrowthMarketing;
    }
    if (combined.match(/hire|hiring|recruit|team|onboard|hr|operation/)) {
      return WorkTrackArchetype.OperationsHiring;
    }
    if (combined.match(/learn|course|certif|study|skill|train/)) {
      return WorkTrackArchetype.LearningDevelopment;
    }
    // Default to build/product
    return WorkTrackArchetype.BuildProduct;
  }

  /**
   * Match session to Work Track using LLM (Chief of Staff prompt)
   * 
   * Three-Level Classification:
   * 1. Identify the Journey (Role/Context) - e.g., "Founder", "Research Assistant"
   * 2. Match/Create a Work Track under that Journey - e.g., "AI Growth Strategy"
   * 3. Assign a Template for visualization - e.g., CASE_STUDY_NARRATIVE
   */
  private async matchToWorkTrack(
    sessionData: PushSessionRequest,
    activeTracksContext: ActiveWorkTrackContext,
    userId: number
  ): Promise<WorkTrackMappingResult> {
    // Build classification context with journey hierarchy
    const classificationText = this.buildClassificationTextWithTracks(
      sessionData,
      activeTracksContext
    );

    // Get user's learned preferences
    const userPreferences = await this.getUserPreferences(userId);

    try {
      // Use LLM to perform three-level classification
      const trackMatchResult = await this.matchToWorkTrackWithLLM(
        classificationText,
        activeTracksContext,
        sessionData.appsUsed || []
      );

      // Apply user preferences
      const adjustedResult = this.applyTrackPreferences(
        trackMatchResult,
        userPreferences,
        activeTracksContext
      );

      // Step 1: Resolve the parent Journey
      const { journeyId, journey } = await this.resolveParentJourney(
        adjustedResult,
        activeTracksContext,
        userId
      );

      // Step 2: Resolve the Work Track (as child of journey)
      if (adjustedResult.targetTrackId) {
        // Matched to existing track
        const matchedTrack = activeTracksContext.tracks.find(
          (t) => t.id === adjustedResult.targetTrackId
        );

        return {
          action: WorkTrackMappingAction.MatchedExisting,
          journeyId,
          journey,
          trackId: adjustedResult.targetTrackId,
          track: matchedTrack,
          templateType: adjustedResult.recommendedTemplate,
          confidence: adjustedResult.confidence,
          narrativeContribution: adjustedResult.narrativeContribution,
          alternativeTracks: activeTracksContext.tracks
            .filter((t) => t.id !== adjustedResult.targetTrackId)
            .slice(0, 3),
          alternativeJourneys: activeTracksContext.journeys
            .filter((j) => j.id !== journeyId)
            .slice(0, 3),
        };
      } else if (adjustedResult.suggestedNewTrackTitle) {
        // Create new track as CHILD of the journey
        const newTrack = await this.createNewWorkTrack(
          adjustedResult.suggestedNewTrackTitle,
          adjustedResult.trackArchetype,
          adjustedResult.recommendedTemplate,
          journeyId, // Parent journey ID
          sessionData,
          userId
        );

        return {
          action: WorkTrackMappingAction.CreatedNew,
          journeyId,
          journey,
          trackId: newTrack.id,
          track: newTrack,
          templateType: adjustedResult.recommendedTemplate,
          confidence: adjustedResult.confidence,
          narrativeContribution: adjustedResult.narrativeContribution,
          alternativeTracks: activeTracksContext.tracks.slice(0, 3),
          alternativeJourneys: activeTracksContext.journeys
            .filter((j) => j.id !== journeyId)
            .slice(0, 3),
        };
      } else {
        // Fallback: Default to general track under first available journey
        return this.createDefaultGeneralTrack(sessionData, activeTracksContext, userId);
      }
    } catch (err) {
      this.logger.error(
        'LLM track matching failed, using fallback',
        err instanceof Error ? err : new Error(String(err))
      );

      // Fallback: Create general track
      return this.createDefaultGeneralTrack(sessionData, activeTracksContext, userId);
    }
  }

  /**
   * Resolve the parent Journey (Role/Context) for the session
   * Either matches an existing journey or identifies one to create
   */
  private async resolveParentJourney(
    matchResult: TrackMatchingResult,
    context: ActiveWorkTrackContext,
    userId: number
  ): Promise<{ journeyId: string; journey: JourneyInfo }> {
    // If LLM identified an existing journey
    if (matchResult.targetJourneyId) {
      const existingJourney = context.journeys.find(
        (j) => j.id === matchResult.targetJourneyId
      );
      if (existingJourney) {
        return { journeyId: existingJourney.id, journey: existingJourney };
      }
    }

    // If there's only one active journey, use it
    if (context.journeys.length === 1) {
      return {
        journeyId: context.journeys[0].id,
        journey: context.journeys[0],
      };
    }

    // If there are multiple journeys but no match, try to find the best fit
    // based on the track's archetype or use the most recently active one
    if (context.journeys.length > 0) {
      // For now, use the first journey (most recent)
      // TODO: Implement smarter journey selection based on session content
      return {
        journeyId: context.journeys[0].id,
        journey: context.journeys[0],
      };
    }

    // No journeys exist - this is a new user or edge case
    // We'll need to create a work track without a parent for now
    // The track can be reparented later
    this.logger.warn('No journeys found for user, creating orphan track', { userId });
    
    // Create a placeholder journey info
    const placeholderJourney: JourneyInfo = {
      id: 'orphan', // Will be handled specially
      title: matchResult.suggestedJourneyTitle || 'My Work',
      type: TimelineNodeType.Job,
      description: 'Auto-created journey',
    };
    
    return {
      journeyId: 'orphan',
      journey: placeholderJourney,
    };
  }

  /**
   * Build classification text including journey hierarchy and work tracks for LLM context
   * Now includes three-level structure: Journeys → Work Tracks → Sessions
   * CRITICAL: Emphasizes matching to EXISTING tracks before creating new ones
   */
  private buildClassificationTextWithTracks(
    sessionData: PushSessionRequest,
    tracksContext: ActiveWorkTrackContext
  ): string {
    const parts: string[] = [];

    // Part 1: Journey (Role) Context
    parts.push(tracksContext.journeyDescriptions);

    // Part 2: Available Work Tracks (filtered for specificity) - WITH IDs for matching
    const specificTracks = tracksContext.tracks.filter(t => !this.isGenericRoleTrack(t.title));
    if (specificTracks.length > 0) {
      parts.push(`\n=== 🎯 EXISTING WORK TRACKS (MATCH TO THESE FIRST!) ===`);
      parts.push(`⚠️ IMPORTANT: You MUST match to an existing track if the session's theme is related.`);
      parts.push(`Only create a NEW track if NO existing track fits the session's theme.\n`);
      parts.push(specificTracks
        .map((t, i) => {
          const journeyInfo = t.parentJourneyId 
            ? tracksContext.journeys.find(j => j.id === t.parentJourneyId)?.title 
            : 'Unassigned';
          const templateLabel = t.templateType 
            ? TRACK_TEMPLATE_TYPE_LABELS[t.templateType] 
            : 'Default';
          return `${i + 1}. ID: "${t.id}" | "${t.title}" under "${journeyInfo}" (${WORK_TRACK_ARCHETYPE_LABELS[t.archetype]}, ${templateLabel})`;
        })
        .join('\n'));
    } else {
      parts.push(`\n=== AVAILABLE WORK TRACKS ===`);
      parts.push('No specific work tracks yet. Create a NEW specific track for this session.');
    }

    // Part 3: Session Data
    parts.push(`\n=== SESSION DATA (Analyze to determine Journey + Work Track) ===`);
    parts.push(`Session Title: ${sessionData.workflowName}`);

    if (sessionData.summary.highLevelSummary) {
      parts.push(`Summary: ${sessionData.summary.highLevelSummary}`);
    }

    if (sessionData.summary.chapters?.length > 0) {
      const chapterTexts = sessionData.summary.chapters
        .map((c) => `- ${c.title}: ${c.summary}`)
        .join('\n');
      parts.push(`Session Activities:\n${chapterTexts}`);
    }

    if (sessionData.appsUsed && sessionData.appsUsed.length > 0) {
      parts.push(`Apps Used: ${sessionData.appsUsed.join(', ')}`);
    }

    // Part 4: Thematic grouping hints (NEW)
    const thematicHints = this.generateThematicGroupingHints(sessionData, specificTracks);
    if (thematicHints.length > 0) {
      parts.push(`\n=== 🔗 THEMATIC GROUPING ANALYSIS ===`);
      parts.push(thematicHints.join('\n'));
    }

    return parts.join('\n\n');
  }

  /**
   * Generate hints about which existing tracks might be a thematic match
   * Uses semantic keyword extraction rather than hardcoded categories
   */
  private generateThematicGroupingHints(
    sessionData: PushSessionRequest,
    existingTracks: WorkTrackInfo[]
  ): string[] {
    const hints: string[] = [];
    
    if (existingTracks.length === 0) {
      return hints;
    }

    // Extract keywords from session
    const sessionKeywords = this.extractKeywordsFromText(
      `${sessionData.workflowName} ${sessionData.summary?.highLevelSummary || ''}`
    );
    const appsUsed = (sessionData.appsUsed || []).map(a => a.toLowerCase());

    // Score each existing track by keyword overlap with this session
    const trackScores: Array<{ track: WorkTrackInfo; score: number; commonWords: string[] }> = [];

    for (const track of existingTracks) {
      const trackKeywords = this.extractKeywordsFromText(
        `${track.title} ${track.description || ''}`
      );

      // Calculate keyword overlap
      const commonWords: string[] = [];
      let score = 0;

      for (const sessionKw of sessionKeywords) {
        for (const trackKw of trackKeywords) {
          // Check for exact match or partial match
          if (sessionKw === trackKw || 
              sessionKw.includes(trackKw) || 
              trackKw.includes(sessionKw)) {
            score += 1;
            if (!commonWords.includes(sessionKw)) {
              commonWords.push(sessionKw);
            }
          }
        }
      }

      // Also check app-based matching
      for (const app of appsUsed) {
        if (trackKeywords.some(kw => app.includes(kw) || kw.includes(app))) {
          score += 0.5;
        }
      }

      if (score > 0) {
        trackScores.push({ track, score, commonWords });
      }
    }

    // Sort by score and generate hints for top matches
    trackScores.sort((a, b) => b.score - a.score);

    if (trackScores.length > 0) {
      const topMatch = trackScores[0];
      if (topMatch.score >= 1) {
        hints.push(`🎯 STRONG MATCH FOUND: This session shares keywords with existing track "${topMatch.track.title}"`);
        hints.push(`   Common themes: ${topMatch.commonWords.join(', ')}`);
        hints.push(`   → USE target_track_id: "${topMatch.track.id}" (strongly recommended)`);
      } else if (topMatch.score >= 0.5) {
        hints.push(`🔗 POSSIBLE MATCH: Session may relate to "${topMatch.track.title}"`);
        hints.push(`   → Consider using target_track_id: "${topMatch.track.id}"`);
      }

      // Show alternative matches
      if (trackScores.length > 1 && trackScores[1].score >= 0.5) {
        hints.push(`   Alternative: "${trackScores[1].track.title}" (ID: ${trackScores[1].track.id})`);
      }
    }

    // General guidance based on track count
    if (existingTracks.length >= 3 && trackScores.length === 0) {
      hints.push(`⚠️ NO KEYWORD OVERLAP with ${existingTracks.length} existing tracks.`);
      hints.push(`   If this is genuinely new work, create a BROAD track name (not session-specific).`);
    }

    return hints;
  }

  /**
   * Extract meaningful keywords from text for semantic matching
   */
  private extractKeywordsFromText(text: string): string[] {
    const combined = text.toLowerCase();
    
    // Common stop words to filter out
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'work', 'working', 'session', 'sessions', 'track', 'core', 'general',
      'user', 'then', 'this', 'that', 'these', 'those', 'their', 'they',
      'some', 'any', 'all', 'most', 'other', 'new', 'first', 'last'
    ]);

    // Extract words, keeping meaningful ones
    const words = combined
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)];
  }

  /**
   * Filter out generic role-based tracks that shouldn't be matched
   * @deprecated Use isGenericRoleTrack instead
   */
  private filterGenericRoleTracks(tracks: WorkTrackInfo[]): WorkTrackInfo[] {
    return tracks.filter(track => !this.isGenericRoleTrack(track.title));
  }

  /**
   * Extract hints to help the LLM understand what kind of work this is
   * Note: These hints guide track NAMING, not track MATCHING (that's done by generateThematicGroupingHints)
   */
  private extractSpecificityHints(sessionData: PushSessionRequest): string[] {
    // No longer providing hints here - we want the LLM to focus on matching existing tracks first
    // The thematic grouping hints already handle the matching logic
    return [];
  }

  /**
   * Match to work track using LLM with "Chief of Staff" prompt
   * Now performs THREE-LEVEL classification: Journey → Track → Template
   */
  private async matchToWorkTrackWithLLM(
    classificationText: string,
    tracksContext: ActiveWorkTrackContext,
    appsUsed: string[]
  ): Promise<TrackMatchingResult> {
    // Build archetype descriptions
    const archetypeDescriptions = Object.entries(WORK_TRACK_ARCHETYPE_LABELS)
      .map(([value, label]) => `- ${value}: ${label}`)
      .join('\n');

    // Build template descriptions
    const templateDescriptions = Object.entries(TRACK_TEMPLATE_TYPE_LABELS)
      .map(([value, label]) => `- ${value}: ${label}`)
      .join('\n');

    // Build category descriptions for secondary classification
    const categoryDescriptions = Object.entries(WORK_TRACK_CATEGORY_LABELS)
      .slice(0, 10)
      .map(([value, label]) => `${value}: ${label}`)
      .join(', ');

    // Build journey list for selection
    const journeyList = tracksContext.journeys.length > 0
      ? tracksContext.journeys
          .map((j, i) => `${i + 1}. "${j.title}" (ID: ${j.id}, Type: ${j.type})`)
          .join('\n')
      : 'No journeys available - will need to identify the role context.';

    // Build existing tracks list with IDs for the LLM to select from
    const existingTracksList = tracksContext.tracks.length > 0
      ? tracksContext.tracks
          .filter(t => !this.isGenericRoleTrack(t.title))
          .map((t, i) => `${i + 1}. ID: "${t.id}" | Title: "${t.title}" | Theme: ${WORK_TRACK_ARCHETYPE_LABELS[t.archetype]}`)
          .join('\n')
      : 'No existing work tracks yet.';

    const systemPrompt = `You are a Chief of Staff organizing a user's work into a HIERARCHICAL NARRATIVE TIMELINE.

═══════════════════════════════════════════════════════════════════════════════
🚨🚨🚨 MOST IMPORTANT RULE: MATCH TO EXISTING TRACKS FIRST! 🚨🚨🚨
═══════════════════════════════════════════════════════════════════════════════

Before creating a NEW track, you MUST check if any existing track fits thematically.

THEMATIC GROUPING RULES:
• "Cursor product work" + "Desktop MVP" + "Granola requirements" → ALL belong to SAME product track
• "Research on growth" + "Analyze landing page" + "AI growth strategies" → ALL belong to SAME research track
• "Send investor update" + "Pitch deck work" → ALL belong to SAME fundraising track
• "LinkedIn test" + "Social media content" → ALL belong to SAME marketing track

WHEN TO MATCH EXISTING TRACK (return target_track_id):
✅ Session involves coding/development AND a product-related track exists
✅ Session involves research/analysis AND a research track exists  
✅ Session involves same project mentioned in track title
✅ Session theme (product, marketing, research, sales) matches track theme

WHEN TO CREATE NEW TRACK (return suggested_new_track_title):
✅ ONLY if NO existing track has overlapping theme
✅ User is starting a genuinely new initiative (e.g., first fundraising session)
✅ The work is completely different from all existing tracks

═══════════════════════════════════════════════════════════════════════════════
📋 EXISTING TRACKS (Use target_track_id to match!)
═══════════════════════════════════════════════════════════════════════════════
${existingTracksList}

═══════════════════════════════════════════════════════════════════════════════
📋 AVAILABLE JOURNEYS (Select one for target_journey_id)
═══════════════════════════════════════════════════════════════════════════════
${journeyList}

═══════════════════════════════════════════════════════════════════════════════
📊 THREE-LEVEL CLASSIFICATION (Journey → Track → Template)
═══════════════════════════════════════════════════════════════════════════════

LEVEL 1: JOURNEY (The Role/Context)
- Select from existing journeys above
- Examples: "Founder", "Research Assistant", "Job Search"

LEVEL 2: WORK TRACK (The Project/Initiative) ⚠️ MATCH EXISTING OR CREATE BROAD!
- ❌ DON'T create narrow tracks: "Cursor Product Work", "Granola Requirements"
- ✅ DO create BROAD thematic tracks: "Product Development", "Growth Research"
- ✅ DO match to existing tracks with similar themes

LEVEL 3: TEMPLATE (Visualization)
- WORKFLOW_APPROACH: For coding, building, development work
- CASE_STUDY_NARRATIVE: For research, analysis, strategy work
- PIPELINE_VIEW: For sales, fundraising, hiring
- INTERVIEW_PREP: For learning, courses, skills
- TIMELINE_CHRONICLE: For mixed/general activities

═══════════════════════════════════════════════════════════════════════════════
🚨 CRITICAL RULES
═══════════════════════════════════════════════════════════════════════════════

1. PREFER MATCHING to existing tracks over creating new ones
   - If track theme overlaps (product, research, marketing), USE the existing track ID

2. CREATE BROAD tracks, not narrow session-specific ones
   ❌ BAD: "Cursor product work", "Granola requirements gathering", "LinkedIn test"  
   ✅ GOOD: "Product Development", "Growth & Marketing", "Investor Relations"

3. WORK TRACK ≠ JOURNEY NAME
   - If Journey is "Founder", Track should be "Product Development" NOT "Founder"

4. NARRATIVE CONTRIBUTION IS ACTION-ORIENTED
   ❌ BAD: "Did some work", "Core work activities"
   ✅ GOOD: "Implemented session classification logic for work track grouping"

Work Track Archetypes:
${archetypeDescriptions}

Template Types:
${templateDescriptions}

Activity Categories (for analytics): ${categoryDescriptions}...`;

    const userPrompt = `Analyze this work session and perform THREE-LEVEL classification:

${classificationText}

═══════════════════════════════════════════════════════════════════════════════
⚠️ DECISION TREE: Match Existing vs Create New Track
═══════════════════════════════════════════════════════════════════════════════

Step 1: Is this session about PRODUCT/DEVELOPMENT work?
  → YES: Look for existing tracks with "product", "development", "mvp", "build" themes
  → If found: SET target_track_id to that track's ID, SET suggested_new_track_title to null

Step 2: Is this session about RESEARCH/ANALYSIS work?  
  → YES: Look for existing tracks with "research", "analysis", "strategy", "growth" themes
  → If found: SET target_track_id to that track's ID, SET suggested_new_track_title to null

Step 3: Is this session about MARKETING/CONTENT work?
  → YES: Look for existing tracks with "marketing", "content", "linkedin", "social" themes
  → If found: SET target_track_id to that track's ID, SET suggested_new_track_title to null

Step 4: Is this a genuinely NEW theme with NO matching tracks?
  → YES: SET target_track_id to null, SET suggested_new_track_title to BROAD name like "Product Development"

═══════════════════════════════════════════════════════════════════════════════
REQUIRED OUTPUT (JSON)
═══════════════════════════════════════════════════════════════════════════════

LEVEL 1 - JOURNEY:
- target_journey_id: UUID of existing journey (COPY EXACTLY from the list)
- suggested_journey_title: null (only set if no journeys exist)

LEVEL 2 - WORK TRACK (⚠️ PREFER MATCHING EXISTING!):
- target_track_id: UUID of existing track if themes match (COPY EXACTLY from list), else null
- suggested_new_track_title: BROAD name like "Product Development" (only if NO theme match), else null
  ❌ DON'T: "Cursor product work" or "Granola requirements" (too narrow!)
  ✅ DO: "Product Development" or "Growth & Marketing" (broad umbrella)

LEVEL 3 - TEMPLATE:
- recommended_template: WORKFLOW_APPROACH (for building) | CASE_STUDY_NARRATIVE (for research) | PIPELINE_VIEW (for sales) | INTERVIEW_PREP (for learning) | TIMELINE_CHRONICLE (for mixed)

METADATA:
- track_archetype: BUILD_PRODUCT | GROWTH_MARKETING | SALES_FUNDRAISING | OPERATIONS_HIRING | LEARNING_DEVELOPMENT
- activity_category: One of the 27 categories (e.g., "research", "core_work")
- narrative_contribution: ACTION sentence describing what was accomplished
- confidence: 0-1 confidence score  
- reasoning: Explain WHY you matched to existing track OR why you created a new one`;

    const TrackMatchingSchema = z.object({
      // Level 1: Journey
      target_journey_id: z.string().uuid().nullable(),
      suggested_journey_title: z.string().max(200).nullable(),
      
      // Level 2: Track
      target_track_id: z.string().uuid().nullable(),
      suggested_new_track_title: z.string().max(200).nullable(),
      track_archetype: z.nativeEnum(WorkTrackArchetype),
      
      // Level 3: Template
      recommended_template: z.nativeEnum(TrackTemplateType),
      
      // Metadata
      activity_category: z.nativeEnum(WorkTrackCategory),
      narrative_contribution: z.string().max(500),
      confidence: z.number().min(0).max(1),
      reasoning: z.string().max(500).optional(),
    });

    const response = await this.llmProvider.generateStructuredResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      TrackMatchingSchema,
      { temperature: 0.2, maxTokens: 1000 }
    );

    const result = response.content;

    // Post-process to ensure we never return generic role titles
    const sanitizedTitle = this.sanitizeTrackTitle(result.suggested_new_track_title);
    const sanitizedNarrative = this.sanitizeNarrativeContribution(
      result.narrative_contribution,
      result.activity_category
    );

    // Ensure track title differs from journey title
    const journeyTitle = result.target_journey_id
      ? tracksContext.journeys.find(j => j.id === result.target_journey_id)?.title
      : result.suggested_journey_title;
    
    const finalTrackTitle = this.ensureTrackDiffersFromJourney(
      sanitizedTitle,
      journeyTitle || ''
    );

    return {
      targetJourneyId: result.target_journey_id,
      suggestedJourneyTitle: result.suggested_journey_title,
      targetTrackId: result.target_track_id,
      suggestedNewTrackTitle: finalTrackTitle,
      trackArchetype: result.track_archetype,
      recommendedTemplate: result.recommended_template,
      activityCategory: result.activity_category,
      narrativeContribution: sanitizedNarrative,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  }

  /**
   * Ensure track title is different from journey title
   */
  private ensureTrackDiffersFromJourney(
    trackTitle: string | null,
    journeyTitle: string
  ): string | null {
    if (!trackTitle) return null;
    
    const normalizedTrack = trackTitle.toLowerCase().trim();
    const normalizedJourney = journeyTitle.toLowerCase().trim();
    
    // If track matches journey, make it more specific
    if (normalizedTrack === normalizedJourney || 
        normalizedJourney.includes(normalizedTrack) ||
        normalizedTrack.includes(normalizedJourney)) {
      const month = new Date().toLocaleString('default', { month: 'short' });
      const year = new Date().getFullYear();
      return `${trackTitle} - ${month} ${year} Initiative`;
    }
    
    return trackTitle;
  }

  /**
   * Sanitize track title to prevent generic role-based names
   */
  private sanitizeTrackTitle(title: string | null): string | null {
    if (!title) return null;

    const genericPatterns = [
      /^(founder|ceo|cto|cfo|coo|engineer|developer|manager|designer|director)$/i,
      /^(vp|head of|chief|lead|senior|junior|executive|officer|president)$/i,
      /^(work|core work|my job|daily tasks|general work|my work)$/i,
      /^(engineering work|founder activities|management|administration)$/i,
      /^(role|job|position|tasks|activities|duties)$/i,
    ];

    const trimmedTitle = title.trim();
    
    for (const pattern of genericPatterns) {
      if (pattern.test(trimmedTitle)) {
        // Return a more specific fallback based on current month
        const month = new Date().toLocaleString('default', { month: 'long' });
        return `${month} Initiative`;
      }
    }

    return trimmedTitle;
  }

  /**
   * Sanitize narrative contribution to avoid vague descriptions
   */
  private sanitizeNarrativeContribution(
    narrative: string,
    category: WorkTrackCategory
  ): string {
    const vaguePatterns = [
      /^(did |made |worked on |doing )?(some )?(core work|work|tasks|stuff)/i,
      /^(general|various|miscellaneous) (work|tasks|activities)/i,
    ];

    for (const pattern of vaguePatterns) {
      if (pattern.test(narrative)) {
        // Generate a more specific narrative based on category
        return this.generateSpecificNarrative(category);
      }
    }

    // Also replace "Core Work" within the narrative
    return narrative.replace(/core work/gi, this.getCategoryActionLabel(category));
  }

  /**
   * Generate a specific narrative based on activity category
   */
  private generateSpecificNarrative(category: WorkTrackCategory): string {
    const narrativeTemplates: Partial<Record<WorkTrackCategory, string>> = {
      [WorkTrackCategory.CoreWork]: 'Made progress on implementation tasks',
      [WorkTrackCategory.CodeReview]: 'Reviewed code changes and provided feedback',
      [WorkTrackCategory.Communication]: 'Handled communications and correspondence',
      [WorkTrackCategory.Meetings]: 'Participated in team discussions',
      [WorkTrackCategory.Documentation]: 'Updated project documentation',
      [WorkTrackCategory.PlanningStrategy]: 'Worked on planning and strategy',
      [WorkTrackCategory.Research]: 'Conducted research and analysis',
      [WorkTrackCategory.AdminTasks]: 'Completed administrative tasks',
    };

    return narrativeTemplates[category] || 'Completed work session activities';
  }

  /**
   * Get a more descriptive action label for a category
   */
  private getCategoryActionLabel(category: WorkTrackCategory): string {
    const actionLabels: Partial<Record<WorkTrackCategory, string>> = {
      [WorkTrackCategory.CoreWork]: 'implementation work',
      [WorkTrackCategory.CodeReview]: 'code review',
      [WorkTrackCategory.Communication]: 'communications',
      [WorkTrackCategory.Meetings]: 'team discussions',
      [WorkTrackCategory.Documentation]: 'documentation updates',
      [WorkTrackCategory.PlanningStrategy]: 'planning activities',
      [WorkTrackCategory.Research]: 'research',
      [WorkTrackCategory.AdminTasks]: 'administrative tasks',
      [WorkTrackCategory.Networking]: 'networking outreach',
      [WorkTrackCategory.JobSearch]: 'job search activities',
    };

    return actionLabels[category] || 'focused work';
  }

  /**
   * Apply user preferences to track matching result
   */
  private applyTrackPreferences(
    result: TrackMatchingResult,
    preferences: UserLearningContext,
    tracksContext: ActiveWorkTrackContext
  ): TrackMatchingResult {
    // Check if user has learned track preferences
    if (result.targetTrackId && preferences.trackPreferences) {
      const trackPref = preferences.trackPreferences[result.targetTrackId];
      if (trackPref) {
        return {
          ...result,
          confidence: Math.min(result.confidence + trackPref.boost, 1.0),
        };
      }
    }

    return result;
  }

  /**
   * Create a new Work Track as a CHILD of a Journey
   */
  private async createNewWorkTrack(
    title: string,
    archetype: WorkTrackArchetype,
    templateType: TrackTemplateType,
    parentJourneyId: string,
    sessionData: PushSessionRequest,
    userId: number
  ): Promise<WorkTrackInfo> {
    // Determine the actual parent ID (handle 'orphan' case)
    const actualParentId = parentJourneyId === 'orphan' ? undefined : parentJourneyId;
    
    // Create a Project node as the work track, nested under the journey
    const newNode = await this.hierarchyRepository.createNode({
      userId,
      type: TimelineNodeType.Project,
      parentId: actualParentId, // Work Track is a CHILD of the Journey
      meta: {
        title,
        description: sessionData.summary.highLevelSummary,
        workTrackArchetype: archetype,
        templateType, // Store the visualization template
        isWorkTrack: true,
        status: 'active',
      },
    });

    this.logger.info('Created new work track', {
      trackId: newNode.id,
      title,
      parentJourneyId: actualParentId,
      archetype,
      templateType,
    });

    return {
      id: newNode.id,
      title,
      description: sessionData.summary.highLevelSummary,
      archetype,
      templateType,
      parentJourneyId: actualParentId,
      lastActivityAt: new Date().toISOString(),
    };
  }

  /**
   * Create a default track when LLM matching fails
   * Tries to infer a specific track name from session content before falling back to generic
   * Now includes journey context
   */
  private async createDefaultGeneralTrack(
    sessionData: PushSessionRequest,
    tracksContext: ActiveWorkTrackContext,
    userId: number
  ): Promise<WorkTrackMappingResult> {
    // Try to infer a more specific track name from session content
    const { title, archetype, narrative, template } = this.inferTrackFromSessionContent(sessionData);

    // Determine parent journey (use first available or create orphan)
    let journeyId: string;
    let journey: JourneyInfo | undefined;
    
    if (tracksContext.journeys.length > 0) {
      journey = tracksContext.journeys[0];
      journeyId = journey.id;
    } else {
      journeyId = 'orphan';
      journey = {
        id: 'orphan',
        title: 'My Work',
        type: TimelineNodeType.Job,
        description: 'Default journey',
      };
    }

    const newTrack = await this.createNewWorkTrack(
      title,
      archetype,
      template,
      journeyId,
      sessionData,
      userId
    );

    this.logger.info('Created fallback work track', {
      trackId: newTrack.id,
      title,
      archetype,
      template,
      journeyId,
    });

    return {
      action: WorkTrackMappingAction.DefaultedToGeneral,
      journeyId: journeyId === 'orphan' ? newTrack.id : journeyId, // Use track ID if orphan
      journey,
      trackId: newTrack.id,
      track: newTrack,
      templateType: template,
      confidence: 0.5, // Low confidence since it's a fallback
      narrativeContribution: narrative,
      alternativeJourneys: tracksContext.journeys.slice(0, 3),
    };
  }

  /**
   * Infer a specific track from session content using keyword analysis
   * This is the fallback when LLM fails - still tries to be specific
   * Now includes template type inference
   */
  private inferTrackFromSessionContent(sessionData: PushSessionRequest): {
    title: string;
    archetype: WorkTrackArchetype;
    narrative: string;
    template: TrackTemplateType;
  } {
    const summary = sessionData.summary.highLevelSummary?.toLowerCase() || '';
    const workflowName = sessionData.workflowName?.toLowerCase() || '';
    const apps = (sessionData.appsUsed || []).join(' ').toLowerCase();
    const combined = `${workflowName} ${summary} ${apps}`;

    const month = new Date().toLocaleString('default', { month: 'short' });
    const year = new Date().getFullYear();

    // Investor/Fundraising detection
    if (combined.match(/investor|fundrais|pitch|deck|series|seed|vc|angel|term\s*sheet/)) {
      return {
        title: `${month} ${year} Investor Relations`,
        archetype: WorkTrackArchetype.SalesFundraising,
        narrative: 'Handled investor communications and fundraising activities',
        template: TrackTemplateType.PipelineView, // Fundraising = Pipeline
      };
    }

    // Product/Engineering detection
    if (combined.match(/code|develop|bug|feature|mvp|deploy|release|github|vscode|cursor|terminal/)) {
      // Try to extract product name from workflow
      const productMatch = workflowName.match(/([\w\s]+?)(?:\s+(?:mvp|release|feature|bug|update))/i);
      const productName = productMatch ? productMatch[1].trim() : 'Product';
      return {
        title: `${productName} Development`,
        archetype: WorkTrackArchetype.BuildProduct,
        narrative: 'Made progress on product development',
        template: TrackTemplateType.WorkflowApproach, // Coding = Workflow
      };
    }

    // Research/Analysis detection
    if (combined.match(/research|analyz|strateg|market|competitor|landing\s*page|value\s*prop/)) {
      return {
        title: `${month} ${year} Research & Analysis`,
        archetype: WorkTrackArchetype.GrowthMarketing,
        narrative: 'Conducted research and analysis',
        template: TrackTemplateType.CaseStudyNarrative, // Research = Case Study
      };
    }

    // Marketing/Content detection
    if (combined.match(/content|blog|social|marketing|campaign|seo|analytics|growth/)) {
      return {
        title: `${month} ${year} Marketing`,
        archetype: WorkTrackArchetype.GrowthMarketing,
        narrative: 'Worked on marketing and content activities',
        template: TrackTemplateType.CaseStudyNarrative, // Marketing = Case Study
      };
    }

    // Hiring detection
    if (combined.match(/hire|hiring|recruit|candidate|resume|interview|job\s*post/)) {
      return {
        title: `${month} ${year} Hiring`,
        archetype: WorkTrackArchetype.OperationsHiring,
        narrative: 'Progressed on hiring and recruitment',
        template: TrackTemplateType.PipelineView, // Hiring = Pipeline
      };
    }

    // Learning detection
    if (combined.match(/learn|course|tutorial|study|certif|training|udemy|coursera/)) {
      return {
        title: `${month} ${year} Learning`,
        archetype: WorkTrackArchetype.LearningDevelopment,
        narrative: 'Continued learning and skill development',
        template: TrackTemplateType.InterviewPrep, // Learning = STAR method
      };
    }

    // Default fallback - but still try to be somewhat specific
    return {
      title: `${month} ${year} Projects`,
      archetype: WorkTrackArchetype.BuildProduct,
      narrative: 'Completed project work activities',
      template: TrackTemplateType.TimelineChronicle, // Default = Timeline
    };
  }

  /**
   * Build ClassificationResult from TrackMatchingResult
   * Now includes template type for visualization
   */
  private buildClassificationFromTrackMatch(
    trackMatch: WorkTrackMappingResult
  ): ClassificationResult {
    // Get the activity category from the track's archetype or default
    const archetype = trackMatch.track?.archetype || WorkTrackArchetype.BuildProduct;
    const templateType = trackMatch.templateType || 
      trackMatch.track?.templateType || 
      ARCHETYPE_TO_DEFAULT_TEMPLATE[archetype];
    
    // Infer a reasonable category based on archetype
    const category = this.inferCategoryFromArchetype(archetype);
    const nodeType = WORK_TRACK_CATEGORY_TO_NODE_TYPE[category];

    return {
      category,
      confidence: trackMatch.confidence,
      nodeType,
      signals: [
        `journey:${trackMatch.journey?.title || 'unknown'}`,
        `track:${trackMatch.action}`,
        `archetype:${archetype}`,
        `template:${templateType}`,
      ],
      trackArchetype: archetype,
      templateType,
      narrativeContribution: trackMatch.narrativeContribution,
    };
  }

  /**
   * Infer a reasonable activity category from archetype
   */
  private inferCategoryFromArchetype(archetype: WorkTrackArchetype): WorkTrackCategory {
    switch (archetype) {
      case WorkTrackArchetype.BuildProduct:
        return WorkTrackCategory.CoreWork;
      case WorkTrackArchetype.GrowthMarketing:
        return WorkTrackCategory.PersonalBranding;
      case WorkTrackArchetype.SalesFundraising:
        return WorkTrackCategory.Networking;
      case WorkTrackArchetype.OperationsHiring:
        return WorkTrackCategory.AdminTasks;
      case WorkTrackArchetype.LearningDevelopment:
        return WorkTrackCategory.SelfStudy;
      default:
        return WorkTrackCategory.GeneralBrowsing;
    }
  }

  // ============================================================================
  // LEGACY CLASSIFICATION (kept for backward compatibility)
  // ============================================================================

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
   * NOTE: This is now a secondary classification for activity type.
   * Primary grouping is done via matchToWorkTrack()
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

    const archetypeDescriptions = Object.entries(WORK_TRACK_ARCHETYPE_LABELS)
      .map(([value, label]) => `- ${value}: ${label}`)
      .join('\n');

    const systemPrompt = `You are a session classifier that categorizes work activities.

Activity Categories (27 types):
${categoryDescriptions}

Work Track Archetypes (UI templates):
${archetypeDescriptions}

Analyze the session and determine:
1. The most appropriate activity category
2. The work track archetype this belongs to
3. A brief narrative of progress made`;

    const userPrompt = `Classify this work session:

${classificationText}

Return the classification as JSON with:
- category: the activity category value (e.g., "core_work", "code_review")
- track_archetype: the archetype (e.g., "BUILD_PRODUCT", "SALES_FUNDRAISING")
- narrative_contribution: one sentence describing progress made
- confidence: a number between 0 and 1 indicating confidence
- signals: array of 2-4 specific phrases from the input that triggered this classification`;

    const ClassificationSchema = z.object({
      category: z.nativeEnum(WorkTrackCategory),
      track_archetype: z.nativeEnum(WorkTrackArchetype),
      narrative_contribution: z.string().max(500),
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
        { temperature: 0.1, maxTokens: 600 }
      );

      const result = response.content;

      // Apply RLHF adjustments from user preferences
      const adjustedResult = this.applyUserPreferences(
        { category: result.category, confidence: result.confidence, signals: result.signals },
        userPreferences,
        appsUsed
      );

      // Get the mapped node type
      const nodeType = WORK_TRACK_CATEGORY_TO_NODE_TYPE[adjustedResult.category];

      return {
        category: adjustedResult.category,
        confidence: adjustedResult.confidence,
        nodeType,
        signals: adjustedResult.signals,
        trackArchetype: result.track_archetype,
        narrativeContribution: result.narrative_contribution,
      };
    } catch (err) {
      this.logger.error(
        'LLM classification failed, using fallback',
        err instanceof Error ? err : new Error(String(err))
      );

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
    const trackArchetype = ACTIVITY_CATEGORY_TO_ARCHETYPE[bestCategory];

    return {
      category: bestCategory,
      confidence: Math.min(0.5 + bestScore * 0.1, 0.8), // Cap at 0.8 for fallback
      nodeType,
      signals: signals.slice(0, 4),
      trackArchetype,
      narrativeContribution: `Session activity: ${WORK_TRACK_CATEGORY_LABELS[bestCategory]}`,
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
   * Now compares against Work Track descriptions for better context awareness
   */
  private async findBestMatchingNodes(
    nodes: any[],
    sessionEmbedding: Float32Array,
    sessionData: PushSessionRequest,
    userId: number
  ): Promise<Array<{ node: NodeInfo; score: number }>> {
    const matches: Array<{ node: NodeInfo; score: number }> = [];

    for (const node of nodes) {
      // Build comprehensive text for embedding comparison
      // Now includes work track context if available
      const nodeText = this.buildNodeTextForMatching(node);
      const nodeEmbedding = await this.embeddingService.generateEmbedding(nodeText);

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(sessionEmbedding, nodeEmbedding);

      // Apply temporal boost (recent nodes get higher scores)
      const temporalBoost = this.calculateTemporalBoost(node);

      // Apply work track boost if this is a work track node
      const workTrackBoost = this.calculateWorkTrackBoost(node);

      // Final score: 60% similarity, 25% temporal, 15% work track
      const score = similarity * 0.6 + temporalBoost * 0.25 + workTrackBoost * 0.15;

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
   * Build text representation of a node for embedding matching
   * Enhanced to include Work Track context
   */
  private buildNodeTextForMatching(node: any): string {
    const meta = node.meta || {};
    const parts: string[] = [];

    // Basic info
    if (meta.title) parts.push(meta.title);
    if (meta.description) parts.push(meta.description);
    
    // Work context
    if (meta.role) parts.push(`Role: ${meta.role}`);
    if (meta.company) parts.push(`Company: ${meta.company}`);
    
    // Technical context
    if (meta.technologies) parts.push(`Tech: ${meta.technologies.join(', ')}`);

    // Work Track specific context
    if (meta.isWorkTrack) {
      parts.push('Work Track');
      if (meta.workTrackArchetype) {
        parts.push(`Type: ${WORK_TRACK_ARCHETYPE_LABELS[meta.workTrackArchetype as WorkTrackArchetype] || meta.workTrackArchetype}`);
      }
    }

    // Include recent session summaries if available (for better context)
    if (meta.recentSessionSummaries) {
      parts.push(`Recent work: ${meta.recentSessionSummaries.slice(0, 3).join('. ')}`);
    }

    return parts.join(' | ');
  }

  /**
   * Calculate boost for Work Track nodes (prioritize them in matching)
   */
  private calculateWorkTrackBoost(node: any): number {
    const meta = node.meta || {};
    
    // Strong boost for explicit work tracks
    if (meta.isWorkTrack) {
      // Additional boost for active tracks
      if (meta.status === 'active') return 1.0;
      if (meta.status === 'paused') return 0.5;
      return 0.3;
    }
    
    // Small boost for Project nodes (potential work tracks)
    if (node.type === TimelineNodeType.Project) {
      return 0.2;
    }
    
    return 0;
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
      // Classification metadata (activity category is now secondary)
      workTrackCategory: classification.category,
      autoClassified: true,
      classificationConfidence: classification.confidence,
      // Work Track metadata (primary grouping)
      workTrackArchetype: classification.trackArchetype || ACTIVITY_CATEGORY_TO_ARCHETYPE[classification.category],
      narrativeContribution: classification.narrativeContribution,
      isWorkTrack: true,
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
      const trackPreferences: UserLearningContext['trackPreferences'] = {};

      // Analyze feedback patterns
      for (const fb of feedback) {
        if (fb.correctedCategory && fb.correctedCategory !== fb.originalCategory) {
          // User corrected this category - boost the corrected one
          const category = fb.correctedCategory as WorkTrackCategory;
          const existing = categoryAdjustments[category];
          categoryAdjustments[category] = {
            boost: (existing?.boost || 0) + 0.1,
            reason: `User frequently corrects to ${fb.correctedCategory}`,
          };
        }

        // Track preferences: boost tracks that user frequently selects
        if (fb.correctedNodeId && fb.correctedNodeId !== fb.originalNodeId) {
          const existing = trackPreferences[fb.correctedNodeId];
          trackPreferences[fb.correctedNodeId] = {
            boost: (existing?.boost || 0) + 0.15,
            reason: `User frequently maps to this track`,
          };
        }
      }

      return { categoryAdjustments, appPatterns, trackPreferences };
    } catch (error) {
      this.logger.warn('Failed to get user preferences, using defaults', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { categoryAdjustments: {}, appPatterns: {}, trackPreferences: {} };
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

