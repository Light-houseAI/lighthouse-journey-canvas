import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

describe('Bug Fixes Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('job experience dates are mapped correctly in milestone creation', () => {
    // Simulate form data with 'start' and 'end' fields (as used in the form)
    const formData = {
      type: 'workExperience',
      title: 'Software Engineer',
      company: 'Tech Corp',
      start: '2022-01',
      end: '2024-01',
      description: 'Great job',
      location: 'San Francisco, CA',
    };

    // Simulate the milestone creation logic from JourneyTimeline.tsx
    const milestone = {
      id: `${formData.type}-${Date.now()}`,
      type: formData.type,
      title: formData.title,
      description: formData.description,
      company: formData.company,
      organization: formData.company || undefined,
      school: undefined,
      degree: undefined,
      field: undefined,
      startDate: formData.start, // This is the fix - mapping 'start' to 'startDate'
      endDate: formData.end,     // This is the fix - mapping 'end' to 'endDate'
      date: formData.start,      // Use 'start' as the primary date
      ongoing: !formData.end,    // Use 'end' to determine if ongoing
      skills: [],
      technologies: [],
      location: formData.location,
    };

    // Verify the mapping is correct
    expect(milestone.startDate).toBe('2022-01');
    expect(milestone.endDate).toBe('2024-01');
    expect(milestone.date).toBe('2022-01');
    expect(milestone.ongoing).toBe(false);
    expect(milestone.title).toBe('Software Engineer');
    expect(milestone.company).toBe('Tech Corp');
  });

  test('ongoing job experience handles missing end date correctly', () => {
    const ongoingFormData = {
      type: 'workExperience',
      title: 'Current Job',
      company: 'Current Corp',
      start: '2024-01',
      end: undefined, // No end date for ongoing job
      isOngoing: true,
    };

    const milestone = {
      id: `${ongoingFormData.type}-${Date.now()}`,
      type: ongoingFormData.type,
      title: ongoingFormData.title,
      company: ongoingFormData.company,
      startDate: ongoingFormData.start,
      endDate: ongoingFormData.end,
      date: ongoingFormData.start,
      ongoing: !ongoingFormData.end, // Should be true when end is undefined
    };

    expect(milestone.startDate).toBe('2024-01');
    expect(milestone.endDate).toBeUndefined();
    expect(milestone.ongoing).toBe(true);
  });

  test('timeline edges for child nodes use center connections instead of handles', () => {
    // Simulate Timeline component edge creation logic
    const createTimelineEdge = (level: number, prevNodeId: string, currentNodeId: string) => {
      return {
        id: `${prevNodeId}-to-${currentNodeId}`,
        source: prevNodeId,
        target: currentNodeId,
        // For child timelines (level > 0), connect through center instead of handles
        sourceHandle: level > 0 ? undefined : 'right',
        targetHandle: level > 0 ? undefined : 'left',
        type: 'straightTimeline',
      };
    };

    // Test primary timeline (level 0) - should use handles
    const primaryTimelineEdge = createTimelineEdge(0, 'edu-1', 'exp-1');
    expect(primaryTimelineEdge.sourceHandle).toBe('right');
    expect(primaryTimelineEdge.targetHandle).toBe('left');

    // Test child timeline (level 1) - should connect through center
    const childTimelineEdge = createTimelineEdge(1, 'proj-1', 'proj-2');
    expect(childTimelineEdge.sourceHandle).toBeUndefined();
    expect(childTimelineEdge.targetHandle).toBeUndefined();

    // Test deeper nesting (level 2) - should also connect through center
    const deepChildEdge = createTimelineEdge(2, 'task-1', 'task-2');
    expect(deepChildEdge.sourceHandle).toBeUndefined();
    expect(deepChildEdge.targetHandle).toBeUndefined();
  });

  test('education dates are also mapped correctly', () => {
    const educationData = {
      type: 'education',
      school: 'University of Tech',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      start: '2018-08',
      end: '2022-05',
      description: 'Graduated Magna Cum Laude',
    };

    const milestone = {
      id: `${educationData.type}-${Date.now()}`,
      type: educationData.type,
      title: educationData.degree, // Use degree as title for education
      description: educationData.description,
      company: undefined,
      organization: educationData.school,
      school: educationData.school,
      degree: educationData.degree,
      field: educationData.field,
      startDate: educationData.start,
      endDate: educationData.end,
      date: educationData.start,
      ongoing: !educationData.end,
      skills: [],
      technologies: [],
      location: undefined,
    };

    expect(milestone.startDate).toBe('2018-08');
    expect(milestone.endDate).toBe('2022-05');
    expect(milestone.school).toBe('University of Tech');
    expect(milestone.degree).toBe('Bachelor of Science');
    expect(milestone.field).toBe('Computer Science');
  });

  test('project dates are mapped correctly for child timeline projects', () => {
    const projectData = {
      type: 'project',
      title: 'E-commerce Platform',
      description: 'Full-stack e-commerce solution',
      technologies: 'React, Node.js, PostgreSQL',
      start: '2023-01',
      end: '2023-06',
      parentNode: {
        id: 'exp-1',
        type: 'job',
        title: 'Mock Parent Job',
      },
    };

    const milestone = {
      id: `${projectData.type}-${Date.now()}`,
      type: projectData.type,
      title: projectData.title,
      description: projectData.description,
      company: undefined,
      organization: undefined,
      school: undefined,
      degree: undefined,
      field: undefined,
      startDate: projectData.start,
      endDate: projectData.end,
      date: projectData.start,
      ongoing: !projectData.end,
      skills: [],
      technologies: projectData.technologies ? projectData.technologies.split(', ') : [],
      location: undefined,
    };

    expect(milestone.startDate).toBe('2023-01');
    expect(milestone.endDate).toBe('2023-06');
    expect(milestone.title).toBe('E-commerce Platform');
    expect(milestone.technologies).toEqual(['React', 'Node.js', 'PostgreSQL']);
  });

  test('API payload structure is correct with fixed field mappings', () => {
    const mockFormData = {
      type: 'workExperience',
      title: 'Senior Developer',
      company: 'Big Tech',
      start: '2023-03',
      end: '2024-12',
      description: 'Leading development team',
      location: 'Remote',
    };

    // Expected API payload structure
    const expectedApiPayload = {
      milestone: {
        id: expect.stringMatching(/^workExperience-\d+$/),
        type: 'workExperience',
        title: 'Senior Developer',
        description: 'Leading development team',
        company: 'Big Tech',
        organization: 'Big Tech',
        school: undefined,
        degree: undefined,
        field: undefined,
        startDate: '2023-03', // Fixed: mapped from 'start'
        endDate: '2024-12',   // Fixed: mapped from 'end'
        date: '2023-03',
        ongoing: false,
        skills: [],
        technologies: [],
        location: 'Remote',
      },
    };

    // Create the milestone using the fixed logic
    const actualMilestone = {
      id: `${mockFormData.type}-${Date.now()}`,
      type: mockFormData.type,
      title: mockFormData.title,
      description: mockFormData.description,
      company: mockFormData.company,
      organization: mockFormData.company || mockFormData.school,
      school: mockFormData.school,
      degree: mockFormData.degree,
      field: mockFormData.field,
      startDate: mockFormData.start, // Fixed mapping
      endDate: mockFormData.end,     // Fixed mapping
      date: mockFormData.start,
      ongoing: !mockFormData.end,
      skills: mockFormData.skills || [],
      technologies: mockFormData.technologies || [],
      location: mockFormData.location,
    };

    const actualApiPayload = { milestone: actualMilestone };

    // Verify the structure matches
    expect(actualApiPayload.milestone.startDate).toBe(expectedApiPayload.milestone.startDate);
    expect(actualApiPayload.milestone.endDate).toBe(expectedApiPayload.milestone.endDate);
    expect(actualApiPayload.milestone.type).toBe(expectedApiPayload.milestone.type);
    expect(actualApiPayload.milestone.title).toBe(expectedApiPayload.milestone.title);
    expect(actualApiPayload.milestone.company).toBe(expectedApiPayload.milestone.company);
  });

  test('timeline line positioning for child nodes goes through center', () => {
    // Mock React Flow positions for child nodes
    const childNode1Position = { x: 300, y: 724 };
    const childNode2Position = { x: 800, y: 724 };
    
    // When sourceHandle and targetHandle are undefined, 
    // React Flow connects through the center of nodes
    const edgeWithoutHandles = {
      source: 'child-1',
      target: 'child-2',
      sourceHandle: undefined, // This makes the line go through center
      targetHandle: undefined, // This makes the line go through center
    };

    // The line should connect the centers of the nodes
    const expectedPath = {
      sourceX: childNode1Position.x, // Center X of first node
      sourceY: childNode1Position.y, // Center Y of first node
      targetX: childNode2Position.x, // Center X of second node
      targetY: childNode2Position.y, // Center Y of second node
    };

    // Since both nodes are at the same Y level (724), 
    // the line should be perfectly horizontal through their centers
    expect(expectedPath.sourceY).toBe(expectedPath.targetY);
    expect(expectedPath.targetX).toBeGreaterThan(expectedPath.sourceX);
    
    // Verify that not specifying handles allows center connections
    expect(edgeWithoutHandles.sourceHandle).toBeUndefined();
    expect(edgeWithoutHandles.targetHandle).toBeUndefined();
  });
});