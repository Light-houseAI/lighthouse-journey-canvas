#!/usr/bin/env npx tsx

/**
 * Batch Block Extraction Script
 *
 * Processes existing sessions to extract hierarchical workflow blocks.
 * This populates the ArangoDB `blocks` and `NEXT_BLOCK` collections
 * so that the top-workflows endpoint returns real data.
 *
 * Usage:
 *   npx tsx packages/server/src/scripts/extract-blocks-batch.ts [options]
 *
 * Options:
 *   --user-id <id>    Process sessions for a specific user (required unless --all)
 *   --all             Process sessions for all users
 *   --limit <n>       Maximum number of sessions to process (default: 50)
 *   --min-screenshots Minimum screenshots per session to process (default: 3)
 *   --dry-run         Show what would be processed without making changes
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment from server package
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Container } from '../core/container-setup.js';
import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { initializeArangoDBSchema } from '../config/arangodb.init.js';
import type { Logger } from '../core/logger.js';
import type { BlockExtractionService } from '../services/block-extraction.service.js';
import type { BlockCanonicalizationService } from '../services/block-canonicalization.service.js';
import type { BlockLinkingService } from '../services/block-linking.service.js';
import type { WorkflowScreenshotRepository } from '../repositories/workflow-screenshot.repository.js';
import { getPoolFromDatabase } from '../config/database.connection.js';

// ============================================================================
// TYPES
// ============================================================================

interface ProcessingOptions {
  userId?: number;
  processAll: boolean;
  limit: number;
  minScreenshots: number;
  dryRun: boolean;
}

interface SessionInfo {
  sessionId: string;
  userId: number;
  screenshotCount: number;
}

interface ProcessingResult {
  sessionId: string;
  userId: number;
  screenshotCount: number;
  blocksExtracted: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs(): ProcessingOptions {
  const args = process.argv.slice(2);
  const options: ProcessingOptions = {
    processAll: false,
    limit: 50,
    minScreenshots: 3,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--user-id':
        options.userId = parseInt(args[++i], 10);
        if (isNaN(options.userId)) {
          console.error('Error: --user-id must be a number');
          process.exit(1);
        }
        break;

      case '--all':
        options.processAll = true;
        break;

      case '--limit':
        options.limit = parseInt(args[++i], 10);
        if (isNaN(options.limit) || options.limit < 1) {
          console.error('Error: --limit must be a positive number');
          process.exit(1);
        }
        break;

      case '--min-screenshots':
        options.minScreenshots = parseInt(args[++i], 10);
        if (isNaN(options.minScreenshots) || options.minScreenshots < 1) {
          console.error('Error: --min-screenshots must be a positive number');
          process.exit(1);
        }
        break;

      case '--dry-run':
        options.dryRun = true;
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);

      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  // Validate required options
  if (!options.userId && !options.processAll) {
    console.error('Error: Either --user-id or --all is required');
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp(): void {
  console.log(`
Batch Block Extraction Script

Extracts hierarchical workflow blocks from existing sessions.

Usage:
  npx tsx packages/server/src/scripts/extract-blocks-batch.ts [options]

Options:
  --user-id <id>       Process sessions for a specific user (required unless --all)
  --all                Process sessions for all users
  --limit <n>          Maximum number of sessions to process (default: 50)
  --min-screenshots <n> Minimum screenshots per session to process (default: 3)
  --dry-run            Show what would be processed without making changes
  --help, -h           Show this help message

Examples:
  # Process sessions for user 1
  npx tsx packages/server/src/scripts/extract-blocks-batch.ts --user-id 1

  # Process up to 100 sessions for all users
  npx tsx packages/server/src/scripts/extract-blocks-batch.ts --all --limit 100

  # Dry run to see what would be processed
  npx tsx packages/server/src/scripts/extract-blocks-batch.ts --user-id 1 --dry-run
`);
}

// ============================================================================
// SIMPLE LOGGER FOR SCRIPT
// ============================================================================

const scriptLogger: Logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  error: (message: string, errorOrMeta?: Error | Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, errorOrMeta || '');
  },
};

// ============================================================================
// MAIN PROCESSING LOGIC
// ============================================================================

/**
 * Get sessions directly from workflow_screenshots table
 * This finds sessions with sufficient screenshots for processing
 */
async function getSessionsFromScreenshots(
  pool: any,
  options: ProcessingOptions
): Promise<SessionInfo[]> {
  let query: string;
  let params: any[];

  if (options.userId) {
    query = `
      SELECT session_id, user_id, COUNT(*) as screenshot_count
      FROM workflow_screenshots
      WHERE user_id = $1
      GROUP BY session_id, user_id
      HAVING COUNT(*) >= $2
      ORDER BY screenshot_count DESC
      LIMIT $3
    `;
    params = [options.userId, options.minScreenshots, options.limit];
  } else {
    query = `
      SELECT session_id, user_id, COUNT(*) as screenshot_count
      FROM workflow_screenshots
      GROUP BY session_id, user_id
      HAVING COUNT(*) >= $1
      ORDER BY screenshot_count DESC
      LIMIT $2
    `;
    params = [options.minScreenshots, options.limit];
  }

  const result = await pool.query(query, params);

  return result.rows.map((row: any) => ({
    sessionId: row.session_id,
    userId: row.user_id,
    screenshotCount: parseInt(row.screenshot_count, 10),
  }));
}

async function processSession(
  session: SessionInfo,
  screenshotRepo: WorkflowScreenshotRepository,
  blockExtractionService: BlockExtractionService,
  blockCanonicalizationService: BlockCanonicalizationService,
  blockLinkingService: BlockLinkingService,
  options: ProcessingOptions
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    sessionId: session.sessionId,
    userId: session.userId,
    screenshotCount: session.screenshotCount,
    blocksExtracted: 0,
    success: false,
  };

  try {
    if (options.dryRun) {
      scriptLogger.info(`[DRY RUN] Would process session ${session.sessionId} with ${session.screenshotCount} screenshots`);
      result.success = true;
      return result;
    }

    // Get screenshots for this session
    const screenshots = await screenshotRepo.getScreenshotsBySession(
      session.userId,
      session.sessionId
    );

    result.screenshotCount = screenshots.length;

    if (screenshots.length < options.minScreenshots) {
      scriptLogger.debug(`Skipping session ${session.sessionId} - only ${screenshots.length} screenshots`);
      result.success = true;
      return result;
    }

    // Transform screenshots to the format expected by BlockExtractionService
    // appName may be in meta.appName or meta.app_name depending on how it was stored
    const screenshotData = screenshots.map((s) => {
      const meta = (s as any).meta || {};
      return {
        id: s.id,
        summary: s.summary || '',
        analysis: s.analysis,
        appName: meta.appName || meta.app_name || meta.activeApp || 'unknown',
        timestamp: s.timestamp,
        workflowTag: s.workflowTag,
      };
    });

    // Step 1: Extract raw blocks
    scriptLogger.info(`Extracting blocks from session ${session.sessionId}...`);
    const rawBlocks = await blockExtractionService.extractBlocksFromSession(
      session.sessionId,
      screenshotData
    );

    if (rawBlocks.length === 0) {
      scriptLogger.debug(`No blocks extracted from session ${session.sessionId}`);
      result.success = true;
      return result;
    }

    // Step 2: Canonicalize blocks
    scriptLogger.info(`Canonicalizing ${rawBlocks.length} blocks...`);
    const canonicalizedBlocks = await blockCanonicalizationService.canonicalizeBlocks(rawBlocks);

    // Step 3: Link blocks (creates nodes and edges in ArangoDB)
    scriptLogger.info(`Linking ${canonicalizedBlocks.length} blocks...`);
    await blockLinkingService.linkBlocksSequentially(
      canonicalizedBlocks,
      session.sessionId,
      String(session.userId)
    );

    result.blocksExtracted = canonicalizedBlocks.length;
    result.success = true;

    scriptLogger.info(`Successfully processed session ${session.sessionId}: ${canonicalizedBlocks.length} blocks`);

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    scriptLogger.error(`Failed to process session ${session.sessionId}`, { error: result.error });
  }

  return result;
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('');
  console.log('='.repeat(60));
  console.log('  Batch Block Extraction Script');
  console.log('='.repeat(60));
  console.log('');
  console.log('Options:', JSON.stringify(options, null, 2));
  console.log('');

  // Initialize the container
  scriptLogger.info('Initializing container...');
  await Container.configure(scriptLogger);

  // Initialize ArangoDB schema (creates collections if needed)
  scriptLogger.info('Ensuring ArangoDB schema is initialized...');
  await initializeArangoDBSchema(scriptLogger);

  // Resolve services from container
  const container = Container.getContainer();

  // Get database pool for direct queries
  const database = container.resolve<any>(CONTAINER_TOKENS.DATABASE);
  const pool = getPoolFromDatabase(database);

  const screenshotRepo = container.resolve<WorkflowScreenshotRepository>(
    CONTAINER_TOKENS.WORKFLOW_SCREENSHOT_REPOSITORY
  );
  const blockExtractionService = container.resolve<BlockExtractionService>(
    CONTAINER_TOKENS.BLOCK_EXTRACTION_SERVICE
  );
  const blockCanonicalizationService = container.resolve<BlockCanonicalizationService>(
    CONTAINER_TOKENS.BLOCK_CANONICALIZATION_SERVICE
  );
  const blockLinkingService = container.resolve<BlockLinkingService>(
    CONTAINER_TOKENS.BLOCK_LINKING_SERVICE
  );

  // Get sessions to process directly from workflow_screenshots table
  scriptLogger.info('Fetching sessions to process...');
  const sessions = await getSessionsFromScreenshots(pool, options);

  if (sessions.length === 0) {
    scriptLogger.warn('No sessions found to process');
    await Container.dispose();
    return;
  }

  scriptLogger.info(`Found ${sessions.length} sessions to process`);
  console.log('');

  // Process each session
  const results: ProcessingResult[] = [];
  let processed = 0;

  for (const session of sessions) {
    processed++;
    scriptLogger.info(`Processing session ${processed}/${sessions.length}: ${session.sessionId} (${session.screenshotCount} screenshots)`);

    const result = await processSession(
      session,
      screenshotRepo,
      blockExtractionService,
      blockCanonicalizationService,
      blockLinkingService,
      options
    );

    results.push(result);
  }

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('  Processing Summary');
  console.log('='.repeat(60));
  console.log('');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const totalBlocks = results.reduce((sum, r) => sum + r.blocksExtracted, 0);
  const totalScreenshots = results.reduce((sum, r) => sum + r.screenshotCount, 0);

  console.log(`Sessions processed: ${results.length}`);
  console.log(`Successful:         ${successful.length}`);
  console.log(`Failed:             ${failed.length}`);
  console.log(`Total screenshots:  ${totalScreenshots}`);
  console.log(`Total blocks:       ${totalBlocks}`);
  console.log('');

  if (failed.length > 0) {
    console.log('Failed sessions:');
    for (const result of failed) {
      console.log(`  - ${result.sessionId}: ${result.error}`);
    }
    console.log('');
  }

  if (options.dryRun) {
    console.log('NOTE: This was a dry run. No changes were made.');
    console.log('');
  }

  // Cleanup
  await Container.dispose();

  scriptLogger.info('Done!');
}

// ============================================================================
// ENTRY POINT
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
