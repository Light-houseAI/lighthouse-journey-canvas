#!/usr/bin/env tsx
/**
 * Combined GraphRAG Pipeline: Generate Profiles and Load to PostgreSQL
 * 
 * This script combines step-1-generate-profiles.ts and step-2-load-to-postgres.ts
 * into a single workflow for easier execution.
 * 
 * Usage:
 *   npx tsx server/scripts/graphrag-pipeline/generate-and-load.ts --count 10
 *   npx tsx server/scripts/graphrag-pipeline/generate-and-load.ts --count 5 --role engineer
 *   npx tsx server/scripts/graphrag-pipeline/generate-and-load.ts --count 100 --batch-size 10
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

interface PipelineOptions {
  count: number;
  role?: 'engineer' | 'pm' | 'designer';
  batchSize: number;
  skipGeneration: boolean;
  skipLoading: boolean;
}

class GraphRAGPipeline {
  private scriptDir: string;
  private dataDir: string;

  constructor() {
    this.scriptDir = __dirname;
    this.dataDir = path.join(process.cwd(), 'server', 'scripts', 'graphrag-pipeline', 'data', 'profiles');
  }

  /**
   * Run profile generation step
   */
  async runGeneration(options: PipelineOptions): Promise<void> {
    console.log('🚀 Step 1: Generating career profiles...\n');
    
    const generatorScript = path.join(this.scriptDir, 'step-1-generate-profiles.ts');
    const args = [
      'npx', 'tsx', generatorScript,
      '--count', options.count.toString()
    ];
    
    if (options.role) {
      args.push('--role', options.role);
    }
    
    try {
      execSync(args.join(' '), { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Profile generation completed successfully!\n');
    } catch (error) {
      console.error('❌ Profile generation failed:', error);
      throw error;
    }
  }

  /**
   * Run PostgreSQL loading step
   */
  async runLoading(options: PipelineOptions): Promise<void> {
    console.log('🚀 Step 2: Loading profiles to PostgreSQL...\n');
    
    const loaderScript = path.join(this.scriptDir, 'step-2-load-to-postgres.ts');
    const args = [
      'npx', 'tsx', loaderScript,
      '--batch-size', options.batchSize.toString()
    ];
    
    try {
      execSync(args.join(' '), { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ PostgreSQL loading completed successfully!\n');
    } catch (error) {
      console.error('❌ PostgreSQL loading failed:', error);
      throw error;
    }
  }

  /**
   * Validate that profiles exist
   */
  async validateProfiles(): Promise<number> {
    try {
      const files = await fs.readdir(this.dataDir);
      const profileFiles = files.filter(file => file.endsWith('.json'));
      console.log(`📁 Found ${profileFiles.length} profile files in ${this.dataDir}`);
      return profileFiles.length;
    } catch (error) {
      console.warn('⚠️ Could not validate profiles directory:', error);
      return 0;
    }
  }

  /**
   * Run the complete pipeline
   */
  async runPipeline(options: PipelineOptions): Promise<void> {
    console.log('🎯 GraphRAG Pipeline Starting...\n');
    console.log(`Configuration:`);
    console.log(`  - Profile count: ${options.count}`);
    console.log(`  - Role filter: ${options.role || 'all'}`);
    console.log(`  - Batch size: ${options.batchSize}`);
    console.log(`  - Skip generation: ${options.skipGeneration}`);
    console.log(`  - Skip loading: ${options.skipLoading}\n`);

    const startTime = Date.now();

    try {
      // Step 1: Generate profiles (unless skipped)
      if (!options.skipGeneration) {
        await this.runGeneration(options);
      } else {
        console.log('⏭️ Skipping profile generation\n');
      }

      // Validate profiles exist
      const profileCount = await this.validateProfiles();
      if (profileCount === 0 && !options.skipGeneration) {
        throw new Error('No profiles found after generation');
      }

      // Step 2: Load to PostgreSQL (unless skipped)
      if (!options.skipLoading) {
        await this.runLoading(options);
      } else {
        console.log('⏭️ Skipping PostgreSQL loading\n');
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`🎉 GraphRAG Pipeline completed successfully in ${duration}s!`);
      
      if (!options.skipLoading) {
        console.log('🔍 Timeline nodes have been automatically synced to pgvector');
        console.log('🚀 Ready for GraphRAG search queries!');
      }

    } catch (error) {
      console.error('❌ Pipeline failed:', error);
      throw error;
    }
  }
}

// CLI parsing
function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  
  const countIndex = args.indexOf('--count');
  const roleIndex = args.indexOf('--role');
  const batchSizeIndex = args.indexOf('--batch-size');
  const skipGeneration = args.includes('--skip-generation');
  const skipLoading = args.includes('--skip-loading');

  const count = countIndex !== -1 ? parseInt(args[countIndex + 1]) : 10;
  const role = roleIndex !== -1 ? args[roleIndex + 1] as 'engineer' | 'pm' | 'designer' : undefined;
  const batchSize = batchSizeIndex !== -1 ? parseInt(args[batchSizeIndex + 1]) : 5;

  // Validation
  if (isNaN(count) || count < 1) {
    console.error('❌ Invalid count. Please provide a positive number.');
    process.exit(1);
  }

  if (isNaN(batchSize) || batchSize < 1) {
    console.error('❌ Invalid batch size. Please provide a positive number.');
    process.exit(1);
  }

  if (role && !['engineer', 'pm', 'designer'].includes(role)) {
    console.error('❌ Invalid role. Must be one of: engineer, pm, designer');
    process.exit(1);
  }

  if (skipGeneration && skipLoading) {
    console.error('❌ Cannot skip both generation and loading steps.');
    process.exit(1);
  }

  return {
    count,
    role,
    batchSize,
    skipGeneration,
    skipLoading
  };
}

// Main execution
async function main() {
  const options = parseArgs();
  const pipeline = new GraphRAGPipeline();
  
  try {
    await pipeline.runPipeline(options);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
GraphRAG Pipeline - Generate and Load Career Profiles

Usage:
  npx tsx server/scripts/graphrag-pipeline/generate-and-load.ts [options]

Options:
  --count <number>        Number of profiles to generate (default: 10)
  --role <role>          Filter by role: engineer, pm, designer (default: all)
  --batch-size <number>   PostgreSQL batch size (default: 5)
  --skip-generation      Skip profile generation step
  --skip-loading         Skip PostgreSQL loading step
  --help, -h             Show this help message

Examples:
  # Generate 10 profiles and load to PostgreSQL
  npx tsx server/scripts/graphrag-pipeline/generate-and-load.ts --count 10

  # Generate 5 engineer profiles with larger batch size
  npx tsx server/scripts/graphrag-pipeline/generate-and-load.ts --count 5 --role engineer --batch-size 10

  # Only load existing profiles (skip generation)
  npx tsx server/scripts/graphrag-pipeline/generate-and-load.ts --skip-generation --batch-size 10

  # Only generate profiles (skip loading)
  npx tsx server/scripts/graphrag-pipeline/generate-and-load.ts --count 20 --skip-loading
`);
  process.exit(0);
}

// Run if executed directly
main().catch(console.error);