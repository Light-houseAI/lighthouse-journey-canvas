/**
 * Block Extraction Service
 *
 * Extracts meaningful execution Blocks from session screenshots.
 * Blocks represent tool-level activities like "AI Prompting" or "Terminal Commands".
 */

import {
  BlockIntent,
  ExtractionMethod,
  type RawExtractedBlock,
  type BlockExtractionConfig,
  type BlockMergingConfig,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';
import type { ToolGeneralizationService } from './tool-generalization.service.js';
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
  workflowTag?: string;
}

interface SessionChapter {
  chapter_id: number;
  title: string;
  summary: string;
  primary_app: string;
  time_start: string;
  time_end: string;
  granular_steps?: Array<{
    step_id: number;
    description: string;
    timestamp: string;
    app: string;
  }>;
}

interface ScreenshotGroup {
  screenshots: ScreenshotData[];
  primaryApp: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  chapterContext?: SessionChapter;
}

interface LLMService {
  complete(prompt: string, options?: { model?: string; responseFormat?: string }): Promise<string>;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const DEFAULT_EXTRACTION_CONFIG: BlockExtractionConfig = {
  maxGapSeconds: 120,         // 2 minutes = same block
  minScreenshotsPerBlock: 2,  // At least 2 screenshots
  minBlockDurationSeconds: 30, // At least 30 seconds
};

const DEFAULT_MERGING_CONFIG: BlockMergingConfig = {
  minBlockDurationSeconds: 30,
  maxGapForMergeSeconds: 60,
  minScreenshotsPerBlock: 2,
  semanticSimilarityThreshold: 0.85,
};

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class BlockExtractionService {
  private logger: Logger;
  private llmService: LLMService;
  private toolGeneralizationService: ToolGeneralizationService;
  private confidenceScoringService: ConfidenceScoringService;

  constructor({
    logger,
    llmService,
    toolGeneralizationService,
    confidenceScoringService,
  }: {
    logger: Logger;
    llmService: LLMService;
    toolGeneralizationService: ToolGeneralizationService;
    confidenceScoringService: ConfidenceScoringService;
  }) {
    this.logger = logger;
    this.llmService = llmService;
    this.toolGeneralizationService = toolGeneralizationService;
    this.confidenceScoringService = confidenceScoringService;
  }

  /**
   * Extract blocks from a session's screenshots and chapters
   */
  async extractBlocksFromSession(
    sessionId: string,
    screenshots: ScreenshotData[],
    chapters: SessionChapter[] = [],
    config: BlockExtractionConfig = DEFAULT_EXTRACTION_CONFIG
  ): Promise<RawExtractedBlock[]> {
    this.logger.info('Starting block extraction', {
      sessionId,
      screenshotCount: screenshots.length,
      chapterCount: chapters.length,
    });

    if (screenshots.length === 0) {
      this.logger.warn('No screenshots to extract blocks from', { sessionId });
      return [];
    }

    // Step 1: Group screenshots by temporal proximity + tool
    const screenshotGroups = this.groupScreenshotsByToolAndTime(
      screenshots,
      config
    );

    this.logger.debug('Grouped screenshots into groups', {
      groupCount: screenshotGroups.length,
    });

    // Step 2: Enrich with chapter context (if available)
    const enrichedGroups = this.enrichWithChapters(screenshotGroups, chapters);

    // Step 3: Extract blocks from each group using LLM
    const rawBlocks: RawExtractedBlock[] = [];

    for (const group of enrichedGroups) {
      try {
        const block = await this.extractBlockFromGroup(group);
        if (block) {
          rawBlocks.push(block);
        }
      } catch (error) {
        this.logger.error('Failed to extract block from group', {
          error: error instanceof Error ? error.message : String(error),
          groupScreenshotCount: group.screenshots.length,
        });
      }
    }

    this.logger.info('Extracted raw blocks', {
      sessionId,
      blockCount: rawBlocks.length,
    });

    // Step 4: Merge over-fragmented blocks
    const mergedBlocks = await this.mergeFragmentedBlocks(
      rawBlocks,
      DEFAULT_MERGING_CONFIG
    );

    this.logger.info('Block extraction complete', {
      sessionId,
      rawBlockCount: rawBlocks.length,
      mergedBlockCount: mergedBlocks.length,
    });

    return mergedBlocks;
  }

  /**
   * Group screenshots by tool and temporal proximity
   */
  private groupScreenshotsByToolAndTime(
    screenshots: ScreenshotData[],
    config: BlockExtractionConfig
  ): ScreenshotGroup[] {
    // Sort by timestamp
    const sorted = [...screenshots].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const groups: ScreenshotGroup[] = [];
    let currentGroup: ScreenshotData[] = [];
    let currentApp: string | null = null;

    for (const screenshot of sorted) {
      const app = this.normalizeAppName(screenshot.appName);

      if (currentGroup.length === 0) {
        // Start new group
        currentGroup.push(screenshot);
        currentApp = app;
        continue;
      }

      const lastScreenshot = currentGroup[currentGroup.length - 1];
      const gapSeconds = this.calculateGapSeconds(lastScreenshot.timestamp, screenshot.timestamp);

      // Check if we should continue current group or start new one
      const sameApp = currentApp === app;
      const withinTimeGap = gapSeconds <= config.maxGapSeconds;

      if (sameApp && withinTimeGap) {
        // Continue current group
        currentGroup.push(screenshot);
      } else {
        // Finalize current group and start new one
        if (currentGroup.length >= config.minScreenshotsPerBlock) {
          groups.push(this.createScreenshotGroup(currentGroup, currentApp!));
        }
        currentGroup = [screenshot];
        currentApp = app;
      }
    }

    // Don't forget the last group
    if (currentGroup.length >= config.minScreenshotsPerBlock && currentApp) {
      groups.push(this.createScreenshotGroup(currentGroup, currentApp));
    }

    return groups;
  }

  /**
   * Create a screenshot group from a list of screenshots
   */
  private createScreenshotGroup(
    screenshots: ScreenshotData[],
    primaryApp: string
  ): ScreenshotGroup {
    const startTime = screenshots[0].timestamp;
    const endTime = screenshots[screenshots.length - 1].timestamp;
    const durationSeconds = this.calculateGapSeconds(startTime, endTime);

    return {
      screenshots,
      primaryApp,
      startTime,
      endTime,
      durationSeconds,
    };
  }

  /**
   * Enrich screenshot groups with chapter context
   */
  private enrichWithChapters(
    groups: ScreenshotGroup[],
    chapters: SessionChapter[]
  ): ScreenshotGroup[] {
    if (chapters.length === 0) {
      return groups;
    }

    return groups.map((group) => {
      // Find overlapping chapter
      const matchingChapter = chapters.find((chapter) => {
        const chapterStart = new Date(chapter.time_start).getTime();
        const chapterEnd = new Date(chapter.time_end).getTime();
        const groupStart = new Date(group.startTime).getTime();
        const groupEnd = new Date(group.endTime).getTime();

        // Check for overlap
        return groupStart <= chapterEnd && groupEnd >= chapterStart;
      });

      if (matchingChapter) {
        return { ...group, chapterContext: matchingChapter };
      }
      return group;
    });
  }

  /**
   * Extract a block from a screenshot group using LLM
   */
  private async extractBlockFromGroup(
    group: ScreenshotGroup
  ): Promise<RawExtractedBlock | null> {
    const prompt = this.buildBlockExtractionPrompt(group);

    try {
      const response = await this.llmService.complete(prompt, {
        model: 'gpt-4o-mini',
        responseFormat: 'json',
      });

      const parsed = JSON.parse(response);

      // Validate and map intent
      const intent = this.mapToBlockIntent(parsed.blockIntent);

      const block: RawExtractedBlock = {
        suggestedName: parsed.suggestedName || 'Unknown Block',
        intentLabel: intent,
        confidence: parsed.confidence || 0.7,
        primaryTool: group.primaryApp,
        screenshots: group.screenshots.map((s) => ({
          id: s.id,
          summary: s.summary || '',
          timestamp: s.timestamp,
          appName: s.appName,
        })),
        startTime: group.startTime,
        endTime: group.endTime,
        durationSeconds: group.durationSeconds,
        reasoning: parsed.reasoning,
      };

      // Recalculate confidence using our scoring service
      const factors = this.confidenceScoringService.calculateBlockFactors(
        block,
        ExtractionMethod.LlmInference
      );
      block.confidence = this.confidenceScoringService.calculateBlockConfidence(
        block,
        factors
      );

      return block;
    } catch (error) {
      this.logger.error('Failed to parse LLM response for block extraction', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Build LLM prompt for block extraction
   */
  private buildBlockExtractionPrompt(group: ScreenshotGroup): string {
    const screenshotSummaries = group.screenshots
      .map((s, i) => `[${i + 1}] ${s.summary || 'No summary available'}`)
      .join('\n');

    const chapterContext = group.chapterContext
      ? `\nChapter context: "${group.chapterContext.title}" - ${group.chapterContext.summary}`
      : '';

    return `Analyze these ${group.screenshots.length} consecutive screenshots from ${group.primaryApp}.

Screenshots summaries:
${screenshotSummaries}
${chapterContext}

Extract the SINGLE high-level activity block this represents.

Respond in JSON:
{
  "blockIntent": "<one of: ai_prompt, code_edit, code_review, terminal_command, file_navigation, web_research, git_operation, documentation, testing, debugging, communication>",
  "suggestedName": "<3-5 word intent description, e.g., 'AI-Assisted Bug Fix'>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation of why this is a coherent block>"
}

Important:
- Focus on the PRIMARY activity, not secondary actions
- The name should describe WHAT the user is accomplishing, not just the tool
- Be specific but not overly detailed`;
  }

  /**
   * Map LLM output to BlockIntent enum
   */
  private mapToBlockIntent(intent: string): BlockIntent {
    const mapping: Record<string, BlockIntent> = {
      ai_prompt: BlockIntent.AiPrompt,
      code_edit: BlockIntent.CodeEdit,
      code_review: BlockIntent.CodeReview,
      terminal_command: BlockIntent.TerminalCommand,
      file_navigation: BlockIntent.FileNavigation,
      web_research: BlockIntent.WebResearch,
      git_operation: BlockIntent.GitOperation,
      documentation: BlockIntent.Documentation,
      testing: BlockIntent.Testing,
      debugging: BlockIntent.Debugging,
      communication: BlockIntent.Communication,
    };

    return mapping[intent?.toLowerCase()] || BlockIntent.CodeEdit;
  }

  /**
   * Merge over-fragmented blocks
   */
  private async mergeFragmentedBlocks(
    blocks: RawExtractedBlock[],
    config: BlockMergingConfig
  ): Promise<RawExtractedBlock[]> {
    if (blocks.length <= 1) {
      return blocks;
    }

    const merged: RawExtractedBlock[] = [];
    let currentMergeGroup: RawExtractedBlock[] = [];

    for (const block of blocks) {
      if (currentMergeGroup.length === 0) {
        currentMergeGroup.push(block);
        continue;
      }

      const lastBlock = currentMergeGroup[currentMergeGroup.length - 1];
      const shouldMerge = this.shouldMergeBlocks(lastBlock, block, config);

      if (shouldMerge) {
        currentMergeGroup.push(block);
      } else {
        // Finalize current group
        merged.push(this.mergeBlockGroup(currentMergeGroup));
        currentMergeGroup = [block];
      }
    }

    // Don't forget the last group
    if (currentMergeGroup.length > 0) {
      merged.push(this.mergeBlockGroup(currentMergeGroup));
    }

    // Filter out blocks that are too short
    return merged.filter(
      (block) =>
        block.durationSeconds >= config.minBlockDurationSeconds &&
        block.screenshots.length >= config.minScreenshotsPerBlock
    );
  }

  /**
   * Determine if two blocks should be merged
   */
  private shouldMergeBlocks(
    block1: RawExtractedBlock,
    block2: RawExtractedBlock,
    config: BlockMergingConfig
  ): boolean {
    // Same tool = likely same block
    if (block1.primaryTool === block2.primaryTool) {
      // Check temporal gap
      const gapSeconds = this.calculateGapSeconds(block1.endTime, block2.startTime);
      if (gapSeconds <= config.maxGapForMergeSeconds) {
        return true;
      }
    }

    // Same intent + one is very short = consider merging
    if (block1.intentLabel === block2.intentLabel) {
      const shortBlock =
        block1.durationSeconds < 60 || block2.durationSeconds < 60;
      if (shortBlock) {
        return true;
      }
    }

    return false;
  }

  /**
   * Merge a group of blocks into one
   */
  private mergeBlockGroup(blocks: RawExtractedBlock[]): RawExtractedBlock {
    if (blocks.length === 1) {
      return blocks[0];
    }

    // Calculate total duration
    const startTime = blocks[0].startTime;
    const endTime = blocks[blocks.length - 1].endTime;
    const durationSeconds = this.calculateGapSeconds(startTime, endTime);

    // Combine screenshots
    const allScreenshots = blocks.flatMap((b) => b.screenshots);

    // Average confidence
    const avgConfidence =
      blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length;

    // Use most common intent
    const intentCounts = new Map<BlockIntent, number>();
    for (const block of blocks) {
      intentCounts.set(
        block.intentLabel,
        (intentCounts.get(block.intentLabel) || 0) + 1
      );
    }
    const mostCommonIntent = Array.from(intentCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0][0];

    return {
      suggestedName: blocks[0].suggestedName,
      intentLabel: mostCommonIntent,
      confidence: avgConfidence,
      primaryTool: blocks[0].primaryTool,
      screenshots: allScreenshots,
      startTime,
      endTime,
      durationSeconds,
      reasoning: `Merged from ${blocks.length} blocks`,
    };
  }

  /**
   * Normalize app name for consistent grouping
   */
  private normalizeAppName(appName: string): string {
    return appName.toLowerCase().trim().replace(/\s+/g, '_');
  }

  /**
   * Calculate gap in seconds between two timestamps
   */
  private calculateGapSeconds(start: string, end: string): number {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    return Math.max(0, (endMs - startMs) / 1000);
  }
}
