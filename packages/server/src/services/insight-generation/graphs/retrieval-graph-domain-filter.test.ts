/**
 * Tests for Domain Filtering in Retrieval Graph
 */

import { describe, it, expect } from 'vitest';

/**
 * Generic action keywords that are too broad for filtering on their own.
 * These keywords need to be combined with domain-specific keywords to be meaningful.
 * e.g., "build" alone matches "build chat app" and "build iOS app" - not specific enough.
 */
const GENERIC_ACTION_KEYWORDS = new Set([
  'build', 'automation', 'automate', 'ci', 'cd', 'pipeline',
  'deploy', 'test', 'testing', 'release', 'process', 'workflow',
  'create', 'make', 'develop', 'development', 'app', 'application',
]);

/**
 * Check if a workflow is relevant to the given domain keywords.
 *
 * Key insight: Generic action keywords (like "build") match too many workflows.
 * We require at least ONE domain-specific keyword to match, not just generic actions.
 *
 * For example, for query "automate build for Apple apps":
 * - Domain-specific: "apple", "ios"
 * - Generic: "automate", "build"
 *
 * A workflow must match at least one domain-specific keyword to be relevant.
 */
function isWorkflowRelevantToDomain(
  workflow: { title?: string; summary?: string; intent?: string; tools?: string[] },
  domainKeywords: string[]
): boolean {
  if (!domainKeywords || domainKeywords.length === 0) {
    return true;
  }

  const searchableText = [
    workflow.title || '',
    workflow.summary || '',
    workflow.intent || '',
    ...(workflow.tools || []),
  ].join(' ').toLowerCase();

  // Separate domain-specific from generic action keywords
  const domainSpecificKeywords = domainKeywords.filter(
    kw => !GENERIC_ACTION_KEYWORDS.has(kw.toLowerCase())
  );

  // If we have domain-specific keywords, require at least one to match
  // This prevents "build chat app" from matching "Apple build automation" query
  if (domainSpecificKeywords.length > 0) {
    return domainSpecificKeywords.some(keyword => {
      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(searchableText);
    });
  }

  // If only generic keywords, fall back to OR matching (less strict)
  return domainKeywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    return searchableText.includes(keywordLower);
  });
}

describe('Domain Filtering in Retrieval Graph', () => {
  describe('isWorkflowRelevantToDomain', () => {
    const appleWorkflow = {
      title: 'iOS App Build Automation',
      summary: 'Setting up Xcode build pipeline for iOS app',
      intent: 'Automate Apple app deployment',
      tools: ['Xcode', 'fastlane', 'Terminal'],
    };

    const chatAppWorkflow = {
      title: 'Chat App Research',
      summary: 'Researching how to build chat functionality with Replicate',
      intent: 'Build chat app features',
      tools: ['Chrome', 'Notion', 'Claude'],
    };

    const genericWorkflow = {
      title: 'General Development',
      summary: 'Working on various development tasks',
      intent: 'Software development',
      tools: ['VSCode', 'Terminal'],
    };

    it('should match Apple workflow with iOS domain keywords', () => {
      const keywords = ['ios', 'apple', 'build'];
      expect(isWorkflowRelevantToDomain(appleWorkflow, keywords)).toBe(true);
    });

    it('should NOT match chat workflow with iOS domain keywords', () => {
      const keywords = ['ios', 'apple', 'xcode'];
      expect(isWorkflowRelevantToDomain(chatAppWorkflow, keywords)).toBe(false);
    });

    it('should match chat workflow with chat domain keywords', () => {
      const keywords = ['chat', 'replicate'];
      expect(isWorkflowRelevantToDomain(chatAppWorkflow, keywords)).toBe(true);
    });

    it('should NOT match Apple workflow with chat domain keywords', () => {
      const keywords = ['chat', 'replicate', 'conversation'];
      expect(isWorkflowRelevantToDomain(appleWorkflow, keywords)).toBe(false);
    });

    it('should match any workflow when no domain keywords provided', () => {
      expect(isWorkflowRelevantToDomain(appleWorkflow, [])).toBe(true);
      expect(isWorkflowRelevantToDomain(chatAppWorkflow, [])).toBe(true);
      expect(isWorkflowRelevantToDomain(genericWorkflow, [])).toBe(true);
    });

    it('should match workflow by tool name', () => {
      const keywords = ['xcode'];
      expect(isWorkflowRelevantToDomain(appleWorkflow, keywords)).toBe(true);
      expect(isWorkflowRelevantToDomain(chatAppWorkflow, keywords)).toBe(false);
    });
  });

  describe('filtering scenario: Apple build automation query', () => {
    const workflows = [
      {
        title: 'iOS App Build Automation',
        summary: 'Setting up Xcode build pipeline',
        intent: 'Automate Apple app deployment',
        tools: ['Xcode', 'fastlane'],
      },
      {
        title: 'Chat App Research',
        summary: 'Researching chat functionality',
        intent: 'Build chat app',
        tools: ['Chrome', 'Notion'],
      },
      {
        title: 'Web Development',
        summary: 'Building React application',
        intent: 'Web app development',
        tools: ['VSCode', 'Chrome'],
      },
    ];

    it('should filter out chat and web workflows for Apple query', () => {
      const domainKeywords = ['ios', 'apple', 'build'];
      const filtered = workflows.filter(wf =>
        isWorkflowRelevantToDomain(wf, domainKeywords)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('iOS App Build Automation');
    });

    it('should keep only chat workflow for chat query', () => {
      const domainKeywords = ['chat'];
      const filtered = workflows.filter(wf =>
        isWorkflowRelevantToDomain(wf, domainKeywords)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Chat App Research');
    });
  });
});
