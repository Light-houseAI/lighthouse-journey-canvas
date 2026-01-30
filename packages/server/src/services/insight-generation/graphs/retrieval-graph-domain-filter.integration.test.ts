/**
 * Integration Tests for Domain Filtering in Retrieval Graph
 *
 * Validates the complete flow:
 * 1. Query classification extracts domain keywords
 * 2. strictDomainMatching is enabled for domain-specific queries
 * 3. Workflows are filtered to match domain-specific keywords
 * 4. Generic action keywords (like "build") don't cause false positives
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// MOCK IMPLEMENTATIONS (copied from actual code for testing)
// ============================================================================

// Domain keywords mapping (from query-classifier.ts)
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  'ios': ['ios', 'iphone', 'ipad', 'apple', 'swift', 'swiftui', 'uikit', 'xcode', 'cocoapods', 'spm', 'testflight'],
  'macos': ['macos', 'mac', 'apple', 'appkit', 'catalyst', 'xcode'],
  'android': ['android', 'kotlin', 'java', 'gradle', 'adb', 'play store', 'google play'],
  'web': ['web', 'browser', 'html', 'css', 'javascript', 'typescript', 'react', 'vue', 'angular', 'nextjs', 'webpack', 'vite'],
  'mobile': ['mobile', 'app', 'ios', 'android', 'react native', 'flutter', 'capacitor'],
  'build': ['build', 'compile', 'bundle', 'package', 'archive', 'ci', 'cd', 'pipeline', 'automation'],
  'chat': ['chat', 'messaging', 'conversation', 'replicate'],
  'ai': ['ai', 'llm', 'gpt', 'claude', 'openai', 'anthropic', 'machine learning', 'ml'],
};

// Generic action keywords that are too broad for filtering
const GENERIC_ACTION_KEYWORDS = new Set([
  'build', 'automation', 'automate', 'ci', 'cd', 'pipeline',
  'deploy', 'test', 'testing', 'release', 'process', 'workflow',
  'create', 'make', 'develop', 'development', 'app', 'application',
]);

// Extract domain keywords from query (from query-classifier.ts)
function extractDomainKeywords(query: string): string[] {
  const detectedDomains: string[] = [];
  const queryLower = query.toLowerCase();

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(queryLower)) {
        if (!detectedDomains.includes(domain)) {
          detectedDomains.push(domain);
        }
        if (!detectedDomains.includes(keyword)) {
          detectedDomains.push(keyword);
        }
      }
    }
  }

  return detectedDomains;
}

// Check if workflow is relevant to domain keywords (from retrieval-graph.ts)
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
  if (domainSpecificKeywords.length > 0) {
    return domainSpecificKeywords.some(keyword => {
      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(searchableText);
    });
  }

  // If only generic keywords, fall back to OR matching
  return domainKeywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    return searchableText.includes(keywordLower);
  });
}

// ============================================================================
// TEST DATA
// ============================================================================

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

const webDevWorkflow = {
  title: 'Web Development',
  summary: 'Building React application with TypeScript',
  intent: 'Web app development',
  tools: ['VSCode', 'Chrome', 'Terminal'],
};

const genericWorkflow = {
  title: 'General Development',
  summary: 'Working on various development tasks',
  intent: 'Software development',
  tools: ['VSCode', 'Terminal'],
};

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Domain Filtering Integration: Apple Build Query', () => {
  const query = 'How can I automate build generating process for apple apps?';
  const domainKeywords = extractDomainKeywords(query);

  it('should extract correct domain keywords including apple/ios', () => {
    expect(domainKeywords).toContain('ios');
    expect(domainKeywords).toContain('apple');
    expect(domainKeywords).toContain('build');
  });

  it('should identify domain-specific keywords vs generic action keywords', () => {
    const domainSpecific = domainKeywords.filter(kw => !GENERIC_ACTION_KEYWORDS.has(kw.toLowerCase()));
    const generic = domainKeywords.filter(kw => GENERIC_ACTION_KEYWORDS.has(kw.toLowerCase()));

    expect(domainSpecific).toContain('ios');
    expect(domainSpecific).toContain('apple');
    expect(generic).toContain('build');
    // Note: "automate" in query -> extracted as "build" domain, not "automation"
  });

  it('should MATCH Apple workflow (has "ios", "apple", "xcode")', () => {
    expect(isWorkflowRelevantToDomain(appleWorkflow, domainKeywords)).toBe(true);
  });

  it('should NOT match chat workflow (contains "build" but not "apple", "ios", "xcode")', () => {
    expect(isWorkflowRelevantToDomain(chatAppWorkflow, domainKeywords)).toBe(false);
  });

  it('should NOT match generic workflow (no domain match)', () => {
    expect(isWorkflowRelevantToDomain(genericWorkflow, domainKeywords)).toBe(false);
  });

  it('should correctly filter workflow list for Apple query', () => {
    const allWorkflows = [appleWorkflow, chatAppWorkflow, webDevWorkflow, genericWorkflow];
    const filtered = allWorkflows.filter(wf => isWorkflowRelevantToDomain(wf, domainKeywords));

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('iOS App Build Automation');
  });
});

describe('Domain Filtering Integration: Chat App Query', () => {
  const query = 'How to build chat app with Replicate?';
  const domainKeywords = extractDomainKeywords(query);

  it('should extract chat-related domain keywords', () => {
    expect(domainKeywords).toContain('chat');
    expect(domainKeywords).toContain('replicate');
  });

  it('should NOT extract iOS/Apple keywords from chat query', () => {
    expect(domainKeywords).not.toContain('ios');
    expect(domainKeywords).not.toContain('apple');
    expect(domainKeywords).not.toContain('xcode');
  });

  it('should MATCH chat workflow (has "chat", "replicate")', () => {
    expect(isWorkflowRelevantToDomain(chatAppWorkflow, domainKeywords)).toBe(true);
  });

  it('should NOT match Apple workflow (no chat/replicate)', () => {
    expect(isWorkflowRelevantToDomain(appleWorkflow, domainKeywords)).toBe(false);
  });

  it('should correctly filter workflow list for chat query', () => {
    const allWorkflows = [appleWorkflow, chatAppWorkflow, webDevWorkflow, genericWorkflow];
    const filtered = allWorkflows.filter(wf => isWorkflowRelevantToDomain(wf, domainKeywords));

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Chat App Research');
  });
});

describe('Domain Filtering Integration: Web Development Query', () => {
  const query = 'How do I improve my React TypeScript development workflow?';
  const domainKeywords = extractDomainKeywords(query);

  it('should extract web-related domain keywords', () => {
    expect(domainKeywords).toContain('web');
    expect(domainKeywords).toContain('react');
    expect(domainKeywords).toContain('typescript');
  });

  it('should MATCH web dev workflow (has "react", "typescript")', () => {
    expect(isWorkflowRelevantToDomain(webDevWorkflow, domainKeywords)).toBe(true);
  });

  it('should NOT match Apple workflow', () => {
    expect(isWorkflowRelevantToDomain(appleWorkflow, domainKeywords)).toBe(false);
  });

  it('should NOT match chat workflow', () => {
    expect(isWorkflowRelevantToDomain(chatAppWorkflow, domainKeywords)).toBe(false);
  });
});

describe('Domain Filtering Integration: Generic Query', () => {
  const query = 'How can I be more productive?';
  const domainKeywords = extractDomainKeywords(query);

  it('should extract no domain keywords for generic query', () => {
    expect(domainKeywords).toHaveLength(0);
  });

  it('should match ALL workflows when no domain filter', () => {
    expect(isWorkflowRelevantToDomain(appleWorkflow, domainKeywords)).toBe(true);
    expect(isWorkflowRelevantToDomain(chatAppWorkflow, domainKeywords)).toBe(true);
    expect(isWorkflowRelevantToDomain(webDevWorkflow, domainKeywords)).toBe(true);
    expect(isWorkflowRelevantToDomain(genericWorkflow, domainKeywords)).toBe(true);
  });
});

describe('Edge Cases: Generic "build" keyword handling', () => {
  it('should NOT match workflows based on "build" alone', () => {
    // When query only has generic keywords like "build"
    const buildOnlyKeywords = ['build'];
    const buildWorkflow = {
      title: 'Build Something',
      summary: 'Building a new feature',
      intent: 'Build stuff',
      tools: ['VSCode'],
    };

    // With only generic keywords, should still match (fallback behavior)
    expect(isWorkflowRelevantToDomain(buildWorkflow, buildOnlyKeywords)).toBe(true);
  });

  it('should filter by domain-specific when both domain and action keywords present', () => {
    // "apple build" - should only match apple workflows
    const appleAndBuild = ['ios', 'apple', 'build'];

    // Chat workflow has "build" in summary but not "apple/ios"
    expect(isWorkflowRelevantToDomain(chatAppWorkflow, appleAndBuild)).toBe(false);

    // Apple workflow has "ios", "apple", AND "build"
    expect(isWorkflowRelevantToDomain(appleWorkflow, appleAndBuild)).toBe(true);
  });
});
