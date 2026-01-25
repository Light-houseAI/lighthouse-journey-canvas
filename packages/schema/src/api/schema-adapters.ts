/**
 * Schema Adapters for V1 ↔ V2 Conversion
 *
 * These functions allow seamless conversion between the chapter-based (V1)
 * and workflow-centric (V2) schema formats for backwards compatibility.
 */

import type {
  SessionSummary,
  SessionSummaryV2,
  SessionChapter,
  WorkflowV2,
  SemanticStep,
  GranularStep,
} from './session.schemas';

/**
 * Calculate total duration from chapters' time_start and time_end
 */
function calculateDurationFromChapters(chapters: SessionChapter[]): number {
  if (!chapters || chapters.length === 0) return 0;

  let totalMinutes = 0;
  for (const chapter of chapters) {
    if (chapter.time_start && chapter.time_end) {
      try {
        const start = parseTimeString(chapter.time_start);
        const end = parseTimeString(chapter.time_end);
        if (start !== null && end !== null) {
          totalMinutes += (end - start) / 60000; // Convert ms to minutes
        }
      } catch {
        // Skip invalid time formats
      }
    }
  }
  return Math.round(totalMinutes);
}

/**
 * Parse time string in HH:MM:SS format to milliseconds from midnight
 */
function parseTimeString(timeStr: string): number | null {
  if (!timeStr) return null;

  // Handle ISO8601 format
  if (timeStr.includes('T') || timeStr.includes('-')) {
    const date = new Date(timeStr);
    return isNaN(date.getTime()) ? null : date.getTime();
  }

  // Handle HH:MM:SS format
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parts[2] ? parseInt(parts[2], 10) : 0;
    if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }
  }
  return null;
}

/**
 * Calculate chapter duration in milliseconds
 */
function calculateChapterDuration(chapter: SessionChapter): number {
  if (!chapter.time_start || !chapter.time_end) return 0;

  const start = parseTimeString(chapter.time_start);
  const end = parseTimeString(chapter.time_end);

  if (start === null || end === null) return 0;
  return Math.max(0, end - start);
}

/**
 * Generate a step hash for comparison signature
 * Creates a normalized string sequence of steps for fuzzy matching
 */
function generateStepHash(steps: GranularStep[]): string {
  if (!steps || steps.length === 0) return 'empty';

  return steps
    .map((step) => {
      // Extract key action words from description
      const desc = (step.description || '').toLowerCase();
      if (desc.includes('search')) return 'search';
      if (desc.includes('copy') || desc.includes('copied')) return 'copy';
      if (desc.includes('paste') || desc.includes('pasted')) return 'paste';
      if (desc.includes('edit') || desc.includes('edited')) return 'edit';
      if (desc.includes('test') || desc.includes('tested')) return 'test';
      if (desc.includes('click') || desc.includes('clicked')) return 'click';
      if (desc.includes('type') || desc.includes('typed')) return 'type';
      if (desc.includes('open') || desc.includes('opened')) return 'open';
      if (desc.includes('close') || desc.includes('closed')) return 'close';
      if (desc.includes('navigate')) return 'navigate';
      if (desc.includes('review')) return 'review';
      if (desc.includes('commit')) return 'commit';
      if (desc.includes('push')) return 'push';
      return 'action';
    })
    .join('->');
}

/**
 * Infer approach from granular steps pattern
 */
function inferApproachFromSteps(steps: GranularStep[]): string {
  if (!steps || steps.length === 0) return 'Unknown';

  const descriptions = steps.map((s) => (s.description || '').toLowerCase());
  const joined = descriptions.join(' ');

  // Detect common patterns
  if (joined.includes('ai') || joined.includes('chatgpt') || joined.includes('claude') || joined.includes('gemini')) {
    return 'Agentic Delegation';
  }
  if (joined.includes('debug') || joined.includes('error') || joined.includes('fix')) {
    return 'Iterative Debugging';
  }
  if (joined.includes('search') || joined.includes('docs') || joined.includes('documentation')) {
    return 'Reference-Based Implementation';
  }
  if (joined.includes('plan') || joined.includes('spec') || joined.includes('breakdown')) {
    return 'Top-Down Planning';
  }

  return 'General Workflow';
}

/**
 * Convert V1 (chapter-based) summary to V2 (workflow-centric) format
 */
export function convertV1ToV2(v1: SessionSummary): SessionSummaryV2 {
  const totalDuration = calculateDurationFromChapters(v1.chapters);

  const workflows: WorkflowV2[] = v1.chapters.map((chapter, idx) => {
    const durationMs = calculateChapterDuration(chapter);
    const stepHash = generateStepHash(chapter.granular_steps || []);
    const approach = inferApproachFromSteps(chapter.granular_steps || []);

    // Convert granular steps to semantic steps
    const semanticSteps: SemanticStep[] = (chapter.granular_steps || []).map((step) => ({
      step_name: step.description?.split(' ').slice(0, 3).join(' ') || 'Action',
      duration_seconds: 30, // Default estimate since V1 doesn't track per-step duration
      tools_involved: step.app ? [step.app] : chapter.primary_app ? [chapter.primary_app] : [],
      description: step.description || '',
      raw_action_count: 1,
    }));

    return {
      id: `wf-legacy-${chapter.chapter_id || idx + 1}`,
      workflow_summary: chapter.summary || chapter.title || '',
      classification: {
        level_1_intent: chapter.title || `Workflow ${idx + 1}`,
        level_2_problem: chapter.summary || '',
        level_3_approach: approach,
        level_4_tools: chapter.primary_app ? [chapter.primary_app] : [],
        level_5_outcome: 'Converted from V1 format',
        workflow_type: 'INTERNALLY_COMPARABLE' as const,
      },
      timestamps: {
        start: chapter.time_start || '',
        end: chapter.time_end || '',
        duration_ms: durationMs,
      },
      comparison_signature: {
        step_hash: stepHash,
        complexity_score: Math.min(10, Math.max(1, (chapter.granular_steps?.length || 1))),
      },
      semantic_steps: semanticSteps,
    };
  });

  return {
    schema_version: 2,
    session_meta: {
      total_duration_minutes: totalDuration,
    },
    workflows,
    highLevelSummary: v1.highLevelSummary,
  };
}

/**
 * Convert V2 (workflow-centric) summary to V1 (chapter-based) format
 * Used for backwards compatibility with older code paths
 */
export function convertV2ToV1(v2: SessionSummaryV2): SessionSummary {
  const chapters: SessionChapter[] = v2.workflows.map((workflow, idx) => {
    // Convert semantic steps back to granular steps
    const granularSteps: GranularStep[] = workflow.semantic_steps.map((step, sIdx) => ({
      step_id: sIdx + 1,
      description: step.description,
      timestamp: '',
      app: step.tools_involved[0] || '',
    }));

    return {
      chapter_id: idx + 1,
      title: workflow.classification.level_1_intent,
      summary: workflow.classification.level_2_problem,
      primary_app: workflow.classification.level_4_tools[0] || null,
      time_start: workflow.timestamps.start,
      time_end: workflow.timestamps.end,
      granular_steps: granularSteps,
    };
  });

  // Generate highLevelSummary from workflow intents if not present
  const highLevelSummary =
    v2.highLevelSummary ||
    v2.workflows.map((w) => w.classification.level_1_intent).join('. ') ||
    'Work session';

  return {
    highLevelSummary,
    chapters,
  };
}

/**
 * Normalize any summary format to V2
 * This is the recommended approach for "on-read migration"
 */
export function normalizeToV2(summary: SessionSummary | SessionSummaryV2): SessionSummaryV2 {
  // Check if already V2
  if ('schema_version' in summary && summary.schema_version === 2) {
    return summary as SessionSummaryV2;
  }
  if ('workflows' in summary && Array.isArray(summary.workflows)) {
    return summary as SessionSummaryV2;
  }

  // Convert from V1
  return convertV1ToV2(summary as SessionSummary);
}

/**
 * Normalize any summary format to V1
 * Used for backwards compatibility with older code paths
 */
export function normalizeToV1(summary: SessionSummary | SessionSummaryV2): SessionSummary {
  // Check if already V1
  if ('chapters' in summary && Array.isArray(summary.chapters) && !('workflows' in summary)) {
    return summary as SessionSummary;
  }

  // Convert from V2
  return convertV2ToV1(summary as SessionSummaryV2);
}
