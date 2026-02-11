/**
 * Nano Agent Controller
 *
 * Handles HTTP requests for nano agent flows, action generation, and execution.
 */

import type { Request, Response } from 'express';
import type { Logger } from '../core/logger.js';
import type { ActionPlanGeneratorService } from '../services/nano-agent/action-plan-generator.service.js';
import type { FlowService } from '../services/nano-agent/flow.service.js';
import type { NanoAgentService } from '../services/nano-agent/nano-agent.service.js';
import {
  generateActionsFromNLRequestSchema,
  generateActionsFromWorkflowRequestSchema,
  createFlowRequestSchema,
  updateFlowRequestSchema,
  shareFlowRequestSchema,
  desktopStepReportSchema,
  listFlowsQuerySchema,
} from '../services/nano-agent/schemas.js';

export interface NanoAgentControllerDeps {
  logger: Logger;
  actionPlanGeneratorService: ActionPlanGeneratorService;
  flowService: FlowService;
  nanoAgentService: NanoAgentService;
}

export class NanoAgentController {
  private logger: Logger;
  private actionPlanGenerator: ActionPlanGeneratorService;
  private flowService: FlowService;
  private nanoAgentService: NanoAgentService;

  constructor({
    logger,
    actionPlanGeneratorService,
    flowService,
    nanoAgentService,
  }: NanoAgentControllerDeps) {
    this.logger = logger;
    this.actionPlanGenerator = actionPlanGeneratorService;
    this.flowService = flowService;
    this.nanoAgentService = nanoAgentService;
  }

  // ============================================================================
  // ACTION GENERATION
  // ============================================================================

  async generateActionsFromNL(req: Request, res: Response): Promise<void> {
    try {
      const body = generateActionsFromNLRequestSchema.parse(req.body);
      const actions = await this.actionPlanGenerator.generateFromNaturalLanguage(body);
      res.json({ success: true, data: { actions } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] generateActionsFromNL failed', error instanceof Error ? error : new Error(String(error)));
      res.status(error.name === 'ZodError' ? 400 : 500).json({
        error: error.message || 'Failed to generate actions',
      });
    }
  }

  async generateActionsFromWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const body = generateActionsFromWorkflowRequestSchema.parse(req.body);
      // For now, return a placeholder - full workflow fetching will be wired up
      // when hierarchical services are connected
      const actions = await this.actionPlanGenerator.generateFromNaturalLanguage({
        steps: [`Execute workflow pattern ${body.workflowPatternId}`],
        context: 'Imported from workflow pattern',
      });
      res.json({ success: true, data: { actions } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] generateActionsFromWorkflow failed', error instanceof Error ? error : new Error(String(error)));
      res.status(error.name === 'ZodError' ? 400 : 500).json({
        error: error.message || 'Failed to generate actions from workflow',
      });
    }
  }

  // ============================================================================
  // FLOW CRUD
  // ============================================================================

  async createFlow(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const body = createFlowRequestSchema.parse(req.body);
      const flow = await this.flowService.createFlow(userId, body);
      res.status(201).json({ success: true, data: { flow } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] createFlow failed', error instanceof Error ? error : new Error(String(error)));
      res.status(error.name === 'ZodError' ? 400 : 500).json({
        error: error.message || 'Failed to create flow',
      });
    }
  }

  async getFlow(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { flowId } = req.params;
      const flow = await this.flowService.getFlow(flowId, userId);
      if (!flow) {
        res.status(404).json({ error: 'Flow not found' });
        return;
      }
      res.json({ success: true, data: { flow } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] getFlow failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: error.message || 'Failed to get flow' });
    }
  }

  async listFlows(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const query = listFlowsQuerySchema.parse(req.query);
      const tags = query.tags ? query.tags.split(',').map((t) => t.trim()) : undefined;
      const userOrgIds: number[] = (req as any).userOrgIds || [];

      const result = await this.flowService.listFlows(userId, userOrgIds, {
        search: query.search,
        tags,
        includeShared: query.includeShared === 'true',
        limit: parseInt(query.limit, 10),
        offset: parseInt(query.offset, 10),
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] listFlows failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: error.message || 'Failed to list flows' });
    }
  }

  async updateFlow(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { flowId } = req.params;
      const body = updateFlowRequestSchema.parse(req.body);
      const flow = await this.flowService.updateFlow(flowId, userId, body);
      if (!flow) {
        res.status(404).json({ error: 'Flow not found or not owned by you' });
        return;
      }
      res.json({ success: true, data: { flow } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] updateFlow failed', error instanceof Error ? error : new Error(String(error)));
      res.status(error.name === 'ZodError' ? 400 : 500).json({
        error: error.message || 'Failed to update flow',
      });
    }
  }

  async deleteFlow(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { flowId } = req.params;
      const deleted = await this.flowService.deleteFlow(flowId, userId);
      if (!deleted) {
        res.status(404).json({ error: 'Flow not found or not owned by you' });
        return;
      }
      res.json({ success: true, data: { deleted: true } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] deleteFlow failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: error.message || 'Failed to delete flow' });
    }
  }

  async shareFlow(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { flowId } = req.params;
      const body = shareFlowRequestSchema.parse(req.body);
      const flow = await this.flowService.shareWithOrg(flowId, userId, body.orgId);
      if (!flow) {
        res.status(404).json({ error: 'Flow not found or not owned by you' });
        return;
      }
      res.json({ success: true, data: { flow } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] shareFlow failed', error instanceof Error ? error : new Error(String(error)));
      res.status(error.name === 'ZodError' ? 400 : 500).json({
        error: error.message || 'Failed to share flow',
      });
    }
  }

  async forkFlow(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { flowId } = req.params;
      const flow = await this.flowService.forkFlow(flowId, userId);
      if (!flow) {
        res.status(404).json({ error: 'Flow not found' });
        return;
      }
      res.status(201).json({ success: true, data: { flow } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] forkFlow failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: error.message || 'Failed to fork flow' });
    }
  }

  // ============================================================================
  // EXECUTION
  // ============================================================================

  async startExecution(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { flowId } = req.params;
      const result = await this.nanoAgentService.startExecution(flowId, userId);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] startExecution failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: error.message || 'Failed to start execution' });
    }
  }

  async getExecution(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { executionId } = req.params;
      const execution = await this.nanoAgentService.getExecution(executionId, userId);
      if (!execution) {
        res.status(404).json({ error: 'Execution not found' });
        return;
      }
      res.json({ success: true, data: { execution } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] getExecution failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: error.message || 'Failed to get execution' });
    }
  }

  async streamExecution(req: Request, res: Response): Promise<void> {
    const userId = (req as any).userId;
    const { executionId } = req.params;

    const execution = await this.nanoAgentService.getExecution(executionId, userId);
    if (!execution) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const listener = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    this.nanoAgentService.addListener(executionId, listener);

    // Send initial state
    res.write(`data: ${JSON.stringify({ type: 'connected', executionId })}\n\n`);

    // Cleanup on close
    req.on('close', () => {
      this.nanoAgentService.removeListener(executionId, listener);
    });
  }

  async confirmStep(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { executionId } = req.params;
      const success = await this.nanoAgentService.confirmStep(executionId, userId);
      if (!success) {
        res.status(400).json({ error: 'Cannot confirm step' });
        return;
      }
      res.json({ success: true, data: { confirmed: true } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async skipStep(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { executionId } = req.params;
      const success = await this.nanoAgentService.skipStep(executionId, userId);
      if (!success) {
        res.status(400).json({ error: 'Cannot skip step' });
        return;
      }
      res.json({ success: true, data: { skipped: true } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async abortExecution(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { executionId } = req.params;
      const success = await this.nanoAgentService.abortExecution(executionId, userId);
      if (!success) {
        res.status(400).json({ error: 'Cannot abort execution' });
        return;
      }
      res.json({ success: true, data: { aborted: true } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================================
  // DESKTOP COMPANION ENDPOINTS
  // ============================================================================

  async getDesktopPending(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const pending = await this.nanoAgentService.getDesktopPending(userId);
      res.json({ success: true, data: { pending } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] getDesktopPending failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: error.message });
    }
  }

  async handleDesktopReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const report = desktopStepReportSchema.parse(req.body);
      const success = await this.nanoAgentService.handleDesktopReport(report, userId);
      if (!success) {
        res.status(400).json({ error: 'Failed to process report' });
        return;
      }
      res.json({ success: true, data: { reported: true } });
    } catch (error: any) {
      this.logger.error('[NanoAgentController] handleDesktopReport failed', error instanceof Error ? error : new Error(String(error)));
      res.status(error.name === 'ZodError' ? 400 : 500).json({
        error: error.message || 'Failed to process desktop report',
      });
    }
  }
}
