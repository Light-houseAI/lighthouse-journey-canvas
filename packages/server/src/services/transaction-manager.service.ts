import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger';

/**
 * Transaction context that can be passed to repositories
 */
export type TransactionContext = any; // This will be the Drizzle transaction object

/**
 * TransactionManager Service
 *
 * Manages database transactions across multiple repository operations.
 * This service provides a clean abstraction for transaction management,
 * allowing services to coordinate multiple repository operations within
 * a single transaction without tight coupling.
 */
export class TransactionManager {
  private readonly db: NodePgDatabase<any>;
  private readonly logger: Logger;

  constructor(dependencies: { database: NodePgDatabase<any>; logger: Logger }) {
    this.db = dependencies.database;
    this.logger = dependencies.logger;
  }

  /**
   * Execute a function within a database transaction
   *
   * @param callback - Function to execute within the transaction
   * @returns The result of the callback function
   *
   * @example
   * const result = await transactionManager.withTransaction(async (tx) => {
   *   const node = await hierarchyRepo.createNode(data, tx);
   *   await permissionRepo.setupPermissions(node.id, tx);
   *   return node;
   * });
   */
  async withTransaction<T>(
    callback: (tx: TransactionContext) => Promise<T>
  ): Promise<T> {
    this.logger.debug('Starting transaction');

    try {
      const result = await this.db.transaction(async (tx) => {
        this.logger.debug('Transaction started');
        return await callback(tx);
      });

      this.logger.debug('Transaction committed successfully');
      return result;
    } catch (error) {
      this.logger.error('Transaction rolled back due to error:', error);
      throw error;
    }
  }
}
