#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { UnifiedMatchingPipelineService } from '../src/services/unified-matching-pipeline.service';
import { LLMSkillExtractionService } from '../src/services/llm-skill-extraction.service';
import { OpenAIEmbeddingService } from '../src/services/openai-embedding.service';
import { ActivityScoringService } from '../src/services/activity-scoring.service';
import { AISDKLLMProvider } from '../src/core/llm-provider';
import { timelineNodes } from '@journey/schema';
import * as schema from '@journey/schema';
import { eq, sql } from 'drizzle-orm';
import chalk from 'chalk';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

class MatchingCorrectnessValidator {
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

  async validateAll() {
    console.log(chalk.bold.cyan('\n🔍 Validating Enhanced Matching Correctness\n'));

    await this.validateJobMatching();
    console.log('\n' + '='.repeat(80) + '\n');

    await this.validateProjectMatching();
    console.log('\n' + '='.repeat(80) + '\n');

    await this.validateEducationMatching();
    console.log('\n' + '='.repeat(80) + '\n');

    await this.validateActivitySignals();
    console.log('\n' + '='.repeat(80) + '\n');

    await this.validateInsightRelevance();

    await pool.end();
  }

  /**
   * Validate job-to-job matching
   */
  private async validateJobMatching() {
    console.log(chalk.bold.yellow('💼 Job Matching Validation\n'));

    const jobNodes = await db.execute(sql`
      SELECT tn.*, u.email
      FROM timeline_nodes tn
      JOIN users u ON u.id = tn.user_id
      WHERE tn.type = 'job'
      LIMIT 3
    `);

    if (jobNodes.rows.length === 0) {
      console.log(chalk.red('❌ No job nodes found'));
      return;
    }

    for (const job of jobNodes.rows) {
      const jobMeta = job.meta as any;
      const title = jobMeta?.role || 'Unknown Role';
      const company = jobMeta?.company || 'Unknown Company';

      console.log(chalk.cyan(`\nQuery: ${title} at ${company}`));
      console.log(chalk.gray(`Owner: ${job.email}`));

      const result = await this.pipeline.findMatches({
        nodeId: job.id,
        nodeType: 'job',
        userId: job.user_id,
        limit: 5,
        includeActivitySignals: true,
        includeInsights: true,
      });

      console.log(chalk.green(`✓ Strategy: ${result.strategy}`));
      console.log(chalk.green(`✓ Found: ${result.matches.length} matches`));
      console.log(chalk.gray(`  Time: ${result.performance.totalTime}ms`));

      if (result.matches.length > 0) {
        const topMatch = result.matches[0] as any;
        const matchTitle = topMatch.role || topMatch.title || 'Unknown';
        const matchCompany = topMatch.company ? ` at ${topMatch.company}` : '';
        const score = Math.round((topMatch.score || 0) * 100);
        console.log(chalk.gray(`  Top match: ${matchTitle}${matchCompany} (${score}%)`));
      }
    }
  }

  /**
   * Validate project matching
   */
  private async validateProjectMatching() {
    console.log(chalk.bold.yellow('🚀 Project Matching Validation\n'));

    const projectNodes = await db.execute(sql`
      SELECT tn.*, u.email
      FROM timeline_nodes tn
      JOIN users u ON u.id = tn.user_id
      WHERE tn.type = 'project'
      LIMIT 3
    `);

    if (projectNodes.rows.length === 0) {
      console.log(chalk.red('❌ No project nodes found'));
      return;
    }

    for (const project of projectNodes.rows) {
      const projectMeta = project.meta as any;
      const title = projectMeta?.title || 'Unknown Project';

      console.log(chalk.cyan(`\nQuery: ${title}`));
      console.log(chalk.gray(`Owner: ${project.email}`));

      const result = await this.pipeline.findMatches({
        nodeId: project.id,
        nodeType: 'project',
        userId: project.user_id,
        limit: 5,
      });

      console.log(chalk.green(`✓ Strategy: ${result.strategy}`));
      console.log(chalk.green(`✓ Found: ${result.matches.length} matches`));
      console.log(chalk.gray(`  Time: ${result.performance.totalTime}ms`));

      if (result.matches.length > 0) {
        const topMatch = result.matches[0] as any;
        const matchTitle = topMatch.title || 'Unknown';
        const score = Math.round((topMatch.score || 0) * 100);
        console.log(chalk.gray(`  Top match: ${matchTitle} (${score}%)`));
      }
    }
  }

  /**
   * Validate education matching
   */
  private async validateEducationMatching() {
    console.log(chalk.bold.yellow('🎓 Education Matching Validation\n'));

    const eduNodes = await db.execute(sql`
      SELECT tn.*, u.email
      FROM timeline_nodes tn
      JOIN users u ON u.id = tn.user_id
      WHERE tn.type = 'education'
      LIMIT 3
    `);

    if (eduNodes.rows.length === 0) {
      console.log(chalk.red('❌ No education nodes found'));
      return;
    }

    for (const edu of eduNodes.rows) {
      const eduMeta = edu.meta as any;
      const school = eduMeta?.school || 'Unknown School';
      const field = eduMeta?.field || 'Unknown Field';

      console.log(chalk.cyan(`\nQuery: ${field} at ${school}`));
      console.log(chalk.gray(`Owner: ${edu.email}`));

      const result = await this.pipeline.findMatches({
        nodeId: edu.id,
        nodeType: 'education',
        userId: edu.user_id,
        limit: 5,
      });

      console.log(chalk.green(`✓ Strategy: ${result.strategy}`));
      console.log(chalk.green(`✓ Found: ${result.matches.length} matches`));
      console.log(chalk.gray(`  Time: ${result.performance.totalTime}ms`));

      if (result.matches.length > 0) {
        const topMatch = result.matches[0] as any;
        const matchField = topMatch.fieldOfStudy || 'Unknown';
        const matchInstitution = topMatch.institution ? ` at ${topMatch.institution}` : '';
        const score = Math.round((topMatch.score || 0) * 100);
        console.log(chalk.gray(`  Top match: ${matchField}${matchInstitution} (${score}%)`));
      }
    }
  }

  /**
   * Validate activity signal integration
   */
  private async validateActivitySignals() {
    console.log(chalk.bold.yellow('🔥 Activity Signal Validation\n'));

    // Find users with updates
    const usersWithUpdates = await db.execute(sql`
      SELECT u.id, u.email, u.first_name, COUNT(up.id) as update_count
      FROM users u
      JOIN timeline_nodes tn ON tn.user_id = u.id
      JOIN updates up ON up.node_id = tn.id
      GROUP BY u.id, u.email, u.first_name
      ORDER BY update_count DESC
      LIMIT 3
    `);

    if (usersWithUpdates.rows.length === 0) {
      console.log(chalk.red('❌ No users with updates found'));
      return;
    }

    for (const user of usersWithUpdates.rows) {
      console.log(chalk.cyan(`\nUser: ${user.first_name} (${user.email})`));
      console.log(chalk.gray(`Updates: ${user.update_count}`));

      const activityScore = await this.activityService.getActivityScore(Number(user.id));

      console.log(chalk.green(`✓ Activity Score: ${activityScore.score.toFixed(2)}`));
      console.log(chalk.gray(`  Active Seeker: ${activityScore.isActiveSeeker ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`  Recent Activity: ${activityScore.recentActivityCount}`));
      console.log(chalk.gray(`  Signals: ${activityScore.signals.join(', ') || 'none'}`));
    }
  }

  /**
   * Validate insight relevance
   */
  private async validateInsightRelevance() {
    console.log(chalk.bold.yellow('💡 Insight Relevance Validation\n'));

    // Find nodes with insights
    const nodesWithInsights = await db.execute(sql`
      SELECT tn.id, tn.type, tn.meta::text as meta, COUNT(ni.id) as insight_count
      FROM timeline_nodes tn
      JOIN node_insights ni ON ni.node_id = tn.id
      GROUP BY tn.id, tn.type, tn.meta::text
      ORDER BY insight_count DESC
      LIMIT 3
    `);

    if (nodesWithInsights.rows.length === 0) {
      console.log(chalk.red('❌ No nodes with insights found'));
      return;
    }

    for (const node of nodesWithInsights.rows) {
      const meta = typeof node.meta === 'string' ? JSON.parse(node.meta) : node.meta;
      const title = meta?.role || meta?.school || meta?.title || node.type;

      console.log(chalk.cyan(`\nNode: ${title} (${node.type})`));
      console.log(chalk.gray(`Insights: ${node.insight_count}`));

      // Get insights
      const insights = await db.execute(sql`
        SELECT description
        FROM node_insights
        WHERE node_id = ${node.id}
        LIMIT 3
      `);

      console.log(chalk.green(`✓ Retrieved ${insights.rows.length} insights:`));
      insights.rows.forEach((insight, i) => {
        console.log(chalk.gray(`  ${i + 1}. ${insight.description.substring(0, 80)}...`));
      });
    }
  }
}

// Run validation
const validator = new MatchingCorrectnessValidator();
validator.validateAll().catch(console.error);
