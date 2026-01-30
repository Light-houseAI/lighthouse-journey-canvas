/**
 * Tests for Query Classifier - Domain Keyword Extraction
 */

import { classifyQuery, extractDomainKeywords } from './query-classifier.js';

describe('Query Classifier - Domain Keyword Extraction', () => {
  describe('extractDomainKeywords', () => {
    it('should extract iOS/Apple keywords', () => {
      const keywords = extractDomainKeywords('How can I automate build generating process for apple apps?');
      expect(keywords).toContain('ios');
      expect(keywords).toContain('apple');
      expect(keywords).toContain('build');
    });

    it('should extract build/automation keywords', () => {
      const keywords = extractDomainKeywords('How do I set up CI/CD pipeline for my project?');
      expect(keywords).toContain('build');
      expect(keywords).toContain('ci');
      expect(keywords).toContain('pipeline');
    });

    it('should extract chat keywords', () => {
      const keywords = extractDomainKeywords('How to build chat app with Replicate?');
      expect(keywords).toContain('chat');
    });

    it('should NOT extract iOS keywords from chat app query', () => {
      const keywords = extractDomainKeywords('How to build chat app with Replicate?');
      expect(keywords).not.toContain('ios');
      expect(keywords).not.toContain('apple');
      expect(keywords).not.toContain('xcode');
    });
  });

  describe('classifyQuery with domain keywords', () => {
    it('should enable strictDomainMatching when domain keywords detected', () => {
      const result = classifyQuery('How can I automate build generating process for apple apps?');
      expect(result.filters.domainKeywords).toBeDefined();
      expect(result.filters.domainKeywords?.length).toBeGreaterThan(0);
      expect(result.routing.strictDomainMatching).toBe(true);
    });

    it('should NOT enable strictDomainMatching for generic queries', () => {
      const result = classifyQuery('How can I improve my workflow?');
      expect(result.routing.strictDomainMatching).toBe(false);
    });

    it('should extract correct domain keywords for Apple build query', () => {
      const result = classifyQuery('How can I automate build generating process for apple apps?');
      expect(result.filters.domainKeywords).toContain('ios');
      expect(result.filters.domainKeywords).toContain('apple');
      expect(result.filters.domainKeywords).toContain('build');
    });
  });
});
