/**
 * Nano Agent Service
 *
 * Orchestrates flow execution, manages execution sessions,
 * handles Desktop companion communication, and provides SSE streaming.
 *
 * Follows the job-based async pattern from InsightGenerationService.
 */

import { eq, and, desc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../../core/logger.js';
import {
  nanoAgentExecutions,
  nanoAgentFlows,
  NanoAgentExecutionStatus,
} from '@journey/schema';
import type { FlowService } from './flow.service.js';
import type {
  ExecutableAction,
  StepExecutionResult,
  PendingExecutionResponse,
  DesktopStepReport,
  ExecutionSSEEvent,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface NanoAgentServiceDeps {
  logger: Logger;
  database: any;
  flowService: FlowService;
}

/** Listener for execution SSE events */
type ExecutionListener = (event: ExecutionSSEEvent) => void;

// ============================================================================
// SERVICE
// ============================================================================

export class NanoAgentService {
  private logger: Logger;
  private db: any;
  private flowService: FlowService;

  /** In-memory listeners for active execution SSE streams */
  private executionListeners: Map<string, Set<ExecutionListener>> = new Map();

  constructor({ logger, database, flowService }: NanoAgentServiceDeps) {
    this.logger = logger;
    this.db = database;
    this.flowService = flowService;
  }

  /**
   * Start a new execution of a flow
   */
  async startExecution(flowId: string, userId: number): Promise<{ executionId: string }> {
    // Fetch the flow
    const flow = await this.flowService.getFlow(flowId, userId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }

    const actions = flow.actions as unknown as ExecutableAction[];
    if (!actions || actions.length === 0) {
      throw new Error('Flow has no actions to execute');
    }

    // Abort ALL stale pending/running executions for this user (any flow).
    // This prevents old executions from blocking the Desktop companion.
    await this.db
      .update(nanoAgentExecutions)
      .set({ status: NanoAgentExecutionStatus.Aborted, completedAt: new Date() })
      .where(
        and(
          eq(nanoAgentExecutions.userId, userId),
          inArray(nanoAgentExecutions.status, [
            NanoAgentExecutionStatus.Pending,
            NanoAgentExecutionStatus.Running,
          ])
        )
      );

    // Create execution record
    const executionId = uuidv4();
    const stepResults: StepExecutionResult[] = actions.map((action) => ({
      actionId: action.actionId,
      status: 'pending' as const,
      executedAt: null,
      durationMs: null,
      verificationScreenshotUrl: null,
      error: null,
      userNote: null,
    }));

    await this.db.insert(nanoAgentExecutions).values({
      id: executionId,
      flowId,
      userId,
      status: NanoAgentExecutionStatus.Pending,
      currentStep: 0,
      totalSteps: actions.length,
      stepResults: stepResults as any,
      startedAt: new Date(),
    });

    // Record on the flow
    await this.flowService.recordExecution(flowId);

    this.logger.info('[NanoAgentService] Execution started', {
      executionId,
      flowId,
      totalSteps: actions.length,
    });

    return { executionId };
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string, userId: number): Promise<any | null> {
    const [execution] = await this.db
      .select()
      .from(nanoAgentExecutions)
      .where(and(eq(nanoAgentExecutions.id, executionId), eq(nanoAgentExecutions.userId, userId)))
      .limit(1);

    return execution || null;
  }

  /**
   * Get pending execution for Desktop companion polling.
   * Returns the newest pending execution for this user (most recent "Run" click).
   */
  async getDesktopPending(userId: number): Promise<PendingExecutionResponse> {
    const [execution] = await this.db
      .select()
      .from(nanoAgentExecutions)
      .where(
        and(
          eq(nanoAgentExecutions.userId, userId),
          eq(nanoAgentExecutions.status, NanoAgentExecutionStatus.Pending)
        )
      )
      .orderBy(desc(nanoAgentExecutions.createdAt))
      .limit(1);

    if (!execution) return null;

    // Fetch the flow to get actions
    const [flow] = await this.db
      .select()
      .from(nanoAgentFlows)
      .where(eq(nanoAgentFlows.id, execution.flowId))
      .limit(1);

    if (!flow) return null;

    // Mark as running
    await this.db
      .update(nanoAgentExecutions)
      .set({ status: NanoAgentExecutionStatus.Running })
      .where(eq(nanoAgentExecutions.id, execution.id));

    // Notify SSE listeners that Desktop companion picked up the execution
    this.emitEvent(execution.id, {
      type: 'execution_running',
    });

    return {
      executionId: execution.id,
      flowId: flow.id,
      flowName: flow.name,
      actions: flow.actions as unknown as ExecutableAction[],
      currentStep: execution.currentStep,
      totalSteps: execution.totalSteps,
    };
  }

  /**
   * Confirm current step for execution (user approval)
   */
  async confirmStep(executionId: string, userId: number): Promise<boolean> {
    const execution = await this.getExecution(executionId, userId);
    if (!execution || execution.status !== NanoAgentExecutionStatus.Running) return false;

    const stepResults = [...(execution.stepResults as StepExecutionResult[])];
    const currentIndex = execution.currentStep;

    if (currentIndex >= stepResults.length) return false;

    stepResults[currentIndex] = {
      ...stepResults[currentIndex],
      status: 'confirmed',
    };

    await this.db
      .update(nanoAgentExecutions)
      .set({ stepResults: stepResults as any })
      .where(eq(nanoAgentExecutions.id, executionId));

    this.emitEvent(executionId, { type: 'step_confirmed', step: currentIndex });
    return true;
  }

  /**
   * Skip current step
   */
  async skipStep(executionId: string, userId: number): Promise<boolean> {
    const execution = await this.getExecution(executionId, userId);
    if (!execution || execution.status !== NanoAgentExecutionStatus.Running) return false;

    const stepResults = [...(execution.stepResults as StepExecutionResult[])];
    const currentIndex = execution.currentStep;

    if (currentIndex >= stepResults.length) return false;

    stepResults[currentIndex] = {
      ...stepResults[currentIndex],
      status: 'skipped',
    };

    const nextStep = currentIndex + 1;
    const isComplete = nextStep >= execution.totalSteps;

    await this.db
      .update(nanoAgentExecutions)
      .set({
        stepResults: stepResults as any,
        currentStep: nextStep,
        ...(isComplete
          ? { status: NanoAgentExecutionStatus.Completed, completedAt: new Date() }
          : {}),
      })
      .where(eq(nanoAgentExecutions.id, executionId));

    this.emitEvent(executionId, { type: 'step_skipped', step: currentIndex });
    if (isComplete) {
      this.emitEvent(executionId, { type: 'execution_completed' });
      this.cleanupListeners(executionId);
    }

    return true;
  }

  /**
   * Abort execution
   */
  async abortExecution(executionId: string, userId: number): Promise<boolean> {
    const execution = await this.getExecution(executionId, userId);
    if (!execution) return false;

    await this.db
      .update(nanoAgentExecutions)
      .set({
        status: NanoAgentExecutionStatus.Aborted,
        completedAt: new Date(),
      })
      .where(eq(nanoAgentExecutions.id, executionId));

    this.emitEvent(executionId, { type: 'execution_aborted' });
    this.cleanupListeners(executionId);
    return true;
  }

  /**
   * Handle step report from Desktop companion
   */
  async handleDesktopReport(report: DesktopStepReport, userId: number): Promise<boolean> {
    const execution = await this.getExecution(report.executionId, userId);
    if (!execution || execution.status !== NanoAgentExecutionStatus.Running) return false;

    const stepResults = [...(execution.stepResults as StepExecutionResult[])];
    const stepIndex = stepResults.findIndex((s) => s.actionId === report.actionId);
    if (stepIndex === -1) return false;

    stepResults[stepIndex] = {
      actionId: report.actionId,
      status: report.status === 'completed' ? 'completed' : report.status === 'skipped' ? 'skipped' : 'failed',
      executedAt: new Date().toISOString(),
      durationMs: report.durationMs || null,
      verificationScreenshotUrl: report.verificationScreenshotUrl || null,
      error: report.error || null,
      userNote: report.userNote || null,
    };

    const nextStep = execution.currentStep + 1;
    const isComplete = nextStep >= execution.totalSteps;
    const isFailed = report.status === 'failed';

    await this.db
      .update(nanoAgentExecutions)
      .set({
        stepResults: stepResults as any,
        currentStep: isFailed ? execution.currentStep : nextStep,
        ...(isComplete && !isFailed
          ? { status: NanoAgentExecutionStatus.Completed, completedAt: new Date() }
          : {}),
        ...(isFailed ? { error: report.error } : {}),
      })
      .where(eq(nanoAgentExecutions.id, report.executionId));

    // Emit SSE events
    if (report.status === 'completed') {
      this.emitEvent(report.executionId, {
        type: 'step_completed',
        step: stepIndex,
        result: stepResults[stepIndex],
      });
    } else if (report.status === 'failed') {
      this.emitEvent(report.executionId, {
        type: 'step_failed',
        step: stepIndex,
        error: report.error || 'Unknown error',
      });
    }

    if (isComplete && !isFailed) {
      this.emitEvent(report.executionId, { type: 'execution_completed' });
      this.cleanupListeners(report.executionId);
    }

    return true;
  }

  // ============================================================================
  // SSE STREAMING
  // ============================================================================

  /**
   * Subscribe to execution events
   */
  addListener(executionId: string, listener: ExecutionListener): void {
    if (!this.executionListeners.has(executionId)) {
      this.executionListeners.set(executionId, new Set());
    }
    this.executionListeners.get(executionId)!.add(listener);
  }

  /**
   * Unsubscribe from execution events
   */
  removeListener(executionId: string, listener: ExecutionListener): void {
    const listeners = this.executionListeners.get(executionId);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.executionListeners.delete(executionId);
      }
    }
  }

  private emitEvent(executionId: string, event: ExecutionSSEEvent): void {
    const listeners = this.executionListeners.get(executionId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (err) {
          this.logger.error('[NanoAgentService] SSE listener error', err instanceof Error ? err : new Error(String(err)));
        }
      }
    }
  }

  private cleanupListeners(executionId: string): void {
    this.executionListeners.delete(executionId);
  }
}
