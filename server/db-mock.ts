// Mock database for testing when PostgreSQL is not available
import * as schema from "../shared/schema";

export const createMockDb = () => {
  console.log('⚠️  Using mock database for testing (PostgreSQL not available)');
  
  // Mock database that returns empty results for all queries
  const mockDb = {
    select: () => mockDb,
    from: () => mockDb,
    where: () => mockDb,
    insert: () => mockDb,
    values: () => mockDb,
    update: () => mockDb,
    set: () => mockDb,
    delete: () => mockDb,
    returning: () => mockDb,
    execute: async () => [],
    get: async () => null,
    all: async () => [],
    run: async () => ({ changes: 0, lastInsertRowid: 1 }),
    
    // Schema access
    ...Object.keys(schema).reduce((acc, key) => {
      acc[key] = {
        select: () => mockDb,
        insert: () => mockDb,
        update: () => mockDb,
        delete: () => mockDb,
      };
      return acc;
    }, {} as any)
  };

  return mockDb;
};

export const mockPool = {
  connect: async () => {
    console.log('📝 Mock database connection established');
    return {
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    };
  },
  end: async () => {},
  query: async () => ({ rows: [], rowCount: 0 }),
};