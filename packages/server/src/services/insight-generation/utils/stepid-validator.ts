/**
 * StepId Validation Utility
 *
 * Validates and normalizes stepIds from LLM responses to ensure they match
 * actual workflow step IDs. LLMs often hallucinate stepIds or return them
 * in incorrect formats, causing empty/broken step transformation cards.
 *
 * This utility provides:
 * 1. Exact match validation
 * 2. Format normalization (removes brackets, whitespace)
 * 3. Index-based fallback (maps "1", "2" to actual stepIds)
 * 4. Fuzzy matching by app/tool name
 */

import type { Logger } from '../../../core/logger.js';

export interface WorkflowStep {
  stepId: string;
  app?: string;
  tool?: string;
  description?: string;
  durationSeconds?: number;
}

export interface StepIdValidationResult {
  validStepIds: string[];
  invalidStepIds: string[];
  mappedStepIds: Map<string, string>; // original -> validated
  warnings: string[];
}

/**
 * Validate and normalize stepIds from LLM response against actual workflow steps.
 *
 * @param llmStepIds - Array of stepIds returned by the LLM
 * @param workflowSteps - Actual workflow steps with valid stepIds
 * @param logger - Optional logger for debugging
 * @returns Validation result with valid, invalid, and mapped stepIds
 */
export function validateStepIds(
  llmStepIds: string[],
  workflowSteps: WorkflowStep[],
  logger?: Logger
): StepIdValidationResult {
  const result: StepIdValidationResult = {
    validStepIds: [],
    invalidStepIds: [],
    mappedStepIds: new Map(),
    warnings: [],
  };

  if (!llmStepIds || llmStepIds.length === 0) {
    return result;
  }

  if (!workflowSteps || workflowSteps.length === 0) {
    result.warnings.push('No workflow steps provided for validation');
    result.invalidStepIds = [...llmStepIds];
    return result;
  }

  // Build lookup structures
  const validIdSet = new Set(workflowSteps.map((s) => s.stepId));
  const stepByIndex = new Map<string, string>(); // "1" -> stepId, "2" -> stepId
  const stepByApp = new Map<string, string[]>(); // "vscode" -> [stepId1, stepId2]

  workflowSteps.forEach((step, index) => {
    // Index mapping (1-based to match LLM output format)
    stepByIndex.set(String(index + 1), step.stepId);

    // App/tool mapping for fuzzy matching
    const appKey = (step.app || step.tool || '').toLowerCase().trim();
    if (appKey) {
      if (!stepByApp.has(appKey)) {
        stepByApp.set(appKey, []);
      }
      stepByApp.get(appKey)!.push(step.stepId);
    }
  });

  for (const rawId of llmStepIds) {
    // Normalize the stepId (remove brackets, whitespace)
    const normalizedId = normalizeStepId(rawId);

    // Strategy 1: Exact match
    if (validIdSet.has(normalizedId)) {
      result.validStepIds.push(normalizedId);
      result.mappedStepIds.set(rawId, normalizedId);
      continue;
    }

    // Strategy 2: Original ID matches (in case normalization was wrong)
    if (validIdSet.has(rawId)) {
      result.validStepIds.push(rawId);
      result.mappedStepIds.set(rawId, rawId);
      continue;
    }

    // Strategy 3: Index-based mapping (LLM returned "1", "2", etc.)
    const indexMatch = stepByIndex.get(normalizedId);
    if (indexMatch) {
      result.validStepIds.push(indexMatch);
      result.mappedStepIds.set(rawId, indexMatch);
      result.warnings.push(`Mapped index "${rawId}" to stepId "${indexMatch}"`);
      continue;
    }

    // Strategy 4: Fuzzy match by app/tool name
    const appMatch = stepByApp.get(normalizedId.toLowerCase());
    if (appMatch && appMatch.length > 0) {
      const matchedId = appMatch[0]; // Use first match
      result.validStepIds.push(matchedId);
      result.mappedStepIds.set(rawId, matchedId);
      result.warnings.push(`Fuzzy matched "${rawId}" to stepId "${matchedId}" by app name`);
      continue;
    }

    // No match found
    result.invalidStepIds.push(rawId);
  }

  // Log validation results if logger provided
  if (logger && (result.invalidStepIds.length > 0 || result.warnings.length > 0)) {
    logger.warn('StepId validation completed with issues', {
      totalInput: llmStepIds.length,
      validCount: result.validStepIds.length,
      invalidCount: result.invalidStepIds.length,
      invalidIds: result.invalidStepIds,
      warnings: result.warnings,
    });
  }

  return result;
}

/**
 * Normalize a stepId by removing common LLM formatting artifacts.
 * LLMs often return stepIds with brackets, quotes, or extra whitespace.
 */
function normalizeStepId(stepId: string): string {
  if (!stepId) return '';

  return stepId
    .trim()
    // Remove surrounding brackets: [step-abc] -> step-abc
    .replace(/^\[(.+)\]$/, '$1')
    // Remove surrounding quotes: "step-abc" -> step-abc
    .replace(/^["'](.+)["']$/, '$1')
    // Remove common prefixes LLMs add: "Step: abc" -> abc
    .replace(/^step[:\s]+/i, '')
    .trim();
}

/**
 * Validate stepIds and return only the valid ones, using fallback strategies.
 * This is the simplified API for common use cases.
 *
 * @param llmStepIds - StepIds from LLM response
 * @param workflowSteps - Actual workflow steps
 * @param logger - Optional logger
 * @returns Array of validated stepIds (may be empty if all invalid)
 */
export function getValidatedStepIds(
  llmStepIds: string[],
  workflowSteps: WorkflowStep[],
  logger?: Logger
): string[] {
  const result = validateStepIds(llmStepIds, workflowSteps, logger);
  return result.validStepIds;
}

/**
 * Validate stepIds with a fallback to use all workflow steps if none are valid.
 * Useful when the LLM failed to provide valid IDs but we still want to show something.
 *
 * @param llmStepIds - StepIds from LLM response
 * @param workflowSteps - Actual workflow steps
 * @param maxFallbackSteps - Maximum number of steps to use as fallback (default: 3)
 * @param logger - Optional logger
 * @returns Array of validated stepIds, or fallback stepIds from workflow
 */
export function getValidatedStepIdsWithFallback(
  llmStepIds: string[],
  workflowSteps: WorkflowStep[],
  maxFallbackSteps: number = 3,
  logger?: Logger
): string[] {
  const validated = getValidatedStepIds(llmStepIds, workflowSteps, logger);

  if (validated.length > 0) {
    return validated;
  }

  // Fallback: use first N steps from workflow
  if (workflowSteps && workflowSteps.length > 0) {
    const fallbackIds = workflowSteps.slice(0, maxFallbackSteps).map((s) => s.stepId);
    logger?.info('StepId validation: using fallback steps', {
      originalIds: llmStepIds,
      fallbackIds,
    });
    return fallbackIds;
  }

  return [];
}
