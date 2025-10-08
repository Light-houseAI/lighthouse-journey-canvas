// Core Profile Types
export interface UserProfile {
  id: string
  email: string
  name: string
  userName: string
  interest: string | null
  education: EducationEntry[]
  jobs: JobEntry[]
  projects: ProjectEntry[]
  insights: InsightEntry[]
  networkConnections?: NetworkConnection[]
}

export interface EducationEntry {
  id: string
  schoolName: string
  degree: string | null
  fieldOfStudy: string | null
  startDate: string
  endDate: string | null
  description: string | null
  location: string | null
  insights: InsightEntry[]
}

export interface JobEntry {
  id: string
  companyName: string
  role: string
  location: string | null
  startDate: string
  endDate: string | null
  description: string | null
  companySize: string | null
  industry: string | null
  projects: ProjectEntry[]
  events: EventEntry[]
  actions: ActionEntry[]
  insights: InsightEntry[]
}

export interface ProjectEntry {
  id: string
  title: string
  description: string | null
  type: 'work' | 'personal' | 'academic' | 'opensource'
  status: 'completed' | 'in_progress' | 'planned' | 'abandoned'
  technologies: string[]
  startDate: string | null
  endDate: string | null
  insights: InsightEntry[]
}

export interface InsightEntry {
  id?: string
  description: string
  resourceLinks?: ResourceLink[]
}

export interface ResourceLink {
  url: string
  title: string
}

export interface EventEntry {
  id: string
  title: string
  description: string | null
  date: string
}

export interface ActionEntry {
  id: string
  title: string
  description: string | null
  date: string
}

// Editing Intent
export type EditingIntent =
  | 'resume_writing'
  | 'requirements_documentation'

// LLM Types
export interface LLMSuggestion {
  message: string
  confidence: number
  reasoning: string
  examples: string[]
}

export interface LLMRequest {
  intent: EditingIntent
  currentText: string
  profileContext: ProfileContext
  userId: string
  sessionId: string
  previousInsights?: string[]
}

export interface ProfileContext {
  userName: string
  currentRole: string | null
  recentProjects: string[]
  skills: string[]
  education: string[]
  userInsights?: string[]
  networkInsights?: NetworkInsights
}

// Network Insights Types
export interface NetworkInsights {
  connections: NetworkConnection[]
  commonCompanies: string[]
  commonSchools: string[]
  industryDistribution: Record<string, number>
  skillOverlap: string[]
  careerPaths: CareerPath[]
}

export interface NetworkConnection {
  id: string
  name: string
  currentRole: string
  currentCompany: string
  sharedExperience: SharedExperience[]
  relationshipStrength: 'strong' | 'medium' | 'weak'
}

export interface SharedExperience {
  type: 'company' | 'school' | 'project' | 'skill'
  name: string
  timeOverlap?: {
    start: string
    end: string
  }
}

export interface CareerPath {
  description: string
  examplePeople: string[]
  commonTransitions: string[]
  timeframe: string
}

export interface LLMResponse {
  suggestion: LLMSuggestion | null
  error: LLMError | null
}

export interface LLMError {
  code: string
  message: string
  retryable: boolean
}

// Screenshot Processing Types
export interface ScreenshotProcessingRequest {
  imageBase64: string
  intent: EditingIntent
  userId: string
  profileContext: {
    userName: string
    currentRole: string | null
    networkInsights?: NetworkInsights
  }
}

export interface ScreenshotProcessingResponse {
  extractedText: string
  structuredData?: {
    jobTitle?: string
    company?: string
    dates?: string
    achievements?: string[]
    skills?: string[]
  }
  suggestions: LLMSuggestion[]
  confidence: number
}

// IPC Types
export interface IPCResponse<T = unknown> {
  success: boolean
  data: T | null
  error: string | null
}
