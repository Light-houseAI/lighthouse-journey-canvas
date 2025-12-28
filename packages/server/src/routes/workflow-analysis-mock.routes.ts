/**
 * Workflow Analysis Routes - Mock Implementation
 * Temporary mock endpoints until full backend implementation is complete
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/index.js';

const router = Router();

// All workflow analysis routes require authentication
router.use(requireAuth);

/**
 * GET /api/v2/workflow-analysis/:nodeId
 * Returns null (no analysis yet) initially
 */
router.get('/:nodeId', async (req: any, res: any) => {
  res.json({
    success: true,
    data: null, // No analysis exists yet
  });
});

/**
 * POST /api/v2/workflow-analysis/:nodeId/trigger
 * Returns mock workflow analysis data
 */
router.post('/:nodeId/trigger', async (req: any, res: any) => {
  const { nodeId } = req.params;

  // Mock analysis result
  const mockAnalysis = {
    id: `analysis-${nodeId}`,
    nodeId,
    userId: req.user?.id || 0,
    executiveSummary:
      'Your workflow shows strong focus on research and documentation tasks, with consistent work patterns during morning hours. The data suggests high productivity with minimal context switching between applications.',
    insights: [
      {
        id: 'insight-1',
        type: 'pattern',
        title: 'Consistent morning research sessions',
        description: 'You demonstrate peak productivity during morning hours (9-11 AM) with extended focus periods on research and documentation tasks.',
        impact: 'high',
        confidence: 0.89,
        supportingScreenshotIds: [],
        recommendations: [
          'Continue protecting your morning time for deep research work',
          'Schedule meetings and administrative tasks for afternoon hours'
        ]
      },
      {
        id: 'insight-2',
        type: 'efficiency_gain',
        title: 'Low context switching rate',
        description: 'Analysis shows minimal application switching during work sessions, indicating strong focus and fewer interruptions.',
        impact: 'medium',
        confidence: 0.76,
        supportingScreenshotIds: [],
        recommendations: [
          'Maintain current focus practices',
          'Consider batching similar tasks together'
        ]
      },
      {
        id: 'insight-3',
        type: 'time_distribution',
        title: 'Balanced workflow categories',
        description: 'Time is well-distributed across research, coding, and documentation activities, showing versatile skill application.',
        impact: 'medium',
        confidence: 0.82,
        supportingScreenshotIds: [],
      }
    ],
    workflowDistribution: [
      { tag: 'research', count: 45, totalDurationSeconds: 5400, percentage: 45 },
      { tag: 'coding', count: 30, totalDurationSeconds: 3600, percentage: 30 },
      { tag: 'documentation', count: 20, totalDurationSeconds: 2400, percentage: 20 },
      { tag: 'communication', count: 5, totalDurationSeconds: 600, percentage: 5 }
    ],
    metrics: {
      totalScreenshots: 100,
      totalSessions: 8,
      totalDurationSeconds: 12000,
      averageSessionDurationSeconds: 1500,
      mostProductiveHours: [9, 10, 14],
      contextSwitches: 12
    },
    recommendations: [
      'Schedule deep work blocks during 9-11 AM window when productivity peaks',
      'Continue current low-interruption work environment practices',
      'Consider time-boxing communication tasks to preserve focus periods'
    ],
    analyzedAt: new Date().toISOString(),
    dataRangeStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    dataRangeEnd: new Date().toISOString(),
    screenshotsAnalyzed: 100
  };

  res.json({
    success: true,
    message: 'Workflow analysis completed successfully',
    data: mockAnalysis
  });
});

/**
 * POST /api/v2/workflow-analysis/ingest
 * Mock ingestion endpoint
 */
router.post('/ingest', async (req: any, res: any) => {
  const { screenshots = [] } = req.body;

  res.json({
    success: true,
    message: `Successfully ingested ${screenshots.length} screenshots`,
    ingested: screenshots.length,
    failed: 0,
    screenshotIds: screenshots.map((_: any, i: number) => i + 1)
  });
});

/**
 * POST /api/v2/workflow-analysis/search
 * Mock search endpoint
 */
router.post('/search', async (req: any, res: any) => {
  res.json({
    success: true,
    data: {
      results: [],
      totalResults: 0,
      query: req.body.query || '',
      searchType: 'hybrid',
      executionTimeMs: 0
    }
  });
});

export default router;
