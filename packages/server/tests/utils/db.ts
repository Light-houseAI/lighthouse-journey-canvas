/**
 * Database Test Utilities
 *
 * Provides transaction-wrapped test execution with automatic rollback
 * for complete test isolation and parallel execution support.
 */

import type { Application } from 'express';
import type { TransactionContext } from '../../src/services/transaction-manager.service';
import type { TransactionManager } from '../../src/services/transaction-manager.service';
import { createApp } from '../../src/app';
import { Container } from '../../src/core/container-setup';
import { CONTAINER_TOKENS } from '../../src/core/container-tokens';

/**
 * Options for transaction-wrapped tests
 */
export interface TestTransactionOptions {
  /**
   * Transaction isolation level
   * @default 'read committed'
   */
  isolationLevel?: 'read committed' | 'serializable';

  /**
   * Maximum transaction duration in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Whether to log transaction operations
   * @default false
   */
  verbose?: boolean;
}

/**
 * Get transaction manager from container
 */
function getTransactionManager(): TransactionManager {
  const container = Container.getContainer();
  if (!container || typeof container.resolve !== 'function') {
    throw new Error('Container not configured. Call configure() first.');
  }
  return container.resolve<TransactionManager>(
    CONTAINER_TOKENS.TRANSACTION_MANAGER
  );
}

/**
 * Execute a test callback within a database transaction that will be rolled back.
 *
 * This function ensures complete test isolation by:
 * 1. Starting a new database transaction
 * 2. Executing the test callback with transaction context
 * 3. Rolling back the transaction (never commits)
 * 4. Cleaning up any resources
 *
 * The rollback is achieved by throwing a special error after the callback completes,
 * which causes the transaction to rollback while still returning the callback result.
 *
 * @param callback - Test function to execute within transaction
 * @param options - Transaction configuration options
 * @returns The result of the callback function
 *
 * @example
 * ```typescript
 * describe('User API', () => {
 *   it('should create user', async () => {
 *     await withTestTransaction(async (tx) => {
 *       const user = await createTestUser(tx, { email: 'test@example.com' });
 *       const response = await request(app)
 *         .get(`/api/users/${user.id}`)
 *         .expect(200);
 *
 *       expect(response.body.data.email).toBe('test@example.com');
 *       // Transaction rolls back automatically - no cleanup needed
 *     });
 *   });
 * });
 * ```
 */
export async function withTestTransaction<T>(
  callback: (tx: TransactionContext) => Promise<T>,
  options?: TestTransactionOptions
): Promise<T> {
  const opts = {
    isolationLevel: options?.isolationLevel ?? 'read committed',
    timeout: options?.timeout ?? 30000,
    verbose: options?.verbose ?? false,
  };

  if (opts.verbose) {
    console.log('[withTestTransaction] Starting transaction with options:', opts);
  }

  // Special marker error for forced rollback
  const ROLLBACK_MARKER = Symbol('TEST_TRANSACTION_ROLLBACK');

  let callbackResult: T;

  try {
    // Get transaction manager from container
    // If container is not configured, just run the callback without transaction (for mock tests)
    let transactionManager: TransactionManager;
    try {
      transactionManager = getTransactionManager();
    } catch (error) {
      // Container not configured, run without transaction
      if (opts.verbose) {
        console.log('[withTestTransaction] Container not configured, running without transaction');
      }
      return callback({} as TransactionContext);
    }

    // Execute in transaction, but force rollback
    await transactionManager.withTransaction(async (tx) => {
      if (opts.verbose) {
        console.log('[withTestTransaction] Transaction started');
      }

      // Set timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (opts.timeout) {
        timeoutId = setTimeout(() => {
          throw new Error(
            `Transaction timeout: exceeded ${opts.timeout}ms`
          );
        }, opts.timeout);
      }

      try {
        // Execute callback and capture result
        callbackResult = await callback(tx);

        if (opts.verbose) {
          console.log('[withTestTransaction] Callback completed successfully');
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }

      // Force rollback by throwing special error
      // This prevents the transaction from committing
      const rollbackError: any = new Error('ROLLBACK');
      rollbackError.marker = ROLLBACK_MARKER;
      throw rollbackError;
    });
  } catch (error: any) {
    // Check if this is our intentional rollback marker
    if (error.marker === ROLLBACK_MARKER) {
      if (opts.verbose) {
        console.log('[withTestTransaction] Transaction rolled back (expected)');
      }
      // Return the captured result despite rollback
      return callbackResult!;
    }

    // Any other error should propagate
    if (opts.verbose) {
      console.error('[withTestTransaction] Transaction failed:', error);
    }
    throw error;
  }

  // This should never be reached, but TypeScript needs it
  return callbackResult!;
}

/**
 * Create a test-isolated version of the Express app with transaction support.
 *
 * This creates a fresh Express application instance configured for testing,
 * with all middleware and routes set up.
 *
 * @returns Express application configured for transactional testing
 *
 * @example
 * ```typescript
 * describe('API Tests', () => {
 *   let app: Application;
 *
 *   beforeAll(async () => {
 *     app = await createTestApp();
 *   });
 *
 *   it('should handle requests', async () => {
 *     await withTestTransaction(async (tx) => {
 *       const user = await createTestUser(tx);
 *       const response = await request(app)
 *         .get(`/api/users/${user.id}`)
 *         .expect(200);
 *     });
 *   });
 * });
 * ```
 */
export async function createTestApp(): Promise<Application> {
  // Create a new Express app instance with all routes and middleware
  const app = createApp();

  // App is ready for testing with transaction support
  return app;
}

/**
 * Helper to create a transaction context for testing without automatic rollback.
 *
 * This is useful when you need to manually control transaction lifecycle
 * or when testing transaction-related functionality itself.
 *
 * @internal
 */
export async function createTestTransaction(): Promise<TransactionContext> {
  const transactionManager = getTransactionManager();
  let txContext: TransactionContext;

  await transactionManager.withTransaction(async (tx) => {
    txContext = tx;
    // Capture transaction but don't commit yet
    throw new Error('CAPTURE_TX');
  }).catch((error) => {
    if (error.message !== 'CAPTURE_TX') {
      throw error;
    }
  });

  return txContext!;
}
