import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectMatchingService } from '../project-matching.service';
import type { Database } from '../../types/database';
import type { LLMSkillExtractionService, ExtractedSkills } from '../llm-skill-extraction.service';

describe('ProjectMatchingService', () => {
  let service: ProjectMatchingService;
  let mockDb: Partial<Database>;
  let mockSkillExtractor: Partial<LLMSkillExtractionService>;

  const mockExtractedSkills: ExtractedSkills = {
    core: ['React', 'TypeScript', 'GraphQL'],
    secondary: ['Jest', 'Cypress'],
    domain: ['E-commerce', 'SaaS'],
    seniority: 'senior',
  };

  const mockProjectNodes = [
    {
      id: 'p1',
      userId: 201,
      type: 'project',
      title: 'E-commerce Platform',
      description: 'Built a scalable e-commerce platform using React and GraphQL',
      meta: {
        technologies: ['React', 'GraphQL', 'Node.js'],
        url: 'github.com/user/ecommerce',
      },
    },
    {
      id: 'p2',
      userId: 202,
      type: 'project',
      title: 'ML Pipeline',
      description: 'Developed machine learning pipeline with Python',
      meta: {
        technologies: ['Python', 'TensorFlow', 'Kubernetes'],
        url: 'github.com/user/ml-pipeline',
      },
    },
    {
      id: 'p3',
      userId: 203,
      type: 'project',
      title: 'Mobile App',
      description: 'React Native mobile application',
      meta: {
        technologies: ['React Native', 'TypeScript'],
        url: 'github.com/user/mobile',
      },
    },
  ];

  beforeEach(() => {
    mockSkillExtractor = {
      extractSkills: vi.fn().mockResolvedValue(mockExtractedSkills),
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockProjectNodes),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
    } as any;

    service = new ProjectMatchingService(
      mockDb as Database,
      mockSkillExtractor as LLMSkillExtractionService
    );
  });

  describe('findMatches', () => {
    it('should find matching projects based on technology stack', async () => {
      const context = {
        nodeId: 'p1',
        userId: 201,
        limit: 10,
      };

      const result = await service.findMatches(context);

      expect(result).toBeDefined();
      expect(result.matches).toBeInstanceOf(Array);
      expect(result.querySkills).toEqual(mockExtractedSkills);
      expect(mockSkillExtractor.extractSkills).toHaveBeenCalled();
    });

    it('should prioritize projects with similar tech stacks', async () => {
      const context = {
        nodeId: 'p1',
        userId: 201,
      };

      const result = await service.findMatches(context);

      // Projects with React/GraphQL should score higher
      const reactProject = result.matches.find(m =>
        m.title.includes('E-commerce') || m.technologies?.includes('React')
      );
      const mlProject = result.matches.find(m => m.title.includes('ML'));

      if (reactProject && mlProject) {
        expect(reactProject.techStackOverlap).toBeGreaterThan(mlProject.techStackOverlap || 0);
      }
    });

    it('should calculate semantic similarity for project descriptions', async () => {
      const context = {
        nodeId: 'p1',
        userId: 201,
      };

      const result = await service.findMatches(context);

      result.matches.forEach(match => {
        expect(match.semanticSimilarity).toBeDefined();
        expect(match.semanticSimilarity).toBeGreaterThanOrEqual(0);
        expect(match.semanticSimilarity).toBeLessThanOrEqual(100);
      });
    });

    it('should handle projects without technology metadata', async () => {
      const projectsWithoutTech = [
        {
          id: 'p4',
          userId: 204,
          type: 'project',
          title: 'Secret Project',
          description: 'A project with no tech stack listed',
          meta: {},
        },
      ];

      mockDb.limit = vi.fn().mockResolvedValue(projectsWithoutTech);

      const context = {
        nodeId: 'p1',
        userId: 201,
      };

      const result = await service.findMatches(context);

      expect(result.matches).toBeDefined();
      expect(result.matches[0].techStackOverlap).toBe(0);
    });

    it('should respect collaboration potential scoring', async () => {
      const context = {
        nodeId: 'p1',
        userId: 201,
      };

      const result = await service.findMatches(context);

      result.matches.forEach(match => {
        expect(match.collaborationScore).toBeDefined();
        // Collaboration score should be a weighted combination
        const expectedMin = (match.techStackOverlap || 0) * 0.3;
        expect(match.collaborationScore).toBeGreaterThanOrEqual(expectedMin);
      });
    });

    it('should include project metadata in results', async () => {
      const context = {
        nodeId: 'p1',
        userId: 201,
      };

      const result = await service.findMatches(context);

      result.matches.forEach(match => {
        expect(match.nodeId).toBeDefined();
        expect(match.userId).toBeDefined();
        expect(match.title).toBeDefined();
        expect(match.description).toBeDefined();
      });
    });
  });

  describe('findCollaborators', () => {
    it('should find potential collaborators for a project', async () => {
      const projectId = 'p1';
      const limit = 5;

      const result = await service.findCollaborators(projectId, limit);

      expect(result).toBeDefined();
      expect(result.collaborators).toBeInstanceOf(Array);
      expect(result.projectTechnologies).toBeDefined();
    });

    it('should rank collaborators by expertise match', async () => {
      const projectId = 'p1';

      const result = await service.findCollaborators(projectId);

      if (result.collaborators.length > 1) {
        for (let i = 1; i < result.collaborators.length; i++) {
          expect(result.collaborators[i - 1].expertiseScore)
            .toBeGreaterThanOrEqual(result.collaborators[i].expertiseScore);
        }
      }
    });
  });
});