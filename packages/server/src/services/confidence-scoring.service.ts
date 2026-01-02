/**
 * Confidence Scoring Service
 *
 * Calculates confidence scores for Blocks and Steps based on multiple factors:
 * - Extraction source (OCR, LLM, UI events)
 * - Screenshot quality
 * - Temporal consistency
 * - Tool recognition
 * - Semantic coherence
 */

import {
  ExtractionMethod,
  type ConfidenceFactors,
  type RawExtractedBlock,
  type BlockNode,
  type RawExtractedStep,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Base confidence scores by extraction source
 */
const EXTRACTION_SOURCE_SCORES: Record<ExtractionMethod, number> = {
  [ExtractionMethod.UiEvent]: 0.95,      // Direct UI events are most reliable
  [ExtractionMethod.ChapterMatch]: 0.85,  // Desktop app chapters are good
  [ExtractionMethod.LlmInference]: 0.75,  // LLM extraction is decent
  [ExtractionMethod.Ocr]: 0.60,           // OCR alone is least reliable
};

/**
 * Weights for confidence factors
 */
const CONFIDENCE_WEIGHTS = {
  extractionSource: 0.25,
  screenshotQuality: 0.15,
  temporalConsistency: 0.20,
  toolRecognition: 0.15,
  semanticCoherence: 0.25,
};

/**
 * Reliability scores by step action type
 */
const ACTION_TYPE_RELIABILITY: Record<string, number> = {
  file_saved: 0.95,
  command_executed: 0.90,
  button_clicked: 0.85,
  prompt_entered: 0.85,
  file_opened: 0.80,
  text_pasted: 0.80,
  tab_switched: 0.75,
  text_selected: 0.70,
  shortcut_used: 0.75,
  menu_selected: 0.80,
  dialog_interaction: 0.75,
  scroll_action: 0.60,
};

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class ConfidenceScoringService {
  private logger: Logger;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
  }

  /**
   * Calculate confidence score for a Block
   */
  calculateBlockConfidence(
    block: RawExtractedBlock,
    factors: Partial<ConfidenceFactors>
  ): number {
    const scores = {
      extractionSource:
        EXTRACTION_SOURCE_SCORES[factors.extractionSource || ExtractionMethod.LlmInference],
      screenshotQuality: factors.screenshotQuality ?? 0.8,
      temporalConsistency: factors.temporalConsistency ?? 0.8,
      toolRecognition: factors.toolRecognition ?? 0.85,
      semanticCoherence: factors.semanticCoherence ?? 0.8,
    };

    // Weighted average
    let confidence = 0;
    for (const [factor, weight] of Object.entries(CONFIDENCE_WEIGHTS)) {
      confidence += scores[factor as keyof typeof scores] * weight;
    }

    // Apply occurrence boost (more occurrences = higher confidence)
    // This uses a logarithmic scale to prevent runaway scores
    const screenshotCount = block.screenshots?.length || 1;
    const occurrenceBoost = Math.min(0.1, Math.log10(screenshotCount + 1) * 0.05);

    const finalConfidence = Math.min(1.0, confidence + occurrenceBoost);

    this.logger.debug('Calculated block confidence', {
      blockName: block.suggestedName,
      scores,
      occurrenceBoost,
      finalConfidence,
    });

    return finalConfidence;
  }

  /**
   * Calculate confidence score for a Step
   */
  calculateStepConfidence(
    step: RawExtractedStep,
    parentBlock: BlockNode
  ): number {
    // Steps inherit some confidence from their parent block
    const blockInheritance = parentBlock.confidence * 0.3;

    // Action type reliability
    const actionScore = ACTION_TYPE_RELIABILITY[step.actionType] || 0.7;

    // Screenshot evidence boost
    const evidenceBoost = step.screenshotIndex ? 0.1 : 0;

    // Raw input presence boost (we can verify what was typed)
    const inputBoost = step.rawInput ? 0.05 : 0;

    const confidence = Math.min(
      1.0,
      blockInheritance + actionScore * 0.5 + evidenceBoost + inputBoost
    );

    this.logger.debug('Calculated step confidence', {
      actionType: step.actionType,
      blockConfidence: parentBlock.confidence,
      blockInheritance,
      actionScore,
      evidenceBoost,
      inputBoost,
      finalConfidence: confidence,
    });

    return confidence;
  }

  /**
   * Assess screenshot quality based on various heuristics
   */
  assessScreenshotQuality(screenshot: {
    summary?: string | null;
    analysis?: string | null;
    appName?: string;
  }): number {
    let score = 0.7; // Base score

    // Has summary = better quality
    if (screenshot.summary && screenshot.summary.length > 50) {
      score += 0.1;
    }

    // Has detailed analysis = better quality
    if (screenshot.analysis && screenshot.analysis.length > 100) {
      score += 0.1;
    }

    // Has recognized app = better quality
    if (screenshot.appName && screenshot.appName.length > 0) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Assess temporal consistency of a block
   * Higher score = more consistent timing
   */
  assessTemporalConsistency(
    screenshots: Array<{ timestamp: string }>
  ): number {
    if (screenshots.length < 2) {
      return 0.9; // Single screenshot = assume consistent
    }

    // Calculate time gaps between consecutive screenshots
    const gaps: number[] = [];
    for (let i = 1; i < screenshots.length; i++) {
      const prevTime = new Date(screenshots[i - 1].timestamp).getTime();
      const currTime = new Date(screenshots[i].timestamp).getTime();
      gaps.push((currTime - prevTime) / 1000); // in seconds
    }

    // Calculate variance in gaps
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = more consistent = higher score
    // If stdDev > 60 seconds, consistency drops
    const consistency = Math.max(0.5, 1.0 - stdDev / 120);

    return consistency;
  }

  /**
   * Assess semantic coherence of a block description
   */
  assessSemanticCoherence(block: {
    suggestedName: string;
    intentLabel: string;
    primaryTool: string;
    reasoning?: string;
  }): number {
    let score = 0.7; // Base score

    // Has meaningful name (not too short, not too long)
    const nameLength = block.suggestedName.length;
    if (nameLength >= 10 && nameLength <= 50) {
      score += 0.1;
    }

    // Has reasoning provided
    if (block.reasoning && block.reasoning.length > 20) {
      score += 0.1;
    }

    // Intent matches common patterns
    const validIntents = [
      'ai_prompt',
      'code_edit',
      'code_review',
      'terminal_command',
      'file_navigation',
      'web_research',
      'git_operation',
      'documentation',
      'testing',
      'debugging',
      'communication',
    ];

    if (validIntents.includes(block.intentLabel)) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate overall confidence for a workflow pattern
   */
  calculatePatternConfidence(
    blocks: BlockNode[],
    sessionCount: number,
    occurrenceCount: number
  ): number {
    if (blocks.length === 0) {
      return 0;
    }

    // Average block confidence
    const avgBlockConfidence =
      blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length;

    // Session diversity boost (seen in more sessions = more reliable)
    const sessionBoost = Math.min(0.15, Math.log10(sessionCount + 1) * 0.1);

    // Occurrence boost
    const occurrenceBoost = Math.min(0.1, Math.log10(occurrenceCount + 1) * 0.05);

    // Pattern length penalty (very long patterns are less reliable)
    const lengthPenalty = blocks.length > 10 ? (blocks.length - 10) * 0.02 : 0;

    const confidence = Math.min(
      1.0,
      Math.max(0.0, avgBlockConfidence + sessionBoost + occurrenceBoost - lengthPenalty)
    );

    this.logger.debug('Calculated pattern confidence', {
      blockCount: blocks.length,
      avgBlockConfidence,
      sessionBoost,
      occurrenceBoost,
      lengthPenalty,
      finalConfidence: confidence,
    });

    return confidence;
  }

  /**
   * Determine if a block has sufficient confidence for inclusion
   */
  meetsConfidenceThreshold(confidence: number, threshold: number = 0.6): boolean {
    return confidence >= threshold;
  }

  /**
   * Get confidence level label for display
   */
  getConfidenceLabel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Calculate combined factors for a block
   */
  calculateBlockFactors(
    block: RawExtractedBlock,
    extractionMethod: ExtractionMethod = ExtractionMethod.LlmInference
  ): ConfidenceFactors {
    const screenshotQuality = block.screenshots?.length
      ? block.screenshots.reduce(
          (sum, s) =>
            sum +
            this.assessScreenshotQuality({
              summary: s.summary,
              appName: s.appName,
            }),
          0
        ) / block.screenshots.length
      : 0.7;

    const temporalConsistency = block.screenshots?.length
      ? this.assessTemporalConsistency(block.screenshots)
      : 0.8;

    const semanticCoherence = this.assessSemanticCoherence(block);

    // Tool recognition is 1.0 if tool is known, lower otherwise
    const toolRecognition = block.primaryTool ? 0.9 : 0.6;

    return {
      extractionSource: extractionMethod,
      screenshotQuality,
      temporalConsistency,
      toolRecognition,
      semanticCoherence,
    };
  }
}
