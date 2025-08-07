/**
 * Performance Benchmark Tests
 * 
 * Tests to validate PRD performance requirements:
 * - Single node operations < 200ms
 * - Aggregation queries < 500ms
 * - Large dataset handling (1000+ nodes)
 * - Concurrent user scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { TestDatabaseManager } from '../utils/test-database.js';

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID;

// Performance measurement utilities
class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();

  startMeasurement(label: string): () => number {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      if (!this.measurements.has(label)) {
        this.measurements.set(label, []);
      }
      this.measurements.get(label)!.push(duration);
      return duration;
    };
  }

  getStatistics(label: string) {
    const measurements = this.measurements.get(label) || [];
    if (measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: measurements.length,
    };
  }

  reset() {
    this.measurements.clear();
  }
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  
  app.use((req: any, res: any, next: any) => {
    req.user = { id: TEST_USER_ID, profileId: TEST_USER_ID };
    next();
  });

  return app;
}

describe('Performance Benchmark Tests', () => {
  let testDb: TestDatabaseManager;
  let app: express.Application;
  let monitor: PerformanceMonitor;

  beforeEach(async () => {
    testDb = TestDatabaseManager.getInstance();
    await testDb.resetTestUserData();
    app = createTestApp();
    monitor = new PerformanceMonitor();
  }, 60000);

  describe('PRD Requirement: Single Node Operations < 200ms', () => {
    it('should create work experience within 200ms', async () => {
      const workExperience = {
        title: 'Performance Test Engineer',
        company: 'Speed Corp',
        position: 'Performance Test Engineer',
        startDate: '2024-01-01',
        employmentType: 'full-time',
        description: 'Testing system performance',
        technologies: ['Node.js', 'React', 'PostgreSQL'],
      };

      const endMeasurement = monitor.startMeasurement('create-work-experience');
      
      const response = await request(app)
        .post('/api/v1/work-experiences')
        .send(workExperience);

      const duration = endMeasurement();

      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(200);
    });

    it('should retrieve work experience by ID within 200ms', async () => {
      // Setup: Create an experience first
      const createResponse = await request(app)
        .post('/api/v1/work-experiences')
        .send({
          title: 'Retrieval Test',
          company: 'Fast Corp',
          position: 'Developer',
          startDate: '2023-01-01',
          employmentType: 'full-time',
        });

      const experienceId = createResponse.body.data.id;

      // Test: Retrieve the experience
      const endMeasurement = monitor.startMeasurement('get-work-experience');
      
      const response = await request(app)
        .get(`/api/v1/work-experiences/${experienceId}`);

      const duration = endMeasurement();

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200);
    });

    it('should update work experience within 200ms', async () => {
      const createResponse = await request(app)
        .post('/api/v1/work-experiences')
        .send({
          title: 'Update Test',
          company: 'Update Corp',
          position: 'Developer',
          startDate: '2023-01-01',
          employmentType: 'full-time',
        });

      const experienceId = createResponse.body.data.id;
      const updates = { title: 'Updated Title', description: 'Updated description' };

      const endMeasurement = monitor.startMeasurement('update-work-experience');
      
      const response = await request(app)
        .put(`/api/v1/work-experiences/${experienceId}`)
        .send(updates);

      const duration = endMeasurement();

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200);
    });

    it('should delete work experience within 200ms', async () => {
      const createResponse = await request(app)
        .post('/api/v1/work-experiences')
        .send({
          title: 'Delete Test',
          company: 'Delete Corp',
          position: 'Developer',
          startDate: '2023-01-01',
          employmentType: 'full-time',
        });

      const experienceId = createResponse.body.data.id;

      const endMeasurement = monitor.startMeasurement('delete-work-experience');
      
      const response = await request(app)
        .delete(`/api/v1/work-experiences/${experienceId}`);

      const duration = endMeasurement();

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200);
    });

    it('should maintain performance with multiple single operations', async () => {
      const operations = [];

      // Perform 50 single operations
      for (let i = 0; i < 50; i++) {
        operations.push(async () => {
          const endMeasurement = monitor.startMeasurement('batch-single-ops');
          
          const response = await request(app)
            .post('/api/v1/work-experiences')
            .send({
              title: `Test Engineer ${i}`,
              company: `Company ${i}`,
              position: `Engineer ${i}`,
              startDate: '2024-01-01',
              employmentType: 'full-time',
            });

          const duration = endMeasurement();
          expect(response.status).toBe(201);
          expect(duration).toBeLessThan(200);
        });
      }

      await Promise.all(operations.map(op => op()));

      const stats = monitor.getStatistics('batch-single-ops');
      expect(stats?.avg).toBeLessThan(200);
      expect(stats?.p95).toBeLessThan(250); // 95th percentile should be reasonable
    });
  });

  describe('PRD Requirement: Aggregation Queries < 500ms', () => {
    beforeEach(async () => {
      // Create comprehensive test data for aggregation
      const dataCreation = [];

      // Create 20 work experiences
      for (let i = 0; i < 20; i++) {
        dataCreation.push(
          request(app).post('/api/v1/work-experiences').send({
            title: `Engineer ${i}`,
            company: `Company ${Math.floor(i / 5)}`, // Group by company
            position: `Developer ${i}`,
            startDate: `202${Math.floor(i / 10)}-01-01`,
            endDate: i % 3 === 0 ? undefined : `202${Math.floor(i / 10)}-12-31`,
            employmentType: i % 2 === 0 ? 'full-time' : 'contract',
            technologies: [`Tech${i % 5}`, `Framework${i % 3}`],
          })
        );
      }

      // Create 10 education entries
      for (let i = 0; i < 10; i++) {
        dataCreation.push(
          request(app).post('/api/v1/education').send({
            title: `Degree ${i}`,
            school: `University ${Math.floor(i / 3)}`,
            degree: ['Bachelor', 'Master', 'PhD'][i % 3],
            field: ['Computer Science', 'Engineering', 'Mathematics'][i % 3],
            startDate: `201${i % 10}-09-01`,
            endDate: `202${(i % 10) + 1}-05-31`,
            gpa: (3.0 + (i % 10) * 0.1).toFixed(1),
          })
        );
      }

      // Create 15 projects
      for (let i = 0; i < 15; i++) {
        dataCreation.push(
          request(app).post('/api/v1/projects').send({
            title: `Project ${i}`,
            description: `Description for project ${i}`,
            technologies: [`Tech${i % 8}`, `Tool${i % 4}`],
            startDate: `202${Math.floor(i / 8)}-01-01`,
            endDate: `202${Math.floor(i / 8)}-06-01`,
            status: ['completed', 'in-progress', 'planned'][i % 3],
          })
        );
      }

      await Promise.all(dataCreation);
    }, 120000);

    it('should aggregate complete profile within 500ms', async () => {
      const endMeasurement = monitor.startMeasurement('profile-aggregation');
      
      const response = await request(app)
        .get('/api/v1/nodes/profile/aggregate');

      const duration = endMeasurement();

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);

      // Verify comprehensive data is returned
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('careerProgression');
      expect(response.body.data).toHaveProperty('technologyExperience');
      expect(response.body.data.summary.totalNodes).toBeGreaterThan(40); // 20+10+15
    });

    it('should filter by date range within 500ms', async () => {
      const endMeasurement = monitor.startMeasurement('date-range-filter');
      
      const response = await request(app)
        .get('/api/v1/nodes/filter/date-range')
        .query({ startDate: '2020-01-01', endDate: '2024-12-31' });

      const duration = endMeasurement();

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should search by technology within 500ms', async () => {
      const endMeasurement = monitor.startMeasurement('technology-search');
      
      const response = await request(app)
        .get('/api/v1/nodes/search/technology')
        .query({ technology: 'Tech0' });

      const duration = endMeasurement();

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should get all work experiences within 500ms', async () => {
      const endMeasurement = monitor.startMeasurement('get-all-experiences');
      
      const response = await request(app)
        .get('/api/v1/work-experiences');

      const duration = endMeasurement();

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
      expect(response.body.data).toHaveLength(20);
    });

    it('should maintain aggregation performance under repeated queries', async () => {
      const aggregationQueries = [];

      for (let i = 0; i < 20; i++) {
        aggregationQueries.push(async () => {
          const endMeasurement = monitor.startMeasurement('repeated-aggregation');
          
          const response = await request(app)
            .get('/api/v1/nodes/profile/aggregate');

          const duration = endMeasurement();
          expect(response.status).toBe(200);
          expect(duration).toBeLessThan(500);
        });
      }

      await Promise.all(aggregationQueries.map(query => query()));

      const stats = monitor.getStatistics('repeated-aggregation');
      expect(stats?.avg).toBeLessThan(500);
      expect(stats?.max).toBeLessThan(750); // Even worst case should be reasonable
    });
  });

  describe('Large Dataset Handling (1000+ nodes)', () => {
    it('should handle 1000+ work experiences efficiently', async () => {
      // Create 1000 work experiences in batches
      const batchSize = 50;
      const totalNodes = 1000;

      for (let batch = 0; batch < totalNodes / batchSize; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const nodeIndex = batch * batchSize + i;
          batchPromises.push(
            request(app).post('/api/v1/work-experiences').send({
              title: `Engineer ${nodeIndex}`,
              company: `Company ${Math.floor(nodeIndex / 100)}`,
              position: `Developer ${nodeIndex}`,
              startDate: `202${Math.floor(nodeIndex / 400)}-01-01`,
              endDate: nodeIndex % 10 === 0 ? undefined : `202${Math.floor(nodeIndex / 400)}-12-31`,
              employmentType: 'full-time',
            })
          );
        }

        await Promise.all(batchPromises);
      }

      // Test aggregation performance with large dataset
      const endMeasurement = monitor.startMeasurement('large-dataset-aggregation');
      
      const response = await request(app)
        .get('/api/v1/nodes/profile/aggregate');

      const duration = endMeasurement();

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Allow more time for very large datasets
      expect(response.body.data.summary.totalExperiences).toBe(totalNodes);
    }, 300000); // 5 minute timeout for large dataset test

    it('should handle large dataset filtering efficiently', async () => {
      // Assume previous test created 1000 nodes
      const endMeasurement = monitor.startMeasurement('large-dataset-filter');
      
      const response = await request(app)
        .get('/api/v1/work-experiences')
        .query({ limit: 100, offset: 0 });

      const duration = endMeasurement();

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
      expect(response.body.data).toHaveLength(100);
    });

    it('should handle pagination efficiently with large datasets', async () => {
      const pageSize = 50;
      const pagesToTest = 20;

      for (let page = 0; page < pagesToTest; page++) {
        const endMeasurement = monitor.startMeasurement('pagination-performance');
        
        const response = await request(app)
          .get('/api/v1/work-experiences')
          .query({ limit: pageSize, offset: page * pageSize });

        const duration = endMeasurement();

        expect(response.status).toBe(200);
        expect(duration).toBeLessThan(300);
      }

      const stats = monitor.getStatistics('pagination-performance');
      expect(stats?.avg).toBeLessThan(250);
    });
  });

  describe('Concurrent User Scenarios', () => {
    it('should handle concurrent read operations', async () => {
      // Create test data first
      const setupData = [];
      for (let i = 0; i < 10; i++) {
        setupData.push(
          request(app).post('/api/v1/work-experiences').send({
            title: `Concurrent Test ${i}`,
            company: `Company ${i}`,
            position: `Developer ${i}`,
            startDate: '2024-01-01',
            employmentType: 'full-time',
          })
        );
      }
      await Promise.all(setupData);

      // Simulate 50 concurrent users reading data
      const concurrentReads = [];
      for (let i = 0; i < 50; i++) {
        concurrentReads.push(async () => {
          const endMeasurement = monitor.startMeasurement('concurrent-reads');
          
          const response = await request(app)
            .get('/api/v1/work-experiences');

          const duration = endMeasurement();
          expect(response.status).toBe(200);
          return duration;
        });
      }

      const startTime = performance.now();
      await Promise.all(concurrentReads.map(read => read()));
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      const stats = monitor.getStatistics('concurrent-reads');
      expect(stats?.avg).toBeLessThan(500);
    });

    it('should handle concurrent write operations', async () => {
      const concurrentWrites = [];
      
      for (let i = 0; i < 20; i++) {
        concurrentWrites.push(async () => {
          const endMeasurement = monitor.startMeasurement('concurrent-writes');
          
          const response = await request(app)
            .post('/api/v1/work-experiences')
            .send({
              title: `Concurrent Write ${i}`,
              company: `Concurrent Corp ${i}`,
              position: `Developer ${i}`,
              startDate: '2024-01-01',
              employmentType: 'full-time',
            });

          const duration = endMeasurement();
          expect(response.status).toBe(201);
          return duration;
        });
      }

      const startTime = performance.now();
      await Promise.all(concurrentWrites.map(write => write()));
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      const stats = monitor.getStatistics('concurrent-writes');
      expect(stats?.avg).toBeLessThan(1000);
    });

    it('should handle mixed concurrent operations', async () => {
      // Setup some data for reads
      const setupPromises = [];
      for (let i = 0; i < 5; i++) {
        setupPromises.push(
          request(app).post('/api/v1/work-experiences').send({
            title: `Mixed Test ${i}`,
            company: `Mixed Corp ${i}`,
            position: `Developer ${i}`,
            startDate: '2024-01-01',
            employmentType: 'full-time',
          })
        );
      }
      await Promise.all(setupPromises);

      // Mix of reads, writes, and aggregations
      const mixedOperations = [];

      // 20 reads
      for (let i = 0; i < 20; i++) {
        mixedOperations.push(
          request(app).get('/api/v1/work-experiences')
        );
      }

      // 10 writes
      for (let i = 0; i < 10; i++) {
        mixedOperations.push(
          request(app).post('/api/v1/work-experiences').send({
            title: `Mixed Write ${i}`,
            company: `Mixed Write Corp ${i}`,
            position: `Developer ${i}`,
            startDate: '2024-01-01',
            employmentType: 'full-time',
          })
        );
      }

      // 5 aggregations
      for (let i = 0; i < 5; i++) {
        mixedOperations.push(
          request(app).get('/api/v1/nodes/profile/aggregate')
        );
      }

      const startTime = performance.now();
      const responses = await Promise.all(mixedOperations);
      const totalTime = performance.now() - startTime;

      // All operations should succeed
      responses.forEach(response => {
        expect([200, 201]).toContain(response.status);
      });

      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post('/api/v1/work-experiences')
          .send({
            title: `Memory Test ${i}`,
            company: `Memory Corp ${i}`,
            position: `Developer ${i}`,
            startDate: '2024-01-01',
            employmentType: 'full-time',
          });

        if (i % 10 === 0) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  afterEach(async () => {
    await testDb.resetTestUserData();
    
    // Log performance statistics
    console.log('\nPerformance Statistics:');
    ['create-work-experience', 'profile-aggregation', 'concurrent-reads'].forEach(label => {
      const stats = monitor.getStatistics(label);
      if (stats) {
        console.log(`${label}:`, {
          avg: `${stats.avg.toFixed(2)}ms`,
          p95: `${stats.p95.toFixed(2)}ms`,
          max: `${stats.max.toFixed(2)}ms`,
          count: stats.count,
        });
      }
    });
    
    monitor.reset();
  });
});