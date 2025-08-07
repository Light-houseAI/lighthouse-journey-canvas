/**
 * Tests for Node Type Definitions
 * Following TDD principles - write tests first, then implement
 */
import { describe, it, expect } from 'vitest';
import {
  WorkExperience,
  Education,
  Project,
  Event,
  Action,
  CareerTransition,
  isWorkExperience,
  isEducation,
  isProject,
  isEvent,
  isAction,
  isCareerTransition,
} from '../node-types';
import { NodeType } from '../../core/interfaces/base-node.interface';

describe('Node Type Definitions', () => {
  describe('WorkExperience interface', () => {
    it('should define a complete work experience structure', () => {
      const workExperience: WorkExperience = {
        id: 'work-123',
        type: NodeType.WorkExperience,
        title: 'Senior Software Engineer',
        description: 'Leading development team',
        startDate: '2023-01-15',
        endDate: '2024-12-31',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        company: 'Tech Corp',
        position: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        responsibilities: ['Lead development', 'Mentor junior developers'],
        achievements: ['Increased performance by 50%', 'Reduced bugs by 30%'],
        technologies: ['React', 'Node.js', 'PostgreSQL'],
        teamSize: 5,
        employmentType: 'full-time'
      };

      expect(workExperience.id).toBe('work-123');
      expect(workExperience.type).toBe(NodeType.WorkExperience);
      expect(workExperience.company).toBe('Tech Corp');
      expect(workExperience.position).toBe('Senior Software Engineer');
      expect(workExperience.location).toBe('San Francisco, CA');
      expect(workExperience.responsibilities).toHaveLength(2);
      expect(workExperience.achievements).toHaveLength(2);
      expect(workExperience.technologies).toHaveLength(3);
      expect(workExperience.teamSize).toBe(5);
      expect(workExperience.employmentType).toBe('full-time');
    });

    it('should allow minimal work experience with only required fields', () => {
      const minimalWork: WorkExperience = {
        id: 'work-min',
        type: NodeType.WorkExperience,
        title: 'Developer',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        company: 'Startup Inc',
        position: 'Full Stack Developer'
      };

      expect(minimalWork.company).toBe('Startup Inc');
      expect(minimalWork.position).toBe('Full Stack Developer');
      expect(minimalWork.location).toBeUndefined();
      expect(minimalWork.responsibilities).toBeUndefined();
    });
  });

  describe('Education interface', () => {
    it('should define a complete education structure', () => {
      const education: Education = {
        id: 'edu-123',
        type: NodeType.Education,
        title: 'Bachelor of Science in Computer Science',
        description: 'Comprehensive CS program with focus on software engineering',
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
        relevantCourses: ['Data Structures', 'Algorithms', 'Software Engineering'],
        projects: ['Senior Capstone Project', 'Mobile App Development'],
        activities: ['Computer Science Club', 'Hackathon Organizer']
      };

      expect(education.institution).toBe('University of Technology');
      expect(education.degree).toBe('Bachelor of Science');
      expect(education.field).toBe('Computer Science');
      expect(education.gpa).toBe(3.8);
      expect(education.honors).toHaveLength(2);
      expect(education.relevantCourses).toHaveLength(3);
    });

    it('should allow minimal education with only required fields', () => {
      const minimalEdu: Education = {
        id: 'edu-min',
        type: NodeType.Education,
        title: 'High School Diploma',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        institution: 'City High School'
      };

      expect(minimalEdu.institution).toBe('City High School');
      expect(minimalEdu.degree).toBeUndefined();
      expect(minimalEdu.field).toBeUndefined();
    });
  });

  describe('Project interface', () => {
    it('should define a complete project structure', () => {
      const project: Project = {
        id: 'proj-123',
        type: NodeType.Project,
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
        keyFeatures: ['User authentication', 'Payment processing', 'Admin dashboard'],
        challenges: ['Scalability', 'Security'],
        outcomes: ['Increased sales by 40%', 'Reduced load time by 60%'],
        clientOrganization: 'Retail Corp'
      };

      expect(project.status).toBe('completed');
      expect(project.technologies).toHaveLength(3);
      expect(project.repositoryUrl).toBe('https://github.com/user/ecommerce-platform');
      expect(project.role).toBe('Lead Developer');
      expect(project.keyFeatures).toHaveLength(3);
    });
  });

  describe('Event interface', () => {
    it('should define a complete event structure', () => {
      const event: Event = {
        id: 'event-123',
        type: NodeType.Event,
        title: 'React Conference 2023',
        description: 'Premier conference for React developers',
        startDate: '2023-10-15',
        endDate: '2023-10-17',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        eventType: 'conference',
        location: 'San Francisco, CA',
        organizer: 'React Foundation',
        role: 'speaker',
        topic: 'Advanced React Patterns',
        attendees: 500,
        keyTakeaways: ['New React features', 'Performance optimization'],
        networking: ['Met key industry leaders', 'Connected with potential employers']
      };

      expect(event.eventType).toBe('conference');
      expect(event.role).toBe('speaker');
      expect(event.topic).toBe('Advanced React Patterns');
      expect(event.attendees).toBe(500);
    });
  });

  describe('Action interface', () => {
    it('should define a complete action structure', () => {
      const action: Action = {
        id: 'action-123',
        type: NodeType.Action,
        title: 'AWS Certification',
        description: 'Achieved AWS Solutions Architect certification',
        startDate: '2023-01-01',
        endDate: '2023-03-15',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        actionType: 'certification',
        category: 'professional-development',
        status: 'completed',
        effort: 'high',
        impact: 'significant',
        skills: ['AWS', 'Cloud Architecture', 'DevOps'],
        evidence: 'Certificate ID: AWS-123456',
        nextSteps: ['Pursue advanced certifications', 'Apply skills in current role']
      };

      expect(action.actionType).toBe('certification');
      expect(action.category).toBe('professional-development');
      expect(action.status).toBe('completed');
      expect(action.effort).toBe('high');
      expect(action.skills).toHaveLength(3);
    });
  });

  describe('CareerTransition interface', () => {
    it('should define a complete career transition structure', () => {
      const transition: CareerTransition = {
        id: 'transition-123',
        type: NodeType.CareerTransition,
        title: 'Software Engineer to Product Manager',
        description: 'Transitioned from technical role to product management',
        startDate: '2023-06-01',
        endDate: '2023-09-30',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        transitionType: 'role-change',
        fromRole: 'Senior Software Engineer',
        toRole: 'Product Manager',
        fromCompany: 'Tech Corp',
        toCompany: 'Product Inc',
        fromIndustry: 'Software Development',
        toIndustry: 'Product Management',
        motivations: ['Career growth', 'Interest in business strategy'],
        challenges: ['Learning new skills', 'Building network'],
        preparations: ['Product management course', 'Informational interviews'],
        outcomes: ['Successfully transitioned', '20% salary increase'],
        lessonsLearned: ['Importance of networking', 'Value of continuous learning']
      };

      expect(transition.transitionType).toBe('role-change');
      expect(transition.fromRole).toBe('Senior Software Engineer');
      expect(transition.toRole).toBe('Product Manager');
      expect(transition.motivations).toHaveLength(2);
      expect(transition.outcomes).toHaveLength(2);
    });
  });

  describe('Type Guards', () => {
    const workExperience: WorkExperience = {
      id: 'work-1',
      type: NodeType.WorkExperience,
      title: 'Developer',
      createdAt: '2023-01-15T00:00:00Z',
      updatedAt: '2023-01-15T00:00:00Z',
      company: 'Tech Co',
      position: 'Developer'
    };

    const education: Education = {
      id: 'edu-1',
      type: NodeType.Education,
      title: 'Degree',
      createdAt: '2023-01-15T00:00:00Z',
      updatedAt: '2023-01-15T00:00:00Z',
      institution: 'University'
    };

    it('should correctly identify WorkExperience nodes', () => {
      expect(isWorkExperience(workExperience)).toBe(true);
      expect(isWorkExperience(education)).toBe(false);
    });

    it('should correctly identify Education nodes', () => {
      expect(isEducation(education)).toBe(true);
      expect(isEducation(workExperience)).toBe(false);
    });

    it('should handle invalid objects gracefully', () => {
      expect(isWorkExperience(null)).toBe(false);
      expect(isEducation(undefined)).toBe(false);
      expect(isProject({})).toBe(false);
    });
  });

  describe('Type Compatibility', () => {
    it('should be compatible with BaseNode interface', () => {
      const workExp: WorkExperience = {
        id: 'test',
        type: NodeType.WorkExperience,
        title: 'Test',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
        company: 'Test Co',
        position: 'Test Role'
      };

      // These assertions verify BaseNode compatibility
      expect(workExp.id).toBeDefined();
      expect(workExp.type).toBeDefined();
      expect(workExp.title).toBeDefined();
      expect(workExp.createdAt).toBeDefined();
      expect(workExp.updatedAt).toBeDefined();
    });
  });
});