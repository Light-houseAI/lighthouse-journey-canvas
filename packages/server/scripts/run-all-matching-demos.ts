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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

class AllMatchingDemos {
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

  async runAll() {
    console.log(chalk.bold.cyan('\n🚀 Running All Enhanced Matching Demos\n'));

    await this.demo2_activityScoring();
    console.log('\n' + '='.repeat(80) + '\n');

    await this.demo3_insightRelevance();
    console.log('\n' + '='.repeat(80) + '\n');

    await this.demo4_fullEnhanced();

    await pool.end();
  }

  /**
   * Demo 2: Activity Scoring Deep Dive
   */
  private async demo2_activityScoring() {
    console.log(chalk.bold.yellow('🔥 Activity Scoring Deep Dive\n'));

    // Find user with most updates
    const usersWithUpdates = await db.execute(sql`
      SELECT u.id, u.email, u.first_name, u.last_name, COUNT(up.id) as update_count
      FROM users u
      JOIN timeline_nodes tn ON tn.user_id = u.id
      JOIN updates up ON up.node_id = tn.id
      GROUP BY u.id, u.email, u.first_name, u.last_name
      ORDER BY update_count DESC
      LIMIT 5
    `);

    console.log(chalk.cyan('Top 5 users by update count:'));
    for (const user of usersWithUpdates.rows) {
      console.log(`  - ${user.first_name} ${user.last_name} (${user.email}): ${user.update_count} updates`);
    }

    const topUser = usersWithUpdates.rows[0];
    if (!topUser) {
      console.log(chalk.red('No users with updates found'));
      return;
    }

    console.log(chalk.cyan(`\nAnalyzing activity for: ${topUser.first_name} ${topUser.last_name}`));

    // Get activity score
    const activityScore = await this.activityService.getActivityScore(Number(topUser.id));
    console.log(chalk.green(`\n📊 Activity Score: ${activityScore.score.toFixed(2)}`));
    console.log(chalk.gray(`   Recent activity: ${activityScore.recentActivityCount}`));
    console.log(chalk.gray(`   Is active seeker: ${activityScore.isActiveSeeker}`));

    // Get their updates
    const updates = await db.execute(sql`
      SELECT up.notes as content, up.meta, up.created_at
      FROM updates up
      JOIN timeline_nodes tn ON tn.id = up.node_id
      WHERE tn.user_id = ${topUser.id}
      ORDER BY up.created_at DESC
      LIMIT 10
    `);

    console.log(chalk.cyan('\nRecent Updates:'));
    for (const update of updates.rows) {
      const meta = update.meta as any;
      const signals = [];
      if (meta?.appliedToJobs) signals.push('applied');
      if (meta?.hadInterviews) signals.push('interviewed');
      if (meta?.receivedOffers) signals.push('offer');
      if (meta?.updatedProfile) signals.push('profile update');

      const content = update.content || 'No content';
      console.log(`  ${chalk.yellow('update')}: ${content.substring(0, 60)}...`);
      console.log(`    Signals: ${signals.join(', ') || 'none'}`);
    }
  }

  /**
   * Demo 3: Insight Relevance Analysis
   */
  private async demo3_insightRelevance() {
    console.log(chalk.bold.yellow('💡 Insight Relevance Analysis\n'));

    // Find nodes with most insights
    const nodesWithInsights = await db.execute(sql`
      SELECT tn.id, tn.type, tn.meta::text as meta, u.first_name, u.last_name, COUNT(ni.id) as insight_count
      FROM timeline_nodes tn
      JOIN node_insights ni ON ni.node_id = tn.id
      JOIN users u ON u.id = tn.user_id
      GROUP BY tn.id, tn.type, tn.meta::text, u.first_name, u.last_name
      ORDER BY insight_count DESC
      LIMIT 5
    `);

    console.log(chalk.cyan('Top 5 nodes by insight count:'));
    for (const node of nodesWithInsights.rows) {
      const meta = typeof node.meta === 'string' ? JSON.parse(node.meta) : node.meta;
      const title = meta?.role || meta?.school || meta?.title || node.type;
      console.log(`  - ${node.first_name} ${node.last_name}: ${title} (${node.type}): ${node.insight_count} insights`);
    }

    const topNode = nodesWithInsights.rows[0];
    if (!topNode) {
      console.log(chalk.red('No nodes with insights found'));
      return;
    }

    const topMeta = typeof topNode.meta === 'string' ? JSON.parse(topNode.meta) : topNode.meta;
    const topTitle = topMeta?.role || topMeta?.school || topMeta?.title || topNode.type;
    console.log(chalk.cyan(`\nAnalyzing insights for: ${topTitle}`));

    // Get insights
    const insights = await db.execute(sql`
      SELECT description, resources
      FROM node_insights
      WHERE node_id = ${topNode.id}
    `);

    console.log(chalk.cyan('\nInsights:'));
    for (const insight of insights.rows) {
      console.log(`  📝 ${insight.description}`);
      if (insight.resources && Array.isArray(insight.resources) && insight.resources.length > 0) {
        console.log(`     Resources: ${insight.resources.join(', ')}`);
      }
    }

    // Test relevance matching
    console.log(chalk.cyan('\nTesting relevance to keywords: "machine learning", "python", "architecture"'));
    const keywords = ['machine learning', 'python', 'architecture'];

    for (const insight of insights.rows) {
      const relevantKeywords = keywords.filter(kw =>
        insight.description.toLowerCase().includes(kw.toLowerCase())
      );
      if (relevantKeywords.length > 0) {
        console.log(chalk.green(`  ✓ Matches: ${relevantKeywords.join(', ')}`));
        console.log(`    "${insight.description.substring(0, 80)}..."`);
      }
    }
  }

  /**
   * Demo 4: Full Enhanced Matching with All Factors
   */
  private async demo4_fullEnhanced() {
    console.log(chalk.bold.yellow('🎯 Full Enhanced Matching Demo\n'));

    // Get a job node with insights
    const jobWithInsights = await db.execute(sql`
      SELECT tn.*, u.email
      FROM timeline_nodes tn
      JOIN users u ON u.id = tn.user_id
      WHERE tn.type = 'job'
      AND EXISTS (SELECT 1 FROM node_insights WHERE node_id = tn.id)
      LIMIT 1
    `);

    if (!jobWithInsights.rows[0]) {
      console.log(chalk.red('No job nodes with insights found'));
      return;
    }

    const jobNode = jobWithInsights.rows[0];
    const jobMeta = jobNode.meta as any;
    const jobTitle = jobMeta?.role || jobMeta?.title || 'Job';
    const jobOrg = jobMeta?.company || jobMeta?.organizationName || 'Unknown';
    console.log(chalk.cyan(`Query Node: ${jobTitle} at ${jobOrg}`));
    console.log(chalk.gray(`Owner: ${jobNode.email}\n`));

    // Run enhanced matching
    const result = await this.pipeline.findMatches({
      nodeId: jobNode.id,
      nodeType: jobNode.type as any,
      userId: jobNode.user_id,
      limit: 5,
      includeActivitySignals: true,
      includeInsights: true,
    });

    console.log(chalk.green(`Found ${result.matches.length} enhanced matches:\n`));
    console.log(chalk.gray(`Strategy: ${result.strategy}`));
    console.log(chalk.gray(`Performance: ${result.performance.totalTime}ms\n`));

    for (let i = 0; i < result.matches.length; i++) {
      const match = result.matches[i];
      const matchMeta = match.meta as any;
      const matchTitle = matchMeta?.role || matchMeta?.school || matchMeta?.title || match.type;
      const matchOrg = matchMeta?.company || matchMeta?.organizationName || '';

      console.log(chalk.bold(`${i + 1}. ${matchTitle} ${matchOrg ? `at ${matchOrg}` : ''} - ${Math.round((match.score || 0) * 100)}%`));
      console.log(chalk.gray(`   Type: ${match.type}`));

      if (match.activityScore) {
        console.log(chalk.yellow(`   🔥 Activity Score: ${match.activityScore.toFixed(2)}`));
      }

      if (match.relevantInsights && Array.isArray(match.relevantInsights) && match.relevantInsights.length > 0) {
        console.log(chalk.blue(`   💡 Relevant Insights: ${match.relevantInsights.length}`));
      }
      console.log();
    }
  }
}

// Run all demos
const demo = new AllMatchingDemos();
demo.runAll().catch(console.error);
