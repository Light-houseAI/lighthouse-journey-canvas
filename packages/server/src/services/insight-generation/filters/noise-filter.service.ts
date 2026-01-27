/**
 * NoiseFilterService
 * Filters out Slack messages, communication apps, and context switches
 * from session data during insight generation.
 *
 * This ensures that downstream agents focus on meaningful work activities
 * rather than being distracted by communication noise.
 */

import type { NoiseFilterConfig, NoiseAnalysisResult } from '@journey/schema';
import type { UserStep, UserWorkflow, SessionInfo } from '../types.js';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Apps that are considered communication/noise
 * These will be filtered out during insight generation
 */
const DEFAULT_NOISE_APPS = [
  // Messaging
  'Slack',
  'Discord',
  'Microsoft Teams',
  'Teams',
  'Zoom',
  'Google Meet',
  'Meet',
  'Webex',
  'Messages',
  'iMessage',
  'WhatsApp',
  'Telegram',
  'Signal',
  'Skype',
  // Social
  'Twitter',
  'Facebook',
  'Instagram',
  'LinkedIn', // Only when messaging, not job search
  'Reddit',
  // Email (optional - sometimes meaningful)
  // 'Gmail',
  // 'Outlook',
  // 'Mail',
];

/**
 * Patterns that indicate noise/context switches
 */
const DEFAULT_NOISE_PATTERNS = [
  /slack\s*messag/i,
  /discord\s*chat/i,
  /teams\s*message/i,
  /teams\s*chat/i,
  /quick\s*call/i,
  /checking\s*notifications/i,
  /responding\s*to\s*(dm|message)/i,
  /replied\s*to/i,
  /sent\s*a\s*message/i,
  /read(ing)?\s*(a\s*)?(slack|teams|discord)/i,
  /notification/i,
  /ping(ed)?/i,
  /dm('d|ed)?/i,
  /mention(ed)?/i,
  /(joined|left)\s*(a\s*)?(call|meeting|huddle)/i,
  /muted\s*(mic|audio|video)/i,
  /unmuted/i,
  /screen\s*share/i,
  /waiting\s*(room|lobby)/i,
];

/**
 * Minimum step duration (seconds) - steps shorter than this are likely context switches
 */
const DEFAULT_MIN_DURATION_THRESHOLD = 30;

// ============================================================================
// SERVICE
// ============================================================================

export class NoiseFilterService {
  private readonly noiseApps: Set<string>;
  private readonly noisePatterns: RegExp[];
  private readonly minDurationThreshold: number;
  private readonly enabled: boolean;

  constructor(config?: Partial<NoiseFilterConfig>) {
    this.noiseApps = new Set(
      (config?.noiseApps ?? DEFAULT_NOISE_APPS).map((app) => app.toLowerCase())
    );
    this.noisePatterns = config?.noisePatterns ?? DEFAULT_NOISE_PATTERNS;
    this.minDurationThreshold = config?.minDurationThreshold ?? DEFAULT_MIN_DURATION_THRESHOLD;
    this.enabled = config?.enabled ?? true;
  }

  // --------------------------------------------------------------------------
  // PUBLIC METHODS
  // --------------------------------------------------------------------------

  /**
   * Filter noise from session info array
   * Removes noisy steps and recalculates session stats
   */
  filterSessions(sessions: SessionInfo[]): SessionInfo[] {
    if (!this.enabled) {
      return sessions;
    }

    return sessions
      .map((session) => this.filterSession(session))
      .filter((session) => session.workflowCount > 0);
  }

  /**
   * Filter noise from workflow array
   * Removes noisy steps and recalculates workflow stats
   */
  filterWorkflows(workflows: UserWorkflow[]): UserWorkflow[] {
    if (!this.enabled) {
      return workflows;
    }

    return workflows
      .map((workflow) => this.filterWorkflow(workflow))
      .filter((workflow) => workflow.steps.length > 0);
  }

  /**
   * Filter noise from a single workflow
   */
  filterWorkflow(workflow: UserWorkflow): UserWorkflow {
    if (!this.enabled) {
      return workflow;
    }

    const filteredSteps = workflow.steps.filter((step) => !this.isNoiseStep(step));

    return {
      ...workflow,
      steps: filteredSteps,
      totalDurationSeconds: this.calculateTotalDuration(filteredSteps),
      tools: this.extractUniqueTools(filteredSteps),
    };
  }

  /**
   * Check if a single step is noise
   */
  isNoiseStep(step: UserStep): boolean {
    // Check if the app is a noise app
    if (step.app && this.isNoiseApp(step.app)) {
      return true;
    }

    // Check tool category
    if (step.toolCategory === 'communication') {
      return true;
    }

    // Check description against noise patterns
    const description = step.description || '';
    if (this.matchesNoisePattern(description)) {
      return true;
    }

    // Check for brief context switches
    if (
      step.durationSeconds !== undefined &&
      step.durationSeconds < this.minDurationThreshold &&
      this.looksLikeContextSwitch(step)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Analyze noise level in sessions
   * Returns statistics about how much noise was found
   */
  analyzeNoise(sessions: SessionInfo[]): NoiseAnalysisResult {
    let totalSteps = 0;
    let noiseSteps = 0;
    const noiseByApp: Record<string, number> = {};

    for (const session of sessions) {
      // We need to analyze at workflow level since SessionInfo doesn't have steps directly
      // This is a simplified analysis based on apps used
      for (const app of session.appsUsed || []) {
        totalSteps++;
        if (this.isNoiseApp(app)) {
          noiseSteps++;
          noiseByApp[app] = (noiseByApp[app] || 0) + 1;
        }
      }
    }

    const noisePercentage = totalSteps > 0 ? (noiseSteps / totalSteps) * 100 : 0;

    return {
      totalSteps,
      noiseSteps,
      noisePercentage,
      noiseByApp,
      isHighNoise: noisePercentage > 30,
    };
  }

  /**
   * Analyze noise level in workflows (more detailed)
   */
  analyzeWorkflowNoise(workflows: UserWorkflow[]): NoiseAnalysisResult {
    let totalSteps = 0;
    let noiseSteps = 0;
    const noiseByApp: Record<string, number> = {};

    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        totalSteps++;
        if (this.isNoiseStep(step)) {
          noiseSteps++;
          const app = step.app || 'Unknown';
          noiseByApp[app] = (noiseByApp[app] || 0) + 1;
        }
      }
    }

    const noisePercentage = totalSteps > 0 ? (noiseSteps / totalSteps) * 100 : 0;

    return {
      totalSteps,
      noiseSteps,
      noisePercentage,
      noiseByApp,
      isHighNoise: noisePercentage > 30,
    };
  }

  /**
   * Get the list of apps considered as noise
   */
  getNoiseApps(): string[] {
    return Array.from(this.noiseApps);
  }

  /**
   * Check if an app is considered noise
   */
  isNoiseApp(app: string): boolean {
    return this.noiseApps.has(app.toLowerCase());
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------

  /**
   * Filter noise from a single session
   */
  private filterSession(session: SessionInfo): SessionInfo {
    // Filter appsUsed to remove noise apps
    const filteredApps = (session.appsUsed || []).filter((app) => !this.isNoiseApp(app));

    // We can't directly filter steps in SessionInfo since it doesn't contain them
    // The filtering is done at the workflow level
    return {
      ...session,
      appsUsed: filteredApps,
    };
  }

  /**
   * Check if description matches any noise pattern
   */
  private matchesNoisePattern(text: string): boolean {
    return this.noisePatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Check if a step looks like a context switch based on its content
   */
  private looksLikeContextSwitch(step: UserStep): boolean {
    const indicators = [
      'notification',
      'message',
      'alert',
      'ping',
      'quick check',
      'glanced at',
      'opened and closed',
      'switched to',
      'briefly',
      'momentarily',
    ];

    const description = (step.description || '').toLowerCase();
    return indicators.some((ind) => description.includes(ind));
  }

  /**
   * Calculate total duration from filtered steps
   */
  private calculateTotalDuration(steps: UserStep[]): number {
    return steps.reduce((total, step) => total + (step.durationSeconds || 0), 0);
  }

  /**
   * Extract unique tools/apps from steps
   */
  private extractUniqueTools(steps: UserStep[]): string[] {
    const tools = new Set<string>();
    for (const step of steps) {
      if (step.app) {
        tools.add(step.app);
      }
    }
    return Array.from(tools);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a NoiseFilterService with default configuration
 */
export function createNoiseFilterService(
  config?: Partial<NoiseFilterConfig>
): NoiseFilterService {
  return new NoiseFilterService(config);
}

/**
 * Create a disabled NoiseFilterService (passthrough)
 */
export function createPassthroughNoiseFilter(): NoiseFilterService {
  return new NoiseFilterService({ enabled: false });
}
