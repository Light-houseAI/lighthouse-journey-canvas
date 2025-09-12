import { OrganizationType, OrgMemberRole, TimelineNodeType, VisibilityLevel } from '../../../../shared/enums';
import { CreateTimelineNodeDTO, InsightCreateDTO,Organization, OrgMember, TimelineNode, User } from '../../../../shared/types';

// Extend User type from shared for test users
export type TestUser = Pick<User, 'email'> & {
  password: string; // Add password for test authentication
  name: string;     // Simplified name field for tests
};

// Use shared types instead of recreating them
export type TestNodeData = CreateTimelineNodeDTO & {
  title: string; // Add title field for test convenience
  id?: string;   // Optional id for created nodes
};

// Use shared insight types as base, extend for test convenience
export type TestInsightData = InsightCreateDTO & {
  nodeId?: string; // Add nodeId for test convenience
};

// ===== ENTERPRISE TIMELINE FACTORY INTERFACES =====

export interface HierarchyData {
  root: TestNodeData;
  children: TestNodeData[];
  levels: number;
}

export interface CompleteJourneyData {
  education: TestNodeData[];
  positions: TestNodeData[];
  transitions: TestNodeData[];
  skills: string[];
  timeline: TestNodeData[];
}

export interface EducationHierarchy {
  degree: TestNodeData;
  courses: TestNodeData[];
  achievements: string[];
  gpa: string;
}

export interface WorkHistory {
  position: TestNodeData;
  projects: TestNodeData[];
  actions: TestNodeData[];
  achievements: string[];
  skills: string[];
}

export interface OrgPermissionData {
  organization: Pick<Organization, 'id' | 'name' | 'type'> & {
    members: Array<{
      user: TestUser;
      role: OrgMemberRole | 'owner' | 'manager'; // Include test-specific roles
      permissions: string[];
    }>;
  };
  sharedNodes: TestNodeData[];
  permissionScenarios: Array<{
    nodeId: string;
    userId: string;
    expectedAccess: 'full' | 'edit' | 'read' | 'none';
  }>;
}

export interface SharedNodeData {
  node: TestNodeData;
  owner: TestUser;
  permissions: Array<{
    user: TestUser;
    level: VisibilityLevel | 'edit' | 'admin'; // Use shared VisibilityLevel + test extensions
    canShare: boolean;
  }>;
  testScenarios: string[];
}

export interface LargeDataset {
  nodes: TestNodeData[];
  expectedPerformance: {
    loadTime: number; // ms
    renderTime: number; // ms
    interactionDelay: number; // ms
  };
  memoryExpected: number; // MB
}

export interface ComplexHierarchyData {
  root: TestNodeData;
  levels: TestNodeData[][];
  totalNodes: number;
  maxDepth: number;
  relationships: Array<{
    parent: string;
    children: string[];
  }>;
}

export interface TemporalTestData {
  past: TestNodeData[];
  current: TestNodeData[];
  future: TestNodeData[];
  timeline: TestNodeData[];
}

export class TestDataFactory {
  private static nodeIdCounter = 1;
  private static userIdCounter = 1;

  /**
   * Generate unique test user data
   */
  static createNewUser(overrides?: Partial<TestUser>): TestUser {
    const timestamp = Date.now();
    const userId = this.userIdCounter++;
    return {
      email: `test-user-${userId}-${timestamp}@example.com`,
      password: 'TestPassword123!',
      name: `Test User ${userId}`,
      ...overrides
    };
  }

  /**
   * Create test data for Job nodes
   */
  static createJobNode(overrides?: Partial<TestNodeData>): TestNodeData {
    return {
      type: TimelineNodeType.Job,
      title: 'Software Engineer',
      meta: {
        orgId: 123,
        role: 'Software Engineer',
        company: 'Tech Corp',
        startDate: '2024-01',
        endDate: '2024-12',
        location: 'San Francisco, CA',
        description: 'Developed web applications using modern technologies',
        technologies: ['React', 'TypeScript', 'Node.js'],
        achievements: ['Led team of 5 developers', 'Reduced load time by 40%']
      },
      ...overrides
    };
  }

  /**
   * Create test data for Education nodes
   */
  static createEducationNode(overrides?: Partial<TestNodeData>): TestNodeData {
    return {
      type: TimelineNodeType.Education,
      title: 'Computer Science Degree',
      meta: {
        institution: 'University of Technology',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        startDate: '2020-09',
        endDate: '2024-05',
        gpa: '3.8',
        location: 'Boston, MA',
        courses: ['Data Structures', 'Algorithms', 'Software Engineering'],
        achievements: ['Dean\'s List', 'Cum Laude']
      },
      ...overrides
    };
  }

  /**
   * Create test data for Project nodes
   */
  static createProjectNode(overrides?: Partial<TestNodeData>): TestNodeData {
    return {
      type: TimelineNodeType.Project,
      title: 'E-commerce Platform',
      meta: {
        description: 'Built a full-stack e-commerce platform with React and Node.js',
        technologies: ['React', 'Node.js', 'PostgreSQL', 'AWS'],
        startDate: '2024-03',
        endDate: '2024-08',
        status: 'completed',
        githubUrl: 'https://github.com/example/ecommerce',
        liveUrl: 'https://example-ecommerce.com',
        role: 'Full Stack Developer',
        teamSize: 3,
        outcomes: ['Increased sales by 25%', 'Improved user experience']
      },
      ...overrides
    };
  }

  /**
   * Create test data for Event nodes
   */
  static createEventNode(overrides?: Partial<TestNodeData>): TestNodeData {
    return {
      type: TimelineNodeType.Event,
      title: 'Tech Conference 2024',
      meta: {
        eventType: 'conference',
        location: 'Austin, TX',
        date: '2024-06-15',
        description: 'Attended annual technology conference focusing on AI and machine learning',
        organizer: 'Tech Events Inc',
        attendees: 5000,
        sessions: ['AI in Production', 'Machine Learning Best Practices'],
        networking: true,
        certification: 'Attendance Certificate'
      },
      ...overrides
    };
  }

  /**
   * Create test data for Action nodes
   */
  static createActionNode(overrides?: Partial<TestNodeData>): TestNodeData {
    return {
      type: TimelineNodeType.Action,
      title: 'Implemented CI/CD Pipeline',
      meta: {
        actionType: 'implementation',
        description: 'Set up automated deployment pipeline using GitHub Actions',
        date: '2024-04-10',
        duration: '2 weeks',
        tools: ['GitHub Actions', 'Docker', 'AWS'],
        impact: 'Reduced deployment time from 2 hours to 10 minutes',
        stakeholders: ['Development Team', 'DevOps Team'],
        outcome: 'successful',
        documentation: 'https://docs.internal.com/cicd-pipeline'
      },
      ...overrides
    };
  }

  /**
   * Create test data for Career Transition nodes
   */
  static createCareerTransitionNode(overrides?: Partial<TestNodeData>): TestNodeData {
    return {
      type: TimelineNodeType.CareerTransition,
      title: 'Career Change to Tech',
      meta: {
        transitionType: 'career_change',
        fromRole: 'Marketing Manager',
        toRole: 'Software Engineer',
        fromIndustry: 'Marketing',
        toIndustry: 'Technology',
        startDate: '2023-01',
        endDate: '2024-01',
        motivation: 'Passion for technology and problem-solving',
        preparation: ['Coding bootcamp', 'Personal projects', 'Networking'],
        challenges: ['Learning curve', 'Salary adjustment'],
        outcomes: ['Successful role transition', 'Career satisfaction'],
        location: 'San Francisco, CA'
      },
      ...overrides
    };
  }

  /**
   * Create test insight data
   */
  static createInsight(overrides?: Partial<TestInsightData>): TestInsightData {
    const insights = [
      'Learned the importance of code reviews in maintaining quality',
      'Discovered that clear communication prevents most project issues',
      'Found that automated testing saves significant debugging time',
      'Realized that user feedback is crucial for product development',
      'Understood that continuous learning is essential in tech careers'
    ];

    return {
      description: insights[Math.floor(Math.random() * insights.length)],
      resources: [], // Empty resources array as default
      ...overrides
    };
  }

  /**
   * Create hierarchy test data (parent with children)
   */
  static createHierarchyData() {
    const job = TestDataFactory.createJobNode();
    const project1 = TestDataFactory.createProjectNode({ 
      parentId: 'job-id',
      title: 'Main Project' 
    });
    const project2 = TestDataFactory.createProjectNode({ 
      parentId: 'job-id',
      title: 'Side Project' 
    });
    const subProject = TestDataFactory.createProjectNode({
      parentId: 'project1-id',
      title: 'Sub Project',
      meta: {
        ...TestDataFactory.createProjectNode().meta,
        description: 'A sub-component of the main project'
      }
    });

    return {
      parent: job,
      children: [project1, project2],
      grandchildren: [subProject]
    };
  }

  /**
   * Generate realistic timeline data for testing
   */
  static createTimelineData() {
    return [
      TestDataFactory.createEducationNode({
        meta: {
          ...TestDataFactory.createEducationNode().meta,
          startDate: '2018-09',
          endDate: '2022-05'
        }
      }),
      TestDataFactory.createJobNode({
        meta: {
          ...TestDataFactory.createJobNode().meta,
          startDate: '2022-06',
          endDate: '2024-12'
        }
      }),
      TestDataFactory.createProjectNode({
        parentId: 'job-id',
        meta: {
          ...TestDataFactory.createProjectNode().meta,
          startDate: '2023-01',
          endDate: '2023-06'
        }
      }),
      TestDataFactory.createEventNode({
        meta: {
          ...TestDataFactory.createEventNode().meta,
          date: '2023-08-15'
        }
      })
    ];
  }

  // ===== NEW ENTERPRISE TIMELINE FACTORY METHODS =====

  /**
   * Generate unique node ID with realistic format
   */
  private static generateNodeId(): string {
    const id = this.nodeIdCounter++;
    return `123e4567-e89b-12d3-a456-42661417${id.toString().padStart(4, '0')}`;
  }

  /**
   * Create node of specific type with realistic data
   */
  static createNodeOfType(type: TimelineNodeType, overrides?: Partial<TestNodeData>): TestNodeData {
    const baseData = { id: this.generateNodeId() };
    
    switch (type) {
      case TimelineNodeType.Job:
        return { ...this.createJobNode(baseData), ...overrides };
      case TimelineNodeType.Education:
        return { ...this.createEducationNode(baseData), ...overrides };
      case TimelineNodeType.Project:
        return { ...this.createProjectNode(baseData), ...overrides };
      case TimelineNodeType.Event:
        return { ...this.createEventNode(baseData), ...overrides };
      case TimelineNodeType.Action:
        return { ...this.createActionNode(baseData), ...overrides };
      case TimelineNodeType.CareerTransition:
        return { ...this.createCareerTransitionNode(baseData), ...overrides };
      default:
        throw new Error(`Unsupported node type: ${type}`);
    }
  }

  /**
   * Create hierarchical structure with specified depth
   */
  static createNodeHierarchy(depth: number, rootType: TimelineNodeType = TimelineNodeType.Job): HierarchyData {
    const root = this.createNodeOfType(rootType);
    const hierarchy: HierarchyData = {
      root,
      children: [],
      levels: depth
    };

    // Define valid child types based on HIERARCHY_RULES
    const validChildTypes: Record<TimelineNodeType, TimelineNodeType[]> = {
      [TimelineNodeType.Job]: [TimelineNodeType.Project, TimelineNodeType.Event, TimelineNodeType.Action],
      [TimelineNodeType.Education]: [TimelineNodeType.Project, TimelineNodeType.Event, TimelineNodeType.Action],
      [TimelineNodeType.Event]: [TimelineNodeType.Project, TimelineNodeType.Action],
      [TimelineNodeType.Action]: [TimelineNodeType.Project],
      [TimelineNodeType.CareerTransition]: [TimelineNodeType.Project, TimelineNodeType.Event, TimelineNodeType.Action],
      [TimelineNodeType.Project]: [] // Leaf nodes
    };

    const buildLevel = (parentNode: TestNodeData, currentDepth: number): TestNodeData[] => {
      if (currentDepth >= depth) return [];
      
      const childTypes = validChildTypes[parentNode.type] || [];
      const children: TestNodeData[] = [];
      
      // Create 1-3 children per level
      const childCount = Math.min(childTypes.length, Math.floor(Math.random() * 3) + 1);
      
      for (let i = 0; i < childCount; i++) {
        const childType = childTypes[i % childTypes.length];
        const child = this.createNodeOfType(childType, {
          parentId: parentNode.id,
          title: `${childType} ${i + 1} (Level ${currentDepth + 1})`
        });
        
        // Recursively add grandchildren
        const grandchildren = buildLevel(child, currentDepth + 1);
        (child as any).children = grandchildren;
        
        children.push(child);
      }
      
      return children;
    };

    hierarchy.children = buildLevel(root, 0);
    return hierarchy;
  }

  /**
   * Create realistic career journey with multiple phases
   */
  static createCareerJourney(): CompleteJourneyData {
    const journey: CompleteJourneyData = {
      education: [],
      positions: [],
      transitions: [],
      skills: [],
      timeline: []
    };

    // Education phase
    const undergrad = this.createEducationNode({
      title: 'Bachelor of Computer Science',
      meta: {
        ...this.createEducationNode().meta,
        startDate: '2018-09',
        endDate: '2022-05',
        degree: 'Bachelor of Science',
        field: 'Computer Science'
      }
    });

    const masterClass = this.createEducationNode({
      title: 'Advanced React Development',
      meta: {
        institution: 'Tech Learning Academy',
        degree: 'Certificate',
        field: 'Web Development',
        startDate: '2023-01',
        endDate: '2023-03',
        location: 'Online'
      }
    });

    journey.education = [undergrad, masterClass];

    // Career positions
    const internship = this.createJobNode({
      title: 'Software Engineering Intern',
      meta: {
        ...this.createJobNode().meta,
        role: 'Software Engineering Intern',
        company: 'StartupCorp',
        startDate: '2021-06',
        endDate: '2021-08',
        description: 'Built internal tools and learned agile development'
      }
    });

    const juniorRole = this.createJobNode({
      title: 'Junior Software Engineer',
      meta: {
        ...this.createJobNode().meta,
        role: 'Junior Software Engineer',
        company: 'TechCorp',
        startDate: '2022-06',
        endDate: '2024-01'
      }
    });

    const seniorRole = this.createJobNode({
      title: 'Senior Software Engineer',
      meta: {
        ...this.createJobNode().meta,
        role: 'Senior Software Engineer',
        company: 'BigTech',
        startDate: '2024-02',
        endDate: null // Current position
      }
    });

    journey.positions = [internship, juniorRole, seniorRole];

    // Career transition
    const transition = this.createCareerTransitionNode({
      title: 'Junior to Senior Engineer',
      meta: {
        ...this.createCareerTransitionNode().meta,
        fromRole: 'Junior Software Engineer',
        toRole: 'Senior Software Engineer',
        startDate: '2023-12',
        endDate: '2024-02'
      }
    });

    journey.transitions = [transition];

    // Build complete timeline
    journey.timeline = [...journey.education, ...journey.positions, ...journey.transitions]
      .sort((a, b) => {
        const aStart = String(a.meta.startDate || a.meta.date || '');
        const bStart = String(b.meta.startDate || b.meta.date || '');
        return aStart.localeCompare(bStart);
      });

    return journey;
  }

  /**
   * Create education path with courses and achievements
   */
  static createEducationPath(): EducationHierarchy {
    const degree = this.createEducationNode();
    
    // Create courses as projects under education
    const courses = [
      this.createProjectNode({
        parentId: degree.id,
        title: 'Data Structures & Algorithms',
        meta: {
          description: 'Advanced study of algorithmic complexity and data structures',
          technologies: ['Java', 'Python'],
          startDate: '2020-01',
          endDate: '2020-05',
          status: 'completed',
          outcomes: ['A+ grade', 'Top 5% of class']
        }
      }),
      this.createProjectNode({
        parentId: degree.id,
        title: 'Senior Capstone Project',
        meta: {
          description: 'Built a full-stack web application for local business',
          technologies: ['React', 'Node.js', 'MongoDB'],
          startDate: '2021-09',
          endDate: '2022-05',
          status: 'completed',
          outcomes: ['Magna Cum Laude', 'Best Project Award']
        }
      })
    ];

    return {
      degree,
      courses,
      achievements: ['Dean\'s List', 'Computer Science Academic Excellence Award'],
      gpa: '3.85'
    };
  }

  /**
   * Create professional experience with projects and outcomes
   */
  static createProfessionalExperience(): WorkHistory {
    const position = this.createJobNode();
    
    const projects = [
      this.createProjectNode({
        parentId: position.id,
        title: 'Customer Dashboard Redesign',
        meta: {
          description: 'Led complete redesign of customer analytics dashboard',
          technologies: ['React', 'TypeScript', 'D3.js'],
          startDate: '2024-03',
          endDate: '2024-08',
          status: 'completed',
          role: 'Lead Frontend Developer',
          teamSize: 4,
          outcomes: ['40% increase in user engagement', '25% reduction in support tickets']
        }
      })
    ];

    const actions = [
      this.createActionNode({
        parentId: position.id,
        title: 'Implemented Automated Testing',
        meta: {
          actionType: 'implementation',
          description: 'Set up comprehensive test suite with 90% coverage',
          date: '2024-05-15',
          duration: '3 weeks',
          tools: ['Jest', 'Playwright', 'GitHub Actions'],
          impact: '60% reduction in production bugs',
          outcome: 'successful'
        }
      })
    ];

    return {
      position,
      projects,
      actions,
      achievements: ['Employee of the Month', 'Technical Innovation Award'],
      skills: ['React', 'TypeScript', 'Team Leadership', 'Project Management']
    };
  }

  /**
   * Create organization with permission scenarios
   */
  static createOrgWithPermissions(): OrgPermissionData {
    const organization = {
      id: Math.floor(Math.random() * 10000), // Use number ID like shared Organization type
      name: 'TechCorp Engineering',
      type: OrganizationType.Company,
      members: []
    };

    // Create test users with different roles
    const owner = this.createNewUser({ name: 'John Owner' });
    const manager = this.createNewUser({ name: 'Jane Manager' });
    const member = this.createNewUser({ name: 'Bob Member' });

    organization.members = [
      { user: owner, role: 'owner', permissions: ['read', 'write', 'share', 'delete'] },
      { user: manager, role: 'manager', permissions: ['read', 'write', 'share'] },
      { user: member, role: 'member', permissions: ['read'] }
    ];

    // Create shared nodes with different permission levels
    const sharedJob = this.createJobNode({
      title: 'Senior Engineer Role (Shared)',
      meta: {
        ...this.createJobNode().meta,
        company: organization.name
      }
    });

    return {
      organization,
      sharedNodes: [sharedJob],
      permissionScenarios: [
        { nodeId: sharedJob.id!, userId: owner.email, expectedAccess: 'full' },
        { nodeId: sharedJob.id!, userId: manager.email, expectedAccess: 'edit' },
        { nodeId: sharedJob.id!, userId: member.email, expectedAccess: 'read' }
      ]
    };
  }

  /**
   * Create shared node scenario for permission testing
   */
  static createSharedNodeScenario(): SharedNodeData {
    const owner = this.createNewUser({ name: 'Node Owner' });
    const collaborator = this.createNewUser({ name: 'Node Collaborator' });
    const viewer = this.createNewUser({ name: 'Node Viewer' });

    const node = this.createJobNode({
      title: 'Shared Engineering Position'
    });

    return {
      node,
      owner,
      permissions: [
        { user: collaborator, level: 'edit', canShare: true },
        { user: viewer, level: VisibilityLevel.Overview, canShare: false }
      ],
      testScenarios: [
        'owner can create, edit, delete, share',
        'collaborator can edit and share but not delete',
        'viewer can only view, no modifications',
        'permission revocation removes access'
      ]
    };
  }

  /**
   * Create large dataset for performance testing
   */
  static createLargeDataset(nodeCount: number): LargeDataset {
    const nodes: TestNodeData[] = [];
    const nodeTypes = Object.values(TimelineNodeType);

    for (let i = 0; i < nodeCount; i++) {
      const type = nodeTypes[i % nodeTypes.length];
      const node = this.createNodeOfType(type, {
        title: `${type} Node ${i + 1}`,
        meta: {
          ...this.createNodeOfType(type).meta,
          description: `Performance test node ${i + 1} with realistic data for load testing`
        }
      });
      nodes.push(node);
    }

    return {
      nodes,
      expectedPerformance: {
        loadTime: nodeCount < 100 ? 3000 : 5000, // ms
        renderTime: nodeCount < 100 ? 1000 : 2000, // ms
        interactionDelay: 500 // ms
      },
      memoryExpected: Math.ceil(nodeCount * 0.1) // MB estimate
    };
  }

  /**
   * Create complex hierarchy for advanced testing
   */
  static createComplexHierarchy(): ComplexHierarchyData {
    const root = this.createJobNode({
      title: 'Senior Engineering Manager'
    });

    // Level 1: Major projects and events
    const project1 = this.createProjectNode({
      parentId: root.id,
      title: 'Platform Migration Project'
    });

    const project2 = this.createProjectNode({
      parentId: root.id,
      title: 'Team Scaling Initiative'
    });

    const conference = this.createEventNode({
      parentId: root.id,
      title: 'Tech Leadership Conference'
    });

    // Level 2: Sub-projects and actions
    const subProject1 = this.createProjectNode({
      parentId: project1.id,
      title: 'Database Migration'
    });

    const action1 = this.createActionNode({
      parentId: project1.id,
      title: 'Performance Optimization'
    });

    const action2 = this.createActionNode({
      parentId: conference.id,
      title: 'Keynote Presentation'
    });

    // Level 3: Detailed implementations
    const implementation = this.createProjectNode({
      parentId: subProject1.id,
      title: 'Data Pipeline Setup'
    });

    return {
      root,
      levels: [
        [project1, project2, conference],
        [subProject1, action1, action2],
        [implementation]
      ],
      totalNodes: 8,
      maxDepth: 3,
      relationships: [
        { parent: root.id!, children: [project1.id!, project2.id!, conference.id!] },
        { parent: project1.id!, children: [subProject1.id!, action1.id!] },
        { parent: conference.id!, children: [action2.id!] },
        { parent: subProject1.id!, children: [implementation.id!] }
      ]
    };
  }

  /**
   * Create temporal test data with date relationships
   */
  static createTemporalData(): TemporalTestData {
    const now = new Date();
    const past = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

    const pastJob = this.createJobNode({
      title: 'Previous Position',
      meta: {
        ...this.createJobNode().meta,
        startDate: past.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0]
      }
    });

    const currentJob = this.createJobNode({
      title: 'Current Position',
      meta: {
        ...this.createJobNode().meta,
        startDate: now.toISOString().split('T')[0],
        endDate: null // Ongoing
      }
    });

    const upcomingEvent = this.createEventNode({
      title: 'Future Conference',
      meta: {
        ...this.createEventNode().meta,
        date: future.toISOString().split('T')[0]
      }
    });

    return {
      past: [pastJob],
      current: [currentJob],
      future: [upcomingEvent],
      timeline: [pastJob, currentJob, upcomingEvent].sort((a, b) => {
        const aDate = String(a.meta.startDate || a.meta.date || '');
        const bDate = String(b.meta.startDate || b.meta.date || '');
        return aDate.localeCompare(bDate);
      })
    };
  }
}