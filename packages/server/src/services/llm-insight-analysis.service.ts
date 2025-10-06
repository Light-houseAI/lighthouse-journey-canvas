import { z } from 'zod';

import type { LLMProvider } from '../core/llm-provider.js';

export interface InsightAnalysisContext {
  insights: string[];
  resources: Array<{ url: string; context: string }>;
  preparationNodes: Array<{
    type: string;
    title: string;
    insights: string[];
  }>;
  totalCandidates: number;
  successfulCandidates: number;
}

const InsightPatternsSchema = z.object({
  keyThemes: z.array(
    z.object({
      theme: z.string().describe('Main theme or topic'),
      frequency: z.number().describe('Number of candidates who mentioned this'),
      examples: z.array(z.string()).describe('Example quotes from candidates'),
      summary: z.string().describe('One-sentence summary of this theme'),
    })
  ),
  preparationTimeline: z.object({
    typical: z
      .string()
      .describe('Typical preparation duration (e.g., "3-6 months")'),
    keyMilestones: z
      .array(z.string())
      .describe('Important milestones mentioned'),
  }),
  topResources: z.array(
    z.object({
      resource: z.string().describe('Resource name or URL'),
      purpose: z.string().describe('Why this resource was helpful'),
      mentionCount: z.number().describe('How many candidates mentioned it'),
    })
  ),
  commonPreparationActivities: z.array(
    z.object({
      activity: z
        .string()
        .describe('Type of activity (e.g., "Side Projects", "LeetCode")'),
      effectiveness: z.string().describe('How effective candidates found it'),
      examples: z
        .array(z.string())
        .describe('Specific examples from candidates'),
    })
  ),
  recommendations: z
    .array(z.string())
    .describe('Actionable recommendations for job seekers'),
});

export interface InsightPatterns {
  keyThemes: Array<{
    theme: string;
    frequency: number;
    examples: string[];
    summary: string;
  }>;
  preparationTimeline: {
    typical: string;
    keyMilestones: string[];
  };
  topResources: Array<{
    resource: string;
    purpose: string;
    mentionCount: number;
  }>;
  commonPreparationActivities: Array<{
    activity: string;
    effectiveness: string;
    examples: string[];
  }>;
  recommendations: string[];
}

export class LLMInsightAnalysisService {
  constructor(private llmProvider: LLMProvider) {}

  async analyzeSuccessPatterns(
    context: InsightAnalysisContext
  ): Promise<InsightPatterns> {
    if (
      context.insights.length === 0 &&
      context.preparationNodes.length === 0
    ) {
      // No insights to analyze, return empty patterns
      return {
        keyThemes: [],
        preparationTimeline: {
          typical: 'Unknown',
          keyMilestones: [],
        },
        topResources: [],
        commonPreparationActivities: [],
        recommendations: [],
      };
    }

    const prompt = this.buildAnalysisPrompt(context);

    const response = await this.llmProvider.generateStructuredResponse(
      [
        {
          role: 'system',
          content: `You are an expert career advisor analyzing interview preparation patterns. 
Extract patterns, themes, and insights from real candidate experiences.
ONLY extract patterns that are explicitly mentioned - do NOT infer or assume.
Focus on actionable insights and deduplicate similar themes.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      InsightPatternsSchema,
      {
        temperature: 0.1,
        maxTokens: 2000,
      }
    );

    return response.content;
  }

  private buildAnalysisPrompt(context: InsightAnalysisContext): string {
    const parts: string[] = [];

    parts.push(
      `Analyze interview preparation insights from ${context.successfulCandidates} successful candidates (out of ${context.totalCandidates} total).`
    );

    // Interview-level insights
    if (context.insights.length > 0) {
      parts.push(`\n## Interview Insights:`);
      context.insights.forEach((insight, idx) => {
        parts.push(`${idx + 1}. "${insight}"`);
      });
    }

    // Preparation node insights (projects/courses)
    if (context.preparationNodes.length > 0) {
      parts.push(`\n## Preparation Activities:`);
      context.preparationNodes.forEach((node) => {
        if (node.insights.length > 0) {
          parts.push(`\n${node.type.toUpperCase()}: ${node.title}`);
          node.insights.forEach((insight) => {
            parts.push(`  - "${insight}"`);
          });
        }
      });
    }

    // Resources
    if (context.resources.length > 0) {
      parts.push(`\n## Recommended Resources:`);
      const resourceCounts = new Map<
        string,
        { context: string; count: number }
      >();
      context.resources.forEach((r) => {
        if (resourceCounts.has(r.url)) {
          resourceCounts.get(r.url)!.count++;
        } else {
          resourceCounts.set(r.url, { context: r.context, count: 1 });
        }
      });

      Array.from(resourceCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([url, data]) => {
          parts.push(`- ${url} (${data.count} mentions) - ${data.context}`);
        });
    }

    parts.push(`\n## Task:`);
    parts.push(`Extract patterns from these insights. Identify:`);
    parts.push(`1. Key themes (deduplicate similar insights)`);
    parts.push(`2. Typical preparation timeline`);
    parts.push(`3. Most helpful resources`);
    parts.push(`4. Common preparation activities and effectiveness`);
    parts.push(`5. Actionable recommendations for someone preparing`);

    return parts.join('\n');
  }
}
