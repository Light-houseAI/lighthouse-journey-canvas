/**
 * JSON Field Schema Tests (LIG-209)
 *
 * Tests for Zod schemas covering database JSON fields
 */

import { describe, expect, it } from 'vitest';

import {
  graphragChunkMetaSchema,
  graphragEdgeMetaSchema,
  organizationMetadataSchema,
} from '../schema';

describe('Organization Metadata Schema', () => {
  it('should validate valid organization metadata', () => {
    const validData = {
      website: 'https://example.com',
      industry: 'Technology',
      size: '51-200',
      location: 'San Francisco, CA',
      description: 'A great company',
      logoUrl: 'https://example.com/logo.png',
      foundedYear: 2010,
    };

    const result = organizationMetadataSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate empty metadata', () => {
    const result = organizationMetadataSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should allow passthrough fields', () => {
    const dataWithExtra = {
      industry: 'Tech',
      customField: 'custom value',
    };

    const result = organizationMetadataSchema.safeParse(dataWithExtra);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(dataWithExtra);
    }
  });

  it('should reject invalid URL', () => {
    const invalidData = {
      website: 'not-a-url',
    };

    const result = organizationMetadataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid size', () => {
    const invalidData = {
      size: 'huge',
    };

    const result = organizationMetadataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('GraphRAG Chunk Meta Schema', () => {
  it('should validate valid chunk metadata', () => {
    const validData = {
      startDate: '2023-01',
      endDate: '2024-01',
      company: 'TechCorp',
      role: 'Software Engineer',
      title: 'Senior Developer',
      location: 'Remote',
      skills: ['JavaScript', 'TypeScript', 'React'],
      technologies: ['Node.js', 'PostgreSQL'],
    };

    const result = graphragChunkMetaSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate empty metadata', () => {
    const result = graphragChunkMetaSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should allow passthrough fields', () => {
    const dataWithExtra = {
      company: 'TechCorp',
      customExtraction: 'custom value',
    };

    const result = graphragChunkMetaSchema.safeParse(dataWithExtra);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(dataWithExtra);
    }
  });

  it('should validate educational metadata', () => {
    const validData = {
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      institution: 'MIT',
      startDate: '2015-09',
      endDate: '2019-05',
    };

    const result = graphragChunkMetaSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('GraphRAG Edge Meta Schema', () => {
  it('should validate valid edge metadata', () => {
    const validData = {
      confidence: 0.95,
      reason: 'Similar skills and overlapping timeline',
      temporalDistance: 30,
      temporalRelation: 'before',
      semanticSimilarity: 0.87,
      sharedEntities: ['JavaScript', 'React'],
    };

    const result = graphragEdgeMetaSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate empty metadata', () => {
    const result = graphragEdgeMetaSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should allow passthrough fields', () => {
    const dataWithExtra = {
      confidence: 0.8,
      customScore: 0.9,
    };

    const result = graphragEdgeMetaSchema.safeParse(dataWithExtra);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(dataWithExtra);
    }
  });

  it('should reject confidence out of range', () => {
    const invalidData = {
      confidence: 1.5,
    };

    const result = graphragEdgeMetaSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid temporal relation', () => {
    const invalidData = {
      temporalRelation: 'invalid',
    };

    const result = graphragEdgeMetaSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
