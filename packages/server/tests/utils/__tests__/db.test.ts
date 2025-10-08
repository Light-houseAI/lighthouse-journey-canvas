import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import type { TransactionManager } from '../../../src/services/transaction-manager.service';
import type { Container as ContainerType } from '../../../src/core/container-setup';

// Mock the Container module
vi.mock('../../../src/core/container-setup', () => ({
  Container: {
    getContainer: vi.fn(),
  },
}));

// Mock the createApp function
vi.mock('../../../src/app', () => ({
  createApp: vi.fn(),
}));

/**
 * Unit tests for transaction harness utilities
 *
 * Tests verify:
 * - Transaction rollback behavior (data isolation)
 * - Error handling and propagation
 * - Transaction context passing
 * - Options handling (timeout, isolation level)
 * - Express app creation with transaction support
 */

describe('withTestTransaction', () => {
  let mockTransactionManager: DeepMockProxy<TransactionManager>;
  let mockContainer: any;
  let withTestTransaction: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock transaction manager
    mockTransactionManager = mockDeep<TransactionManager>();

    // Create mock container
    mockContainer = {
      resolve: vi.fn().mockReturnValue(mockTransactionManager),
    };

    // Setup Container mock to return our mock container
    const { Container } = await import('../../../src/core/container-setup');
    (Container.getContainer as any).mockReturnValue(mockContainer);

    // Import the function to test (this needs to happen after mocks are setup)
    const module = await import('../db');
    withTestTransaction = module.withTestTransaction;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Transaction Rollback', () => {
    it('should execute callback and force rollback', async () => {
      // Arrange
      const callbackResult = { success: true, data: 'test' };
      let callbackExecuted = false;

      // Mock transaction manager to simulate transaction behavior
      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        // Execute the callback with a mock transaction context
        const mockTx = {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
        };

        const result = await callback(mockTx as any);
        // Simulate the rollback by checking for the special error
        throw result;
      });

      // Act
      const result = await withTestTransaction(async (tx) => {
        callbackExecuted = true;
        expect(tx).toBeDefined();
        return callbackResult;
      });

      // Assert
      expect(callbackExecuted).toBe(true);
      expect(result).toEqual(callbackResult);
      expect(mockTransactionManager.withTransaction).toHaveBeenCalledTimes(1);
    });

    it('should return callback result despite rollback', async () => {
      // Arrange
      const expectedResult = { success: true, count: 42 };

      // Mock the transaction manager behavior
      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        const mockTx = {};
        await callback(mockTx as any);
        throw new Error('ROLLBACK');
      });

      // Act
      const result = await withTestTransaction(async (tx) => {
        return expectedResult;
      });

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should isolate data between sequential transactions', async () => {
      // Arrange
      let firstCallbackExecuted = false;
      let secondCallbackExecuted = false;

      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        const mockTx = {};
        await callback(mockTx as any);
        throw new Error('ROLLBACK');
      });

      // Act - Run two transactions sequentially
      await withTestTransaction(async (tx) => {
        firstCallbackExecuted = true;
        return 'first';
      });

      await withTestTransaction(async (tx) => {
        secondCallbackExecuted = true;
        return 'second';
      });

      // Assert - Both should execute independently
      expect(firstCallbackExecuted).toBe(true);
      expect(secondCallbackExecuted).toBe(true);
      expect(mockTransactionManager.withTransaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors thrown in callback', async () => {
      // Arrange
      const testError = new Error('Test error in transaction');

      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        const mockTx = {};
        // Propagate the error from callback
        return await callback(mockTx as any);
      });

      // Act & Assert
      await expect(
        withTestTransaction(async (tx) => {
          throw testError;
        })
      ).rejects.toThrow('Test error in transaction');
    });

    it('should handle errors and still rollback', async () => {
      // Arrange
      let callbackStarted = false;
      const testError = new Error('Intentional error');

      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        const mockTx = {};
        try {
          return await callback(mockTx as any);
        } catch (error) {
          // Re-throw to simulate transaction rollback on error
          throw error;
        }
      });

      // Act & Assert
      await expect(
        withTestTransaction(async (tx) => {
          callbackStarted = true;
          throw testError;
        })
      ).rejects.toThrow('Intentional error');

      expect(callbackStarted).toBe(true);
      expect(mockTransactionManager.withTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transaction Context', () => {
    it('should pass transaction context to callback', async () => {
      // Arrange
      let receivedContext: any = null;
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: '123' }]),
      };

      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        await callback(mockTx as any);
        throw new Error('ROLLBACK');
      });

      // Act
      await withTestTransaction(async (tx) => {
        receivedContext = tx;

        // Verify context has expected methods
        expect(tx.insert).toBeDefined();
        expect(tx.select).toBeDefined();
        expect(tx.update).toBeDefined();
        expect(tx.delete).toBeDefined();
      });

      // Assert
      expect(receivedContext).toBe(mockTx);
    });
  });

  describe('Options Handling', () => {
    it('should handle timeout option', async () => {
      // Arrange
      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        const mockTx = {};
        await callback(mockTx as any);
        throw new Error('ROLLBACK');
      });

      // Act
      const result = await withTestTransaction(
        async (tx) => {
          return 'completed';
        },
        { timeout: 5000 }
      );

      // Assert
      expect(result).toBe('completed');
      expect(mockTransactionManager.withTransaction).toHaveBeenCalled();
    });

    it('should handle isolation level option', async () => {
      // Arrange
      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        const mockTx = {};
        await callback(mockTx as any);
        throw new Error('ROLLBACK');
      });

      // Act
      const result = await withTestTransaction(
        async (tx) => {
          return 'completed';
        },
        { isolationLevel: 'serializable' }
      );

      // Assert
      expect(result).toBe('completed');
    });

    it('should handle verbose option', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        const mockTx = {};
        await callback(mockTx as any);
        throw new Error('ROLLBACK');
      });

      // Act
      await withTestTransaction(
        async (tx) => {
          return 'test';
        },
        { verbose: true }
      );

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '[withTestTransaction] Starting transaction with options:',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should use default options when none provided', async () => {
      // Arrange
      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        const mockTx = {};
        await callback(mockTx as any);
        throw new Error('ROLLBACK');
      });

      // Act
      const result = await withTestTransaction(async (tx) => {
        return 'completed';
      });

      // Assert
      expect(result).toBe('completed');
    });
  });

  describe('Async Handling', () => {
    it('should support async operations within callback', async () => {
      // Arrange
      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        const mockTx = {};
        const result = await callback(mockTx as any);
        throw { marker: Symbol('TEST_TRANSACTION_ROLLBACK'), result };
      });

      // Act
      const result = await withTestTransaction(async (tx) => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'async-result';
      });

      // Assert
      expect(result).toBe('async-result');
    });

    it('should handle promise rejection in callback', async () => {
      // Arrange
      mockTransactionManager.withTransaction.mockImplementation(async (callback) => {
        const mockTx = {};
        return await callback(mockTx as any);
      });

      // Act & Assert
      await expect(
        withTestTransaction(async (tx) => {
          return Promise.reject(new Error('Async error'));
        })
      ).rejects.toThrow('Async error');
    });
  });
});

describe('createTestApp', () => {
  let createTestApp: any;
  let mockCreateApp: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock for createApp
    mockCreateApp = vi.fn().mockReturnValue({
      listen: vi.fn(),
      use: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
    });

    // Mock the createApp import
    const appModule = await import('../../../src/app');
    (appModule.createApp as any) = mockCreateApp;

    // Import the function to test
    const module = await import('../db');
    createTestApp = module.createTestApp;
  });

  it('should create Express application', async () => {
    // Act
    const app = await createTestApp();

    // Assert
    expect(app).toBeDefined();
    expect(app.listen).toBeDefined();
    expect(app.use).toBeDefined();
    expect(app.get).toBeDefined();
    expect(mockCreateApp).toHaveBeenCalled();
  });

  it('should return configured app instance', async () => {
    // Arrange
    const mockApp = {
      listen: vi.fn(),
      use: vi.fn(),
      get: vi.fn(),
      isTestApp: true,
    };
    mockCreateApp.mockReturnValue(mockApp);

    // Act
    const app = await createTestApp();

    // Assert
    expect(app).toBe(mockApp);
    expect(app.isTestApp).toBe(true);
  });

  it('should support multiple independent app instances', async () => {
    // Arrange
    const mockApp1 = { id: 'app1', use: vi.fn() };
    const mockApp2 = { id: 'app2', use: vi.fn() };

    mockCreateApp
      .mockReturnValueOnce(mockApp1)
      .mockReturnValueOnce(mockApp2);

    // Act
    const app1 = await createTestApp();
    const app2 = await createTestApp();

    // Assert
    expect(app1).not.toBe(app2);
    expect(app1.id).toBe('app1');
    expect(app2.id).toBe('app2');
    expect(mockCreateApp).toHaveBeenCalledTimes(2);
  });
});