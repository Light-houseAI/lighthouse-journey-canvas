#!/usr/bin/env tsx

/**
 * Timeline Node Closure Table Population Script
 *
 * This script populates the timeline_node_closure table from existing timeline_nodes data
 * to enable efficient hierarchical queries. The closure table stores all ancestor-descendant
 * relationships with their depths for fast hierarchy operations.
 * 
 * Usage:
 *   npx tsx populate-closure-table.ts
 *   npx tsx populate-closure-table.ts --force
 *   npx tsx populate-closure-table.ts --verify-only
 */

import { Command } from 'commander';
import { Pool } from 'pg';
import ora from 'ora';

// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/lighthouse_journey';

interface PopulationOptions {
  force: boolean;
  verifyOnly: boolean;
}

class ClosureTableManager {
  private pool: Pool;
  private spinner = ora();

  constructor() {
    this.pool = new Pool({
      connectionString: DATABASE_URL,
    });
  }

  /**
   * Check current state of closure table
   */
  async checkCurrentState() {
    this.spinner.start('Analyzing current state...');

    const [nodeCount, closureCount] = await Promise.all([
      this.pool.query('SELECT COUNT(*) as count FROM timeline_nodes'),
      this.pool.query('SELECT COUNT(*) as count FROM timeline_node_closure'),
    ]);

    const nodes = parseInt(nodeCount.rows[0].count);
    const closureEntries = parseInt(closureCount.rows[0].count);

    this.spinner.succeed('Current state analyzed');

    return { nodes, closureEntries };
  }

  /**
   * Verify closure table integrity
   */
  async verifyIntegrity() {
    this.spinner.start('Verifying closure table integrity...');

    try {
      // Check 1: Every node should have a self-reference
      const selfRefCheck = await this.pool.query(`
        SELECT COUNT(*) as missing_self_refs
        FROM timeline_nodes tn
        LEFT JOIN timeline_node_closure tnc ON tnc.ancestor_id = tn.id 
          AND tnc.descendant_id = tn.id 
          AND tnc.depth = 0
        WHERE tnc.ancestor_id IS NULL
      `);

      // Check 2: Parent-child relationships should exist in closure table
      const parentChildCheck = await this.pool.query(`
        SELECT COUNT(*) as missing_parent_child
        FROM timeline_nodes child
        JOIN timeline_nodes parent ON parent.id = child.parent_id
        LEFT JOIN timeline_node_closure tnc ON tnc.ancestor_id = parent.id 
          AND tnc.descendant_id = child.id 
          AND tnc.depth = 1
        WHERE tnc.ancestor_id IS NULL
      `);

      // Check 3: Depth statistics
      const depthStats = await this.pool.query(`
        SELECT depth, COUNT(*) as count
        FROM timeline_node_closure
        GROUP BY depth
        ORDER BY depth
      `);

      const missingSelfRefs = parseInt(selfRefCheck.rows[0].missing_self_refs);
      const missingParentChild = parseInt(parentChildCheck.rows[0].missing_parent_child);

      if (missingSelfRefs === 0 && missingParentChild === 0) {
        this.spinner.succeed('✅ Closure table integrity verified');
      } else {
        this.spinner.fail('❌ Closure table has integrity issues');
      }

      console.log('\n📊 Integrity Check Results:');
      console.log(`  Missing self-references: ${missingSelfRefs}`);
      console.log(`  Missing parent-child relationships: ${missingParentChild}`);
      
      console.log('\n📈 Depth Distribution:');
      depthStats.rows.forEach((row: any) => {
        const label = row.depth === 0 ? 'Self-references' : `Depth ${row.depth}`;
        console.log(`  ${label}: ${row.count} relationships`);
      });

      return { valid: missingSelfRefs === 0 && missingParentChild === 0, stats: depthStats.rows };
    } catch (error) {
      this.spinner.fail('Failed to verify integrity');
      throw error;
    }
  }

  /**
   * Clear existing closure table data
   */
  async clearClosureTable() {
    this.spinner.start('Clearing existing closure table data...');
    
    try {
      const result = await this.pool.query('DELETE FROM timeline_node_closure');
      const deletedCount = result.rowCount || 0;
      
      this.spinner.succeed(`Cleared ${deletedCount} existing closure entries`);
      return deletedCount;
    } catch (error) {
      this.spinner.fail('Failed to clear closure table');
      throw error;
    }
  }

  /**
   * Rebuild closure table using recursive CTE
   */
  async rebuildClosureTable() {
    this.spinner.start('Rebuilding closure table with recursive CTE...');

    try {
      const result = await this.pool.query(`
        WITH RECURSIVE node_paths AS (
          -- Base case: all nodes are ancestors of themselves at depth 0
          SELECT id as ancestor_id, id as descendant_id, 0 as depth
          FROM timeline_nodes
          
          UNION ALL
          
          -- Recursive case: for each node, find its children and extend paths
          SELECT np.ancestor_id, tn.id as descendant_id, np.depth + 1
          FROM node_paths np
          JOIN timeline_nodes tn ON tn.parent_id = np.descendant_id
          WHERE np.depth < 100  -- Prevent infinite recursion (max depth)
        )
        INSERT INTO timeline_node_closure (ancestor_id, descendant_id, depth)
        SELECT ancestor_id, descendant_id, depth
        FROM node_paths
      `);

      const insertedCount = result.rowCount || 0;
      this.spinner.succeed(`Rebuilt closure table with ${insertedCount} entries`);
      
      return insertedCount;
    } catch (error) {
      this.spinner.fail('Failed to rebuild closure table');
      throw error;
    }
  }

  /**
   * Show sample closure relationships
   */
  async showSampleRelationships() {
    const sampleData = await this.pool.query(`
      SELECT 
        tnc.ancestor_id,
        tnc.descendant_id,
        tnc.depth,
        a.type as ancestor_type,
        d.type as descendant_type,
        COALESCE(a_meta.title, a_meta.role, a_meta.degree) as ancestor_title,
        COALESCE(d_meta.title, d_meta.role, d_meta.degree) as descendant_title
      FROM timeline_node_closure tnc
      JOIN timeline_nodes a ON a.id = tnc.ancestor_id
      JOIN timeline_nodes d ON d.id = tnc.descendant_id,
      LATERAL (SELECT (a.meta->>'title') as title, (a.meta->>'role') as role, (a.meta->>'degree') as degree) a_meta,
      LATERAL (SELECT (d.meta->>'title') as title, (d.meta->>'role') as role, (d.meta->>'degree') as degree) d_meta
      WHERE tnc.depth > 0
      ORDER BY tnc.depth ASC, tnc.ancestor_id
      LIMIT 10
    `);

    if (sampleData.rows.length > 0) {
      console.log('\n🔗 Sample closure relationships:');
      sampleData.rows.forEach((row: any) => {
        const ancestorName = row.ancestor_title || row.ancestor_type;
        const descendantName = row.descendant_title || row.descendant_type;
        console.log(`  ${ancestorName} (${row.ancestor_type}) -> ${descendantName} (${row.descendant_type}) [depth: ${row.depth}]`);
      });
    }
  }

  /**
   * Main population function
   */
  async populate(options: PopulationOptions) {
    console.log('🚀 Timeline Node Closure Table Manager\n');

    try {
      // Check current state
      const { nodes, closureEntries } = await this.checkCurrentState();
      
      console.log('📋 Current State:');
      console.log(`  Timeline nodes: ${nodes}`);
      console.log(`  Closure entries: ${closureEntries}\n`);

      // Handle verify-only mode
      if (options.verifyOnly) {
        await this.verifyIntegrity();
        return;
      }

      // Check if already populated
      if (closureEntries > 0 && !options.force) {
        console.log('⚠️  Closure table already contains data');
        console.log('   Use --force to rebuild from scratch');
        console.log('   Use --verify-only to check integrity\n');
        
        await this.verifyIntegrity();
        return;
      }

      if (nodes === 0) {
        console.log('ℹ️  No timeline nodes found - nothing to populate');
        return;
      }

      // Clear existing data if force rebuild
      if (closureEntries > 0) {
        console.log('🔄 Force rebuild requested\n');
        await this.clearClosureTable();
      }

      // Rebuild closure table
      const insertedCount = await this.rebuildClosureTable();

      // Verify the results
      console.log('\n🔍 Verifying results...');
      const { valid } = await this.verifyIntegrity();

      // Show sample relationships
      await this.showSampleRelationships();

      // Summary
      console.log('\n✅ Closure table population completed successfully!');
      console.log('📊 Summary:');
      console.log(`  Original nodes: ${nodes}`);
      console.log(`  Closure entries created: ${insertedCount}`);
      console.log(`  Integrity check: ${valid ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (valid) {
        console.log('\n🎉 Your closure table is ready for efficient hierarchy queries!');
      }

    } catch (error) {
      console.error('❌ Population failed:', error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      await this.pool.end();
    }
  }
}

// CLI Setup
const program = new Command();

program
  .name('populate-closure-table')
  .description('Populate timeline_node_closure table for efficient hierarchy queries')
  .option('-f, --force', 'Force rebuild even if closure table has data', false)
  .option('-v, --verify-only', 'Only verify integrity without rebuilding', false)
  .action(async (options) => {
    const opts: PopulationOptions = {
      force: options.force,
      verifyOnly: options.verifyOnly,
    };

    const manager = new ClosureTableManager();

    try {
      await manager.populate(opts);
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

program.parse();

export { ClosureTableManager };