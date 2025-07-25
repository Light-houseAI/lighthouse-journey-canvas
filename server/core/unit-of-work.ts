import type { Database } from './container';

export interface IUnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  execute<T>(operation: (transaction: Database) => Promise<T>): Promise<T>;
}

export class UnitOfWork implements IUnitOfWork {
  private transaction?: any;

  constructor(private db: Database) {}

  async begin(): Promise<void> {
    if (this.transaction) {
      throw new Error('Transaction already in progress');
    }
    this.transaction = await this.db.transaction(async (tx) => tx);
  }

  async commit(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No transaction in progress');
    }
    await this.transaction.commit();
    this.transaction = undefined;
  }

  async rollback(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No transaction in progress');
    }
    await this.transaction.rollback();
    this.transaction = undefined;
  }

  async execute<T>(operation: (transaction: Database) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx) => {
      return await operation(tx);
    });
  }

  getTransaction(): Database {
    if (!this.transaction) {
      throw new Error('No transaction in progress');
    }
    return this.transaction;
  }
}

// Factory function
export function createUnitOfWork(db: Database): IUnitOfWork {
  return new UnitOfWork(db);
}