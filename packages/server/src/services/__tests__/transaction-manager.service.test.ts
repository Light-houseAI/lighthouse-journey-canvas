import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import {
  type TransactionContext,
  TransactionManager,
} from '../transaction-manager.service';

describe('TransactionManager', () => {
  const mockDatabase = mockDeep<NodePgDatabase<any>>();
  const mockLogger = mockDeep<Logger>();

  let transactionManager: TransactionManager;

  beforeEach(() => {
    mockReset(mockDatabase);
    mockReset(mockLogger);
    transactionManager = new TransactionManager({
      database: mockDatabase,
      logger: mockLogger,
    });
  });

  describe('withTransaction', () => {
    it('should successfully execute callback and commit transaction', async () => {
      // Arrange
      const expectedResult = { id: 1, name: 'test' };
      const mockCallback = vi.fn().mockResolvedValue(expectedResult);
      const mockTx = {} as TransactionContext;

      mockDatabase.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      // Act
      const result = await transactionManager.withTransaction(mockCallback);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockCallback).toHaveBeenCalledWith(mockTx);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith('Starting transaction');
      expect(mockLogger.debug).toHaveBeenCalledWith('Transaction started');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Transaction committed successfully'
      );
    });

    it('should rollback transaction when callback throws error', async () => {
      // Arrange
      const testError = new Error('Operation failed');
      const mockCallback = vi.fn().mockRejectedValue(testError);

      mockDatabase.transaction.mockImplementation(async (callback) => {
        const mockTx = {} as TransactionContext;
        return await callback(mockTx);
      });

      // Act & Assert
      await expect(
        transactionManager.withTransaction(mockCallback)
      ).rejects.toThrow('Operation failed');
      expect(mockLogger.debug).toHaveBeenCalledWith('Starting transaction');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Transaction rolled back due to error:',
        testError
      );
    });
  });
});
