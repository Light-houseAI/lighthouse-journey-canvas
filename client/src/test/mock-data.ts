import { WorkExperienceData, EducationData, ProjectData, ProfileData } from '@/stores/data-store'

/**
 * Mock data factories for testing
 * Following the component-centric architecture data structures
 */

export const createMockWorkExperience = (overrides?: Partial<WorkExperienceData>): WorkExperienceData => ({
  id: 'exp-1',
  title: 'Senior Software Engineer',
  company: 'Tech Company Inc.',
  start: '2022-01',
  end: '2024-01',
  description: 'Led development of key features and mentored junior developers.',
  location: 'San Francisco, CA',
  projects: [],
  ...overrides,
})

export const createMockEducation = (overrides?: Partial<EducationData>): EducationData => ({
  id: 'edu-1',
  school: 'University of Technology',
  degree: 'Bachelor of Science',
  field: 'Computer Science',
  start: '2018-08',
  end: '2022-05',
  description: 'Graduated Magna Cum Laude with focus on software engineering.',
  ...overrides,
})

export const createMockProject = (overrides?: Partial<ProjectData>): ProjectData => ({
  id: 'proj-1',
  title: 'E-commerce Platform',
  description: 'Built a scalable e-commerce platform using React and Node.js',
  start: '2023-01',
  end: '2023-06',
  technologies: ['React', 'Node.js', 'PostgreSQL', 'Redis'],
  experienceId: 'exp-1',
  ...overrides,
})

export const createMockProfileData = (overrides?: Partial<ProfileData>): ProfileData => {
  const mockExperience = createMockWorkExperience()
  const mockEducation = createMockEducation()
  
  return {
    experiences: [mockExperience],
    education: [mockEducation],
    filteredData: {
      experiences: [mockExperience],
      education: [mockEducation],
    },
    ...overrides,
  }
}

// Mock React Flow node data
export const createMockWorkExperienceNodeData = (overrides?: any) => ({
  ...createMockWorkExperience(),
  type: 'workExperience',
  branch: 0,
  isFocused: false,
  isBlurred: false,
  isSelected: false,
  isHighlighted: false,
  onNodeClick: vi.fn(),
  onNodeDelete: vi.fn(),
  ...overrides,
})

export const createMockEducationNodeData = (overrides?: any) => ({
  ...createMockEducation(),
  type: 'education',
  branch: 0,
  isFocused: false,
  isBlurred: false,
  isSelected: false,
  isHighlighted: false,
  onNodeClick: vi.fn(),
  onNodeDelete: vi.fn(),
  ...overrides,
})

export const createMockProjectNodeData = (overrides?: any) => ({
  ...createMockProject(),
  type: 'project',
  parentExperienceId: 'exp-1',
  isSelected: false,
  isHighlighted: false,
  onNodeClick: vi.fn(),
  onNodeDelete: vi.fn(),
  originalProject: createMockProject(),
  ...overrides,
})

// Timeline positioning test data
export const createMockTimelineItems = () => [
  {
    nodeId: 'edu-1',
    type: 'education',
    start: '2018-08',
    end: '2022-05',
    data: createMockEducationNodeData({ id: 'edu-1' }),
  },
  {
    nodeId: 'exp-1',
    type: 'workExperience',
    start: '2022-01',
    end: '2024-01',
    data: createMockWorkExperienceNodeData({ id: 'exp-1' }),
  },
  {
    nodeId: 'exp-2',
    type: 'workExperience',
    start: '2024-02',
    end: 'Present',
    data: createMockWorkExperienceNodeData({ 
      id: 'exp-2',
      title: 'Staff Software Engineer',
      company: 'New Tech Corp',
    }),
  },
]

// Mock API responses
export const createMockApiResponse = (data: any, success = true) => ({
  ok: success,
  status: success ? 200 : 400,
  json: async () => data,
})

// Behavior store test helpers
export const createMockBehaviorStates = () => ({
  focus: {
    isFocused: false,
    isBlurred: false,
    focusedExperienceId: null,
    focus: vi.fn(),
    clearFocus: vi.fn(),
    setFocusedExperience: vi.fn(),
  },
  selection: {
    isSelected: false,
    selectedNodeId: null,
    select: vi.fn(),
    clearSelection: vi.fn(),
    setSelectedNode: vi.fn(),
    selectNext: vi.fn(),
    selectPrevious: vi.fn(),
  },
  highlight: {
    isHighlighted: false,
    highlightedNodeId: null,
    highlight: vi.fn(),
    clearHighlight: vi.fn(),
    highlightTemporary: vi.fn(),
    flashHighlight: vi.fn(),
    setHighlightedNode: vi.fn(),
  },
  interaction: {
    isHovered: false,
    isDragged: false,
    hasContextMenu: false,
    isInteracting: false,
    hoveredNodeId: null,
    draggedNodeId: null,
    contextMenuNodeId: null,
    setHovered: vi.fn(),
    clearHovered: vi.fn(),
    setDragged: vi.fn(),
    clearDragged: vi.fn(),
    setContextMenu: vi.fn(),
    clearContextMenu: vi.fn(),
    clearAllInteractions: vi.fn(),
  },
})