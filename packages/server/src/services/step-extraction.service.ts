/**
 * Step Extraction Service
 *
 * Extracts fine-grained UI actions (Steps) from Block screenshots.
 * Steps are extracted on-demand when a user drills down into a Block.
 */

import { aql, type Database } from 'arangojs';
import { v4 as uuidv4 } from 'uuid';

import {
  StepActionType,
  ExtractionMethod,
  type StepNode,
  type RawExtractedStep,
  type BlockNode,
  type BlockDrilldownResponse,
  type StepDetail,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';
import { ArangoDBConnection } from '../config/arangodb.connection.js';
import type { ConfidenceScoringService } from './confidence-scoring.service.js';

// ============================================================================
// TYPES
// ============================================================================

interface ScreenshotData {
  id: number;
  summary: string | null;
  analysis?: string | null;
  appName: string;
  timestamp: string;
  cloudUrl?: string;
}

interface LLMProvider {
  complete(prompt: string, options?: { model?: string; responseFormat?: string }): Promise<string>;
}

interface StepRetrievalOptions {
  extractIfMissing?: boolean;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class StepExtractionService {
  private logger: Logger;
  private db: Database | null = null;
  private llmProvider: LLMProvider;
  private confidenceScoringService: ConfidenceScoringService;

  constructor({
    logger,
    llmProvider,
    confidenceScoringService,
  }: {
    logger: Logger;
    llmProvider: LLMProvider;
    confidenceScoringService: ConfidenceScoringService;
  }) {
    this.logger = logger;
    this.llmProvider = llmProvider;
    this.confidenceScoringService = confidenceScoringService;
  }

  /**
   * Ensure database connection
   */
  private async ensureInitialized(): Promise<Database> {
    if (!this.db) {
      this.db = await ArangoDBConnection.getConnection();
    }
    return this.db;
  }

  /**
   * Get steps for a block - extracts if not already done
   */
  async getStepsForBlock(
    blockId: string,
    screenshots: ScreenshotData[],
    options: StepRetrievalOptions = {}
  ): Promise<BlockDrilldownResponse> {
    const db = await this.ensureInitialized();

    this.logger.info('Getting steps for block', {
      blockId,
      screenshotCount: screenshots.length,
    });

    // Get block details
    const block = await this.getBlockNode(blockId);
    if (!block) {
      throw new Error(`Block ${blockId} not found`);
    }

    // Get existing steps
    let steps = await this.getExistingSteps(blockId);

    // Extract if missing and requested
    if (steps.length === 0 && options.extractIfMissing !== false) {
      this.logger.info('Extracting steps for block', {
        blockId,
        screenshotCount: screenshots.length,
      });

      steps = await this.extractStepsFromBlock(blockId, screenshots, block);
    }

    // Enrich steps with screenshot data
    const enrichedSteps = await this.enrichStepsWithEvidence(steps, screenshots);

    return {
      block: {
        id: block._key,
        canonicalName: block.canonicalName,
        intent: block.intentLabel,
        tool: block.primaryTool,
        duration: block.avgDurationSeconds,
        confidence: block.confidence,
      },
      steps: enrichedSteps,
      metadata: {
        totalSteps: steps.length,
        extractionMethod: steps[0]?.extractionMethod || ExtractionMethod.LlmInference,
        lastExtracted: steps[0]?.createdAt || new Date().toISOString(),
      },
    };
  }

  /**
   * Get block node from ArangoDB
   */
  private async getBlockNode(blockId: string): Promise<BlockNode | null> {
    const db = await this.ensureInitialized();

    try {
      const query = aql`
        FOR block IN blocks
          FILTER block._key == ${blockId}
          RETURN block
      `;

      const cursor = await db.query(query);
      return await cursor.next();
    } catch (error) {
      this.logger.error('Failed to get block node', {
        blockId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get existing steps for a block from ArangoDB
   */
  private async getExistingSteps(blockId: string): Promise<StepNode[]> {
    const db = await this.ensureInitialized();

    try {
      const query = aql`
        FOR edge IN BLOCK_CONTAINS_STEP
          FILTER edge._from == CONCAT('blocks/', ${blockId})
          LET step = DOCUMENT(edge._to)
          SORT edge.orderInBlock ASC
          RETURN step
      `;

      const cursor = await db.query(query);
      return await cursor.all();
    } catch (error) {
      this.logger.error('Failed to get existing steps', {
        blockId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Extract steps from block screenshots using LLM
   */
  private async extractStepsFromBlock(
    blockId: string,
    screenshots: ScreenshotData[],
    block: BlockNode
  ): Promise<StepNode[]> {
    const prompt = this.buildStepExtractionPrompt(screenshots);

    try {
      const response = await this.llmProvider.complete(prompt, {
        model: 'gpt-4o',
        responseFormat: 'json',
      });

      // Clean up response - LLM may wrap JSON in markdown code blocks or add text
      let cleanedResponse = response.trim();

      // Remove markdown code blocks
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();

      // Try to find JSON array in the response if it starts with text
      if (!cleanedResponse.startsWith('[')) {
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }
      }

      const rawSteps: RawExtractedStep[] = JSON.parse(cleanedResponse);

      this.logger.info('LLM extracted raw steps', {
        blockId,
        rawStepCount: rawSteps.length,
        rawResponse: cleanedResponse.substring(0, 500),
      });

      if (rawSteps.length === 0) {
        this.logger.warn('LLM returned empty steps array', {
          blockId,
          screenshotSummaries: screenshots.map(s => s.summary?.substring(0, 100)),
        });
        return [];
      }

      // Create step nodes and edges
      const steps = await this.createStepNodes(blockId, rawSteps, screenshots, block);

      // Link steps temporally
      await this.linkStepsTemporally(steps);

      this.logger.info('Extracted steps from block', {
        blockId,
        stepCount: steps.length,
      });

      return steps;
    } catch (error) {
      this.logger.error('Failed to extract steps from block', {
        blockId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Build LLM prompt for step extraction
   */
  private buildStepExtractionPrompt(screenshots: ScreenshotData[]): string {
    const screenshotDetails = screenshots
      .map(
        (s, i) => `
[Screenshot ${i + 1}] @ ${s.timestamp}
App: ${s.appName}
Summary: ${s.summary || 'No summary'}
Analysis: ${s.analysis || 'N/A'}
`
      )
      .join('\n---\n');

    return `You are a JSON-only response bot. Analyze these ${screenshots.length} screenshots from a single work block and infer the user actions that likely occurred.

Screenshots:
${screenshotDetails}

Extract or INFER user actions based on the context. Even if summaries are vague, make reasonable inferences about what the user likely did:
- If viewing a document: infer document_opened, scroll_action, or text_selected
- If in a browser: infer tab_switched, button_clicked, or prompt_entered
- If similar screenshots: infer the user was reading/reviewing content

Fields:
- actionType: one of (prompt_entered, button_clicked, file_opened, file_saved, text_selected, text_pasted, tab_switched, command_executed, shortcut_used, scroll_action, menu_selected, dialog_interaction, document_opened, content_reviewed)
- description: what the user likely did
- rawInput: any visible text or input (optional)
- targetElement: UI element (optional)
- confidence: 0.0-1.0 (lower for inferred actions)
- screenshotIndex: which screenshot (1-indexed)

IMPORTANT: Always return at least one action per screenshot. If unsure, use "content_reviewed" with lower confidence.

Output format (respond with ONLY this JSON array):
[{"actionType":"document_opened","description":"Opened strategy document","targetElement":"Google Docs","confidence":0.7,"screenshotIndex":1}]`;
  }

  /**
   * Create step nodes in ArangoDB
   */
  private async createStepNodes(
    blockId: string,
    rawSteps: RawExtractedStep[],
    screenshots: ScreenshotData[],
    block: BlockNode
  ): Promise<StepNode[]> {
    const db = await this.ensureInitialized();
    const steps: StepNode[] = [];

    for (let i = 0; i < rawSteps.length; i++) {
      const raw = rawSteps[i];
      const screenshot = screenshots[raw.screenshotIndex - 1];

      // Calculate step confidence
      const confidence = this.confidenceScoringService.calculateStepConfidence(
        raw,
        block
      );

      const stepKey = `stp_${uuidv4().replace(/-/g, '')}`;

      const step: StepNode = {
        _key: stepKey,
        _id: `steps/${stepKey}`,
        type: 'step',
        actionType: this.mapToStepActionType(raw.actionType),
        description: raw.description,
        rawInput: raw.rawInput || null,
        targetElement: raw.targetElement || null,
        appContext: screenshot?.appName || 'unknown',
        timestamp: screenshot?.timestamp || new Date().toISOString(),
        durationMs: null,
        orderInBlock: i,
        screenshotId: screenshot?.id || null,
        confidence,
        extractionMethod: ExtractionMethod.LlmInference,
        sessionId: '', // Will be filled from context
        createdAt: new Date().toISOString(),
      };

      try {
        // Insert step node
        const insertQuery = aql`
          INSERT ${step} INTO steps
          RETURN NEW
        `;

        const cursor = await db.query(insertQuery);
        const inserted = await cursor.next();
        step._id = inserted._id;

        // Create BLOCK_CONTAINS_STEP edge
        const edgeQuery = aql`
          INSERT {
            _from: CONCAT('blocks/', ${blockId}),
            _to: ${step._id},
            type: 'BLOCK_CONTAINS_STEP',
            orderInBlock: ${i},
            isCanonical: ${confidence > 0.8}
          } INTO BLOCK_CONTAINS_STEP
        `;

        await db.query(edgeQuery);

        steps.push(step);
      } catch (error) {
        this.logger.error('Failed to create step node', {
          stepKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return steps;
  }

  /**
   * Link steps temporally with NEXT_STEP edges
   */
  private async linkStepsTemporally(steps: StepNode[]): Promise<void> {
    const db = await this.ensureInitialized();

    for (let i = 0; i < steps.length - 1; i++) {
      const fromStep = steps[i];
      const toStep = steps[i + 1];

      const gapMs =
        new Date(toStep.timestamp).getTime() -
        new Date(fromStep.timestamp).getTime();

      try {
        const query = aql`
          INSERT {
            _from: ${fromStep._id},
            _to: ${toStep._id},
            type: 'NEXT_STEP',
            gapMs: ${Math.max(0, gapMs)},
            withinBlock: true
          } INTO NEXT_STEP
        `;

        await db.query(query);
      } catch (error) {
        this.logger.warn('Failed to create NEXT_STEP edge', {
          from: fromStep._key,
          to: toStep._key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Map string to StepActionType enum
   */
  private mapToStepActionType(actionType: string): StepActionType {
    const mapping: Record<string, StepActionType> = {
      prompt_entered: StepActionType.PromptEntered,
      button_clicked: StepActionType.ButtonClicked,
      file_opened: StepActionType.FileOpened,
      file_saved: StepActionType.FileSaved,
      text_selected: StepActionType.TextSelected,
      text_pasted: StepActionType.TextPasted,
      tab_switched: StepActionType.TabSwitched,
      command_executed: StepActionType.CommandExecuted,
      shortcut_used: StepActionType.ShortcutUsed,
      scroll_action: StepActionType.ScrollAction,
      menu_selected: StepActionType.MenuSelected,
      dialog_interaction: StepActionType.DialogInteraction,
    };

    return mapping[actionType?.toLowerCase()] || StepActionType.ButtonClicked;
  }

  /**
   * Enrich steps with screenshot evidence
   */
  private async enrichStepsWithEvidence(
    steps: StepNode[],
    screenshots: ScreenshotData[]
  ): Promise<StepDetail[]> {
    return steps.map((step) => {
      const screenshot = step.screenshotId
        ? screenshots.find((s) => s.id === step.screenshotId)
        : null;

      return {
        id: step._key,
        order: step.orderInBlock,
        actionType: step.actionType,
        description: step.description,
        rawInput: step.rawInput,
        timestamp: step.timestamp,
        confidence: step.confidence,
        screenshot: screenshot
          ? {
              id: screenshot.id,
              thumbnailUrl: screenshot.cloudUrl || `/api/screenshots/${screenshot.id}/thumb`,
              appName: screenshot.appName,
            }
          : null,
      };
    });
  }

  /**
   * Delete steps for a block (for re-extraction)
   */
  async deleteStepsForBlock(blockId: string): Promise<number> {
    const db = await this.ensureInitialized();

    try {
      // Get all step IDs for this block
      const stepsQuery = aql`
        FOR edge IN BLOCK_CONTAINS_STEP
          FILTER edge._from == CONCAT('blocks/', ${blockId})
          RETURN edge._to
      `;

      const cursor = await db.query(stepsQuery);
      const stepIds = await cursor.all();

      if (stepIds.length === 0) {
        return 0;
      }

      // Delete NEXT_STEP edges involving these steps
      const deleteNextStepQuery = aql`
        FOR edge IN NEXT_STEP
          FILTER edge._from IN ${stepIds} OR edge._to IN ${stepIds}
          REMOVE edge IN NEXT_STEP
      `;

      await db.query(deleteNextStepQuery);

      // Delete BLOCK_CONTAINS_STEP edges
      const deleteContainsQuery = aql`
        FOR edge IN BLOCK_CONTAINS_STEP
          FILTER edge._from == CONCAT('blocks/', ${blockId})
          REMOVE edge IN BLOCK_CONTAINS_STEP
      `;

      await db.query(deleteContainsQuery);

      // Delete step nodes
      const deleteStepsQuery = aql`
        FOR stepId IN ${stepIds}
          LET step = DOCUMENT(stepId)
          REMOVE step IN steps
      `;

      await db.query(deleteStepsQuery);

      this.logger.info('Deleted steps for block', {
        blockId,
        deletedCount: stepIds.length,
      });

      return stepIds.length;
    } catch (error) {
      this.logger.error('Failed to delete steps for block', {
        blockId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}
