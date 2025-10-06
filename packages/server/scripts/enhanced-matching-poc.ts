#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { UnifiedMatchingPipelineService } from '../src/services/unified-matching-pipeline.service';
import { LLMSkillExtractionService } from '../src/services/llm-skill-extraction.service';
import { OpenAIEmbeddingService } from '../src/services/openai-embedding.service';
import { ActivityScoringService } from '../src/services/activity-scoring.service';
import { AISDKLLMProvider } from '../src/core/llm-provider';
import { timelineNodes, users } from '@journey/schema';
import * as schema from '@journey/schema';
import { eq, sql } from 'drizzle-orm';
import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

/**
 * Enhanced POC demonstrating updates and insights integration
 */
class EnhancedMatchingDemo {
  private pipeline: UnifiedMatchingPipelineService;
  private activityService: ActivityScoringService;

  constructor() {
    const llmProvider = new AISDKLLMProvider({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o-mini',
      temperature: 0.3,
    });

    const llmService = new LLMSkillExtractionService(llmProvider);
    const embeddingService = new OpenAIEmbeddingService(process.env.OPENAI_API_KEY || '');
    this.pipeline = new UnifiedMatchingPipelineService(db, llmService, embeddingService);
    this.activityService = new ActivityScoringService(db, llmService);
  }

  async run() {
    console.log(
      boxen(
        chalk.bold.cyan('🚀 Enhanced Matching POC with Activity & Insights'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'double',
        }
      )
    );

    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Select demo mode:',
        choices: [
          { name: '📊 Compare Standard vs Enhanced Matching', value: 'compare' },
          { name: '🔥 Activity Scoring Deep Dive', value: 'activity' },
          { name: '💡 Insight Relevance Analysis', value: 'insights' },
          { name: '🎯 Full Enhanced Matching', value: 'full' },
          { name: '⚡ Performance Benchmark', value: 'benchmark' },
        ],
      },
    ]);

    switch (mode) {
      case 'compare':
        await this.compareMatchingModes();
        break;
      case 'activity':
        await this.activityScoringDemo();
        break;
      case 'insights':
        await this.insightRelevanceDemo();
        break;
      case 'full':
        await this.fullEnhancedDemo();
        break;
      case 'benchmark':
        await this.performanceBenchmark();
        break;
    }
  }

  /**
   * Compare standard vs enhanced matching
   */
  private async compareMatchingModes() {
    console.log(chalk.bold.yellow('\n📊 Comparing Standard vs Enhanced Matching\n'));

    // Get a sample job node
    const jobNode = await db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.type, 'job'))
      .limit(1);

    if (!jobNode[0]) {
      console.log(chalk.red('No job nodes found'));
      return;
    }

    const context = {
      nodeId: jobNode[0].id,
      nodeType: 'job' as const,
      userId: jobNode[0].userId,
      limit: 5,
    };

    // Standard matching
    console.log(chalk.cyan('Standard Matching (Skills + Role + Seniority):'));
    console.time('Standard Matching Time');

    const standardResult = await this.pipeline.findMatches(context);

    console.timeEnd('Standard Matching Time');
    this.displayResults(standardResult, false);

    console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));

    // Enhanced matching
    console.log(chalk.green('Enhanced Matching (+ Activity Signals + Insights):'));
    console.time('Enhanced Matching Time');

    const enhancedResult = await this.pipeline.findMatches({
      ...context,
      includeActivitySignals: true,
      includeInsights: true,
    });

    console.timeEnd('Enhanced Matching Time');
    this.displayResults(enhancedResult, true);

    // Show improvement metrics
    this.showImprovementMetrics(standardResult, enhancedResult);
  }

  /**
   * Deep dive into activity scoring
   */
  private async activityScoringDemo() {
    console.log(chalk.bold.yellow('\n🔥 Activity Scoring Analysis\n'));

    // Get sample users
    const sampleUsers = await db
      .select()
      .from(users)
      .limit(5);

    for (const user of sampleUsers) {
      console.log(chalk.cyan(`\nUser: ${user.firstName} ${user.lastName}`));

      const activityScore = await this.activityService.getActivityScore(user.id);

      // Display activity score breakdown
      console.log(chalk.white('Activity Score: ') + this.getScoreBar(activityScore.score));
      console.log(chalk.gray(`  Raw Score: ${(activityScore.score * 100).toFixed(1)}%`));

      if (activityScore.activeJobSearch) {
        console.log(chalk.green('  ✅ Active Job Seeker'));
      } else {
        console.log(chalk.gray('  ○ Not actively searching'));
      }

      if (activityScore.signals.length > 0) {
        console.log(chalk.yellow('  Signals:'));
        activityScore.signals.forEach(signal => {
          console.log(chalk.gray(`    • ${signal}`));
        });
      }

      // Show impact on matching
      if (activityScore.score > 0.5) {
        console.log(chalk.magenta(`  📈 Boosted in rankings (+${(activityScore.score * 15).toFixed(0)}% weight)`));
      }
    }
  }

  /**
   * Demonstrate insight relevance scoring
   */
  private async insightRelevanceDemo() {
    console.log(chalk.bold.yellow('\n💡 Insight Relevance Analysis\n'));

    // Get a job node with insights
    const jobNode = await db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.type, 'job'))
      .limit(1);

    if (!jobNode[0]) {
      console.log(chalk.red('No job nodes found'));
      return;
    }

    console.log(chalk.cyan(`Query Node: ${jobNode[0].title}`));
    console.log(chalk.gray(`Description: ${jobNode[0].description?.substring(0, 100)}...`));

    // Get candidates and their insights
    const candidates = await db
      .select()
      .from(users)
      .limit(3);

    for (const candidate of candidates) {
      console.log(chalk.yellow(`\n\nCandidate: ${candidate.firstName} ${candidate.lastName}`));

      const insightRelevance = await this.activityService.getInsightRelevance(
        jobNode[0].id,
        candidate.id
      );

      console.log(chalk.white('Insight Relevance: ') + this.getScoreBar(insightRelevance.score));

      if (insightRelevance.relevantInsights.length > 0) {
        console.log(chalk.green('  Relevant Insights:'));
        insightRelevance.relevantInsights.forEach((insight, idx) => {
          console.log(chalk.gray(`    ${idx + 1}. ${insight.description}`));
          console.log(chalk.dim(`       Relevance: ${(insight.relevanceScore * 100).toFixed(0)}%`));
        });
      } else {
        console.log(chalk.gray('  No relevant insights found'));
      }
    }
  }

  /**
   * Full enhanced matching demo
   */
  private async fullEnhancedDemo() {
    console.log(chalk.bold.yellow('\n🎯 Full Enhanced Matching Demo\n'));

    const { nodeType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'nodeType',
        message: 'Select node type:',
        choices: ['job', 'project', 'event', 'education'],
      },
    ]);

    // Get sample node
    const node = await db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.type, nodeType))
      .limit(1);

    if (!node[0]) {
      console.log(chalk.red(`No ${nodeType} nodes found`));
      return;
    }

    const context = {
      nodeId: node[0].id,
      nodeType: nodeType as any,
      userId: node[0].userId,
      limit: 10,
      includeActivitySignals: true,
      includeInsights: true,
    };

    console.log(chalk.cyan(`Matching for: ${node[0].title}`));
    console.log(chalk.gray('─'.repeat(60)));

    const startTime = Date.now();
    const result = await this.pipeline.findMatches(context);
    const duration = Date.now() - startTime;

    // Display comprehensive results
    console.log(chalk.green(`\n✅ Found ${result.matches.length} matches in ${duration}ms`));
    console.log(chalk.yellow(`Strategy: ${result.strategy}`));

    // Display matches with full scoring breakdown
    result.matches.slice(0, 5).forEach((match: any, idx: number) => {
      console.log(chalk.bold.white(`\n${idx + 1}. ${match.title || match.name}`));

      // Score breakdown
      console.log('   ' + this.getScoreBar(match.score));
      console.log(chalk.gray(`   Overall: ${(match.score * 100).toFixed(1)}%`));

      if (match.skillsSimilarity !== undefined) {
        console.log(chalk.blue(`   Skills: ${(match.skillsSimilarity * 100).toFixed(0)}%`));
      }
      if (match.roleMatch !== undefined) {
        console.log(chalk.cyan(`   Role: ${(match.roleMatch * 100).toFixed(0)}%`));
      }
      if (match.activityScore !== undefined) {
        console.log(chalk.green(`   Activity: ${(match.activityScore * 100).toFixed(0)}%`));
        if (match.activitySignals?.length) {
          console.log(chalk.dim(`     Signals: ${match.activitySignals.join(', ')}`));
        }
      }
      if (match.insightRelevance !== undefined) {
        console.log(chalk.magenta(`   Insights: ${(match.insightRelevance * 100).toFixed(0)}%`));
        if (match.relevantInsights?.length) {
          console.log(chalk.dim(`     Top insight: ${match.relevantInsights[0].description.substring(0, 50)}...`));
        }
      }
    });

    // Display insights
    if (result.insights.length > 0) {
      console.log(chalk.bold.yellow('\n📊 Insights:'));
      result.insights.forEach(insight => {
        const icon = this.getInsightIcon(insight.type);
        console.log(`${icon} ${chalk.white(insight.title)}`);
        console.log(chalk.gray(`   ${insight.description}`));
      });
    }

    // Display recommendations
    if (result.recommendations && result.recommendations.length > 0) {
      console.log(chalk.bold.cyan('\n💡 Recommendations:'));
      result.recommendations.forEach(rec => {
        console.log(chalk.gray(`  • ${rec}`));
      });
    }
  }

  /**
   * Performance benchmark
   */
  private async performanceBenchmark() {
    console.log(chalk.bold.yellow('\n⚡ Performance Benchmark\n'));

    const iterations = 10;
    const results = {
      standard: [] as number[],
      enhanced: [] as number[],
      cached: [] as number[],
    };

    // Get test node
    const node = await db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.type, 'job'))
      .limit(1);

    if (!node[0]) {
      console.log(chalk.red('No job nodes found'));
      return;
    }

    const baseContext = {
      nodeId: node[0].id,
      nodeType: 'job' as const,
      userId: node[0].userId,
      limit: 20,
    };

    console.log(chalk.cyan('Running benchmarks...'));

    // Benchmark standard matching
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.pipeline.findMatches(baseContext);
      results.standard.push(Date.now() - start);
      this.pipeline.clearCache();
    }

    // Benchmark enhanced matching
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.pipeline.findMatches({
        ...baseContext,
        includeActivitySignals: true,
        includeInsights: true,
      });
      results.enhanced.push(Date.now() - start);
      this.pipeline.clearCache();
    }

    // Benchmark cached matching
    await this.pipeline.findMatches(baseContext); // Warm cache
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.pipeline.findMatches(baseContext);
      results.cached.push(Date.now() - start);
    }

    // Display results
    console.log(chalk.green('\n📈 Benchmark Results:\n'));

    const avgStandard = results.standard.reduce((a, b) => a + b, 0) / iterations;
    const avgEnhanced = results.enhanced.reduce((a, b) => a + b, 0) / iterations;
    const avgCached = results.cached.reduce((a, b) => a + b, 0) / iterations;

    console.log(chalk.white('Standard Matching:'));
    console.log(chalk.gray(`  Average: ${avgStandard.toFixed(2)}ms`));
    console.log(chalk.gray(`  Min: ${Math.min(...results.standard)}ms`));
    console.log(chalk.gray(`  Max: ${Math.max(...results.standard)}ms`));

    console.log(chalk.white('\nEnhanced Matching:'));
    console.log(chalk.gray(`  Average: ${avgEnhanced.toFixed(2)}ms`));
    console.log(chalk.gray(`  Min: ${Math.min(...results.enhanced)}ms`));
    console.log(chalk.gray(`  Max: ${Math.max(...results.enhanced)}ms`));
    console.log(chalk.yellow(`  Overhead: +${((avgEnhanced - avgStandard) / avgStandard * 100).toFixed(1)}%`));

    console.log(chalk.white('\nCached Matching:'));
    console.log(chalk.gray(`  Average: ${avgCached.toFixed(2)}ms`));
    console.log(chalk.green(`  Speedup: ${(avgStandard / avgCached).toFixed(1)}x faster`));

    // Show optimization suggestions
    console.log(chalk.bold.cyan('\n🎯 Optimization Insights:'));
    if (avgEnhanced - avgStandard > 100) {
      console.log(chalk.yellow('  ⚠️ Enhanced matching adds significant overhead'));
      console.log(chalk.gray('     Consider caching activity scores'));
    } else {
      console.log(chalk.green('  ✅ Enhanced matching overhead is acceptable'));
    }

    if (avgCached < avgStandard * 0.2) {
      console.log(chalk.green('  ✅ Cache is highly effective'));
    }
  }

  /**
   * Helper: Display results
   */
  private displayResults(result: any, enhanced: boolean) {
    console.log(chalk.gray(`Found ${result.matches.length} matches`));

    result.matches.slice(0, 3).forEach((match: any, idx: number) => {
      console.log(chalk.white(`${idx + 1}. ${match.title || match.name || 'Unknown'}`));
      console.log('   ' + this.getScoreBar(match.score));

      if (enhanced && match.activityScore) {
        console.log(chalk.green(`   + Activity boost: ${(match.activityScore * 100).toFixed(0)}%`));
      }
      if (enhanced && match.insightRelevance) {
        console.log(chalk.magenta(`   + Insight relevance: ${(match.insightRelevance * 100).toFixed(0)}%`));
      }
    });
  }

  /**
   * Helper: Show improvement metrics
   */
  private showImprovementMetrics(standard: any, enhanced: any) {
    console.log(chalk.bold.yellow('\n📊 Improvement Metrics:'));

    // Calculate average score improvement
    const standardAvg = standard.matches.reduce((sum: number, m: any) => sum + m.score, 0) / standard.matches.length;
    const enhancedAvg = enhanced.matches.reduce((sum: number, m: any) => sum + m.score, 0) / enhanced.matches.length;

    const improvement = ((enhancedAvg - standardAvg) / standardAvg * 100);

    if (improvement > 0) {
      console.log(chalk.green(`  ✅ Average score improved by ${improvement.toFixed(1)}%`));
    } else {
      console.log(chalk.yellow(`  ○ Average score changed by ${improvement.toFixed(1)}%`));
    }

    // Count active job seekers found
    const activeCount = enhanced.matches.filter((m: any) => m.activityScore && m.activityScore > 0.5).length;
    if (activeCount > 0) {
      console.log(chalk.green(`  ✅ Found ${activeCount} active job seekers`));
    }

    // Count insightful matches
    const insightCount = enhanced.matches.filter((m: any) => m.insightRelevance && m.insightRelevance > 0.3).length;
    if (insightCount > 0) {
      console.log(chalk.green(`  ✅ Found ${insightCount} candidates with relevant insights`));
    }

    // Additional insights generated
    const extraInsights = enhanced.insights.length - standard.insights.length;
    if (extraInsights > 0) {
      console.log(chalk.green(`  ✅ Generated ${extraInsights} additional insights`));
    }
  }

  /**
   * Helper: Get visual score bar
   */
  private getScoreBar(score: number): string {
    const percentage = Math.round(score * 100);
    const filled = Math.round(score * 20);
    const empty = 20 - filled;

    let color = chalk.red;
    if (percentage >= 80) color = chalk.green;
    else if (percentage >= 60) color = chalk.yellow;
    else if (percentage >= 40) color = chalk.cyan;

    return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty)) + ` ${percentage}%`;
  }

  /**
   * Helper: Get insight icon
   */
  private getInsightIcon(type: string): string {
    switch (type) {
      case 'pattern': return '🔄';
      case 'trend': return '📈';
      case 'tip': return '💡';
      case 'success-factor': return '⭐';
      default: return '📊';
    }
  }
}

// Run the demo
async function main() {
  try {
    const demo = new EnhancedMatchingDemo();
    await demo.run();

    const { runAgain } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'runAgain',
        message: 'Run another demo?',
        default: true,
      },
    ]);

    if (runAgain) {
      await main();
    } else {
      console.log(chalk.green('\n✨ Demo completed successfully!'));
      process.exit(0);
    }
  } catch (error) {
    console.error(chalk.red('Error running demo:'), error);
    process.exit(1);
  }
}

main();