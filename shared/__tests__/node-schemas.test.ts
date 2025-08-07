/**
 * Tests for Node Schemas
 * Following TDD principles - write tests first, then implement
 */
import { describe, it, expect } from 'vitest';
import {
  baseNodeSchema,
  workExperienceSchema,
  educationSchema,
  projectSchema,
  eventSchema,
  actionSchema,
  careerTransitionSchema,
  // Create/Update DTOs
  workExperienceCreateSchema,
  workExperienceUpdateSchema,
  educationCreateSchema,
  educationUpdateSchema,
  projectCreateSchema,
  projectNodeUpdateSchema,
} from '../schema';

describe('Node Schemas', () => {
  describe('baseNodeSchema', () => {
    it('should validate a complete base node', () => {
      const validBaseNode = {
        id: 'node-123',
        type: 'workExperience',
        title: 'Software Engineer',
        description: 'Working on amazing projects',
        startDate: '2023-01-15',
        endDate: '2024-12-31',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      const result = baseNodeSchema.safeParse(validBaseNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('node-123');
        expect(result.data.type).toBe('workExperience');
        expect(result.data.title).toBe('Software Engineer');
      }
    });

    it('should validate a minimal base node', () => {
      const minimalBaseNode = {
        id: 'node-min',
        type: 'education',
        title: 'Computer Science Degree',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      const result = baseNodeSchema.safeParse(minimalBaseNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeUndefined();
        expect(result.data.startDate).toBeUndefined();
        expect(result.data.endDate).toBeUndefined();
      }
    });

    it('should require id, type, title, createdAt, updatedAt', () => {
      const invalidNode = {
        type: 'project',
        title: 'Test Project'
        // missing id, createdAt, updatedAt
      };

      const result = baseNodeSchema.safeParse(invalidNode);
      expect(result.success).toBe(false);
    });

    it('should validate node type enum', () => {
      const invalidTypeNode = {
        id: 'node-123',
        type: 'invalidType',
        title: 'Test',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      const result = baseNodeSchema.safeParse(invalidTypeNode);
      expect(result.success).toBe(false);
    });
  });

  describe('workExperienceSchema', () => {
    it('should validate a complete work experience', () => {
      const validWorkExp = {
        id: 'work-123',
        type: 'workExperience',
        title: 'Senior Software Engineer',
        description: 'Leading development team',
        startDate: '2023-01-15',
        endDate: 'Present',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        company: 'Tech Corp',
        position: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        responsibilities: ['Lead development', 'Mentor juniors'],
        achievements: ['Improved performance by 50%'],
        technologies: ['React', 'Node.js', 'PostgreSQL'],
        teamSize: 5,
        employmentType: 'full-time',
        salary: {
          amount: 150000,
          currency: 'USD',
          frequency: 'yearly'
        },
        manager: 'Jane Doe',
        industry: 'Technology'
      };

      const result = workExperienceSchema.safeParse(validWorkExp);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.company).toBe('Tech Corp');
        expect(result.data.position).toBe('Senior Software Engineer');
        expect(result.data.employmentType).toBe('full-time');
        expect(result.data.technologies).toContain('React');
        expect(result.data.salary?.amount).toBe(150000);
      }
    });

    it('should validate minimal work experience', () => {
      const minimalWorkExp = {
        id: 'work-min',
        type: 'workExperience',
        title: 'Developer',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        company: 'Startup Inc',
        position: 'Full Stack Developer'
      };

      const result = workExperienceSchema.safeParse(minimalWorkExp);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.company).toBe('Startup Inc');
        expect(result.data.position).toBe('Full Stack Developer');
      }
    });

    it('should require company and position', () => {
      const invalidWorkExp = {
        id: 'work-invalid',
        type: 'workExperience',
        title: 'Developer',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
        // missing company and position
      };

      const result = workExperienceSchema.safeParse(invalidWorkExp);
      expect(result.success).toBe(false);
    });

    it('should validate employment type enum', () => {
      const invalidEmploymentType = {
        id: 'work-123',
        type: 'workExperience',
        title: 'Developer',
        company: 'Tech Co',
        position: 'Developer',
        employmentType: 'invalid-type',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      const result = workExperienceSchema.safeParse(invalidEmploymentType);
      expect(result.success).toBe(false);
    });
  });

  describe('educationSchema', () => {
    it('should validate a complete education', () => {
      const validEducation = {
        id: 'edu-123',
        type: 'education',
        title: 'Bachelor of Science in Computer Science',
        description: 'Comprehensive CS program',
        startDate: '2018-09-01',
        endDate: '2022-05-15',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        institution: 'University of Technology',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        location: 'Boston, MA',
        gpa: 3.8,
        honors: ['Magna Cum Laude', 'Dean\'s List'],
        relevantCourses: ['Data Structures', 'Algorithms'],
        projects: ['Senior Capstone Project'],
        activities: ['Computer Science Club'],
        thesis: 'Machine Learning Applications',
        advisor: 'Dr. Smith',
        level: 'bachelors'
      };

      const result = educationSchema.safeParse(validEducation);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.institution).toBe('University of Technology');
        expect(result.data.degree).toBe('Bachelor of Science');
        expect(result.data.gpa).toBe(3.8);
        expect(result.data.level).toBe('bachelors');
      }
    });

    it('should validate minimal education', () => {
      const minimalEducation = {
        id: 'edu-min',
        type: 'education',
        title: 'High School Diploma',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        institution: 'City High School'
      };

      const result = educationSchema.safeParse(minimalEducation);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.institution).toBe('City High School');
      }
    });

    it('should require institution', () => {
      const invalidEducation = {
        id: 'edu-invalid',
        type: 'education',
        title: 'Degree',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
        // missing institution
      };

      const result = educationSchema.safeParse(invalidEducation);
      expect(result.success).toBe(false);
    });

    it('should validate education level enum', () => {
      const invalidLevel = {
        id: 'edu-123',
        type: 'education',
        title: 'Degree',
        institution: 'University',
        level: 'invalid-level',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      const result = educationSchema.safeParse(invalidLevel);
      expect(result.success).toBe(false);
    });

    it('should validate GPA range', () => {
      const invalidGPA = {
        id: 'edu-123',
        type: 'education',
        title: 'Degree',
        institution: 'University',
        gpa: 5.0, // Invalid GPA > 4.0
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      const result = educationSchema.safeParse(invalidGPA);
      expect(result.success).toBe(false);
    });
  });

  describe('projectSchema', () => {
    it('should validate a complete project', () => {
      const validProject = {
        id: 'proj-123',
        type: 'project',
        title: 'E-commerce Platform',
        description: 'Full-stack e-commerce solution',
        startDate: '2023-03-01',
        endDate: '2023-08-15',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        status: 'completed',
        technologies: ['React', 'Node.js', 'MongoDB'],
        repositoryUrl: 'https://github.com/user/ecommerce-platform',
        liveUrl: 'https://myecommerce.com',
        role: 'Lead Developer',
        teamSize: 3,
        keyFeatures: ['User auth', 'Payment processing'],
        challenges: ['Scalability', 'Security'],
        outcomes: ['Increased sales by 40%'],
        clientOrganization: 'Retail Corp',
        budget: 50000,
        projectType: 'professional'
      };

      const result = projectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('completed');
        expect(result.data.technologies).toContain('React');
        expect(result.data.teamSize).toBe(3);
        expect(result.data.projectType).toBe('professional');
      }
    });

    it('should require status', () => {
      const invalidProject = {
        id: 'proj-invalid',
        type: 'project',
        title: 'Project',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
        // missing status
      };

      const result = projectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });

    it('should validate status enum', () => {
      const invalidStatus = {
        id: 'proj-123',
        type: 'project',
        title: 'Project',
        status: 'invalid-status',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      const result = projectSchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });

    it('should validate project type enum', () => {
      const invalidType = {
        id: 'proj-123',
        type: 'project',
        title: 'Project',
        status: 'completed',
        projectType: 'invalid-type',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      const result = projectSchema.safeParse(invalidType);
      expect(result.success).toBe(false);
    });
  });

  describe('Create/Update DTO Schemas', () => {
    it('should validate work experience create request', () => {
      const createRequest = {
        title: 'Software Engineer',
        description: 'Developing awesome apps',
        company: 'Tech Corp',
        position: 'Software Engineer',
        startDate: '2023-01-15',
        technologies: ['React', 'Node.js']
      };

      const result = workExperienceCreateSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.company).toBe('Tech Corp');
        expect(result.data.position).toBe('Software Engineer');
      }
    });

    it('should validate work experience update request', () => {
      const updateRequest = {
        endDate: '2024-03-15',
        reasonForLeaving: 'Career growth'
      };

      const result = workExperienceUpdateSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.endDate).toBe('2024-03-15');
        expect(result.data.reasonForLeaving).toBe('Career growth');
      }
    });

    it('should allow empty update requests', () => {
      const emptyUpdate = {};

      const result = workExperienceUpdateSchema.safeParse(emptyUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate education create request', () => {
      const createRequest = {
        title: 'Computer Science Degree',
        institution: 'University',
        degree: 'Bachelor of Science',
        field: 'Computer Science'
      };

      const result = educationCreateSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.institution).toBe('University');
      }
    });

    it('should validate project create request', () => {
      const createRequest = {
        title: 'My Project',
        status: 'in-progress',
        technologies: ['React', 'Node.js']
      };

      const result = projectCreateSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('in-progress');
      }
    });
  });
});