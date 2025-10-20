import type { Logger } from '../../core/logger';
import { DEFAULT_CONFIG } from './config';
import { CareerStep, CareerTrajectory } from './types';

/**
 * Extracts ordered career sequences from timeline nodes
 */
export class CareerSequenceExtractor {
  private readonly timeWindowYears: number;
  private readonly logger: Logger;

  constructor(
    timeWindowYears: number = DEFAULT_CONFIG.timeWindowYears,
    logger: Logger
  ) {
    this.timeWindowYears = timeWindowYears;
    this.logger = logger;
  }

  /**
   * Extract career trajectory from timeline nodes
   *
   * @param nodes - Timeline nodes (jobs, education, projects)
   * @param targetCompany - Optional target company filter
   * @param targetRole - Optional target role filter
   * @param resolveConcurrent - Whether to resolve concurrent/overlapping roles (default: true)
   * @returns Ordered career trajectory
   */
  extractTrajectory(
    nodes: any[],
    targetCompany?: string,
    targetRole?: string,
    resolveConcurrent: boolean = true
  ): CareerTrajectory {
    this.logger.debug('🔍 CareerSequenceExtractor: Input nodes', {
      totalNodes: nodes.length,
      nodeTypes: nodes.map((n) => n.type),
      hasStartDate: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        hasStart: !!n.startDate,
      })),
    });

    // Filter to relevant node types
    const relevantNodes = nodes.filter((node) =>
      ['job', 'education', 'career-transition'].includes(node.type)
    );

    this.logger.debug('🔍 After type filter:', {
      relevantCount: relevantNodes.length,
      types: relevantNodes.map((n) => n.type),
    });

    // Convert to CareerSteps
    const steps = relevantNodes
      .map((node) => this.nodeToCareerStep(node))
      .filter((step): step is CareerStep => step !== null);

    this.logger.debug('🔍 After conversion:', {
      stepsCount: steps.length,
      stepTypes: steps.map((s) => s.type),
    });

    // Apply time window filter
    const windowedSteps = this.filterByTimeWindow(steps);

    this.logger.debug('🔍 After time window filter:', {
      windowedCount: windowedSteps.length,
      timeWindowYears: this.timeWindowYears,
      cutoffDate: new Date(
        new Date().setFullYear(new Date().getFullYear() - this.timeWindowYears)
      ),
    });

    // Sort chronologically
    const sortedSteps = this.sortChronologically(windowedSteps);

    // Optionally resolve concurrent roles (select longest duration from overlapping positions)
    const finalSteps = resolveConcurrent
      ? this.resolveConcurrentRoles(sortedSteps)
      : sortedSteps;

    return {
      userId: 0, // Will be set by caller
      steps: finalSteps,
      targetCompany,
      targetRole,
    };
  }

  /**
   * Convert timeline node to CareerStep
   */
  private nodeToCareerStep(node: any): CareerStep | null {
    // Require startDate (check both node.startDate and node.meta.startDate)
    const startDateValue = node.startDate || node.meta?.startDate;
    if (!startDateValue) {
      return null;
    }

    const startDate = new Date(startDateValue);
    const endDateValue = node.endDate || node.meta?.endDate;
    const endDate = endDateValue ? new Date(endDateValue) : undefined;

    // Calculate duration in months
    const duration = this.calculateDuration(startDate, endDate);

    const baseStep = {
      startDate,
      endDate,
      duration,
    };

    // Type-specific extraction
    switch (node.type) {
      case 'job':
        return {
          ...baseStep,
          type: 'job',
          role: node.title || node.role || node.meta?.title || node.meta?.role,
          company:
            node.company ||
            node.organization ||
            node.meta?.company ||
            node.meta?.organization,
        };

      case 'education':
        return {
          ...baseStep,
          type: 'education',
          degree: node.degree || node.meta?.degree,
          field:
            node.field || node.major || node.meta?.field || node.meta?.major,
          institution:
            node.institution ||
            node.school ||
            node.meta?.institution ||
            node.meta?.school,
        };

      case 'career-transition':
        return {
          ...baseStep,
          type: 'career-transition',
          description: node.description || node.meta?.description,
          title: node.title || node.meta?.title,
          // Career transitions may have associated company/role if they represent a target
          role: node.meta?.targetRole,
          company: node.meta?.targetCompany,
        };

      default:
        return null;
    }
  }

  /**
   * Calculate duration in months between two dates
   */
  private calculateDuration(startDate: Date, endDate?: Date): number {
    const end = endDate || new Date(); // Use current date if ongoing
    const diffMs = end.getTime() - startDate.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44); // Average month
    return Math.max(0, Math.round(diffMonths));
  }

  /**
   * Filter steps to time window
   */
  private filterByTimeWindow(steps: CareerStep[]): CareerStep[] {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - this.timeWindowYears);

    return steps.filter((step) => step.startDate >= cutoffDate);
  }

  /**
   * Sort steps chronologically
   */
  private sortChronologically(steps: CareerStep[]): CareerStep[] {
    return steps.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  /**
   * Handle concurrent roles by selecting most relevant
   * For now, selects longest duration
   */
  resolveConcurrentRoles(steps: CareerStep[]): CareerStep[] {
    const resolved: CareerStep[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < steps.length; i++) {
      if (processed.has(i)) continue;

      const current = steps[i];
      const concurrent: CareerStep[] = [current];

      // Find overlapping steps
      for (let j = i + 1; j < steps.length; j++) {
        if (processed.has(j)) continue;

        const other = steps[j];
        if (this.isOverlapping(current, other)) {
          concurrent.push(other);
          processed.add(j);
        }
      }

      // Select longest duration from concurrent roles
      const selected = concurrent.reduce((longest, step) =>
        step.duration > longest.duration ? step : longest
      );

      resolved.push(selected);
      processed.add(i);
    }

    return resolved;
  }

  /**
   * Check if two career steps overlap in time
   * Jobs that end exactly when another starts are NOT considered overlapping
   */
  private isOverlapping(step1: CareerStep, step2: CareerStep): boolean {
    const end1 = step1.endDate || new Date();
    const end2 = step2.endDate || new Date();

    // Use < instead of <= to exclude boundary-touching positions
    return step1.startDate < end2 && step2.startDate < end1;
  }
}
