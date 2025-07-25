import type { User, Profile, Milestone, InsertUser, InsertProfile } from '../../shared/schema';
import type { SkillRecord, SkillInput, SkillStats } from '../repositories/interfaces';

export interface IUserService {
  getUserById(id: number): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserWithProfile(id: number): Promise<(User & { profile?: Profile }) | null>;
  createUser(userData: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | null>;
  completeOnboarding(id: number): Promise<boolean>;
  deleteUser(id: number): Promise<boolean>;
}

export interface IProfileService {
  getProfileById(id: number): Promise<Profile | null>;
  getProfileByUserId(userId: number): Promise<Profile | null>;
  getProfileByUsername(username: string): Promise<Profile | null>;
  createProfile(profileData: InsertProfile): Promise<Profile>;
  updateProfile(id: number, updates: Partial<Profile>): Promise<Profile | null>;
  addMilestone(profileId: number, milestone: Milestone): Promise<boolean>;
  updateMilestone(profileId: number, milestoneId: string, updates: Partial<Milestone>): Promise<boolean>;
  removeMilestone(profileId: number, milestoneId: string): Promise<boolean>;
  getMilestones(profileId: number): Promise<Milestone[]>;
}

export interface ISkillService {
  getUserSkills(userId: number, filters?: SkillFilters): Promise<SkillRecord[]>;
  getSkillsByCategory(userId: number): Promise<Record<string, SkillRecord[]>>;
  addSkill(userId: number, skill: SkillInput): Promise<SkillRecord>;
  updateSkill(skillId: number, updates: Partial<SkillRecord>): Promise<SkillRecord | null>;
  extractAndStoreSkills(userId: number, text: string, source: string): Promise<SkillRecord[]>;
  searchSkills(userId: number, query: string): Promise<SkillRecord[]>;
  getSkillStats(userId: number): Promise<SkillStats>;
  toggleSkillActivity(userId: number, skillName: string, isActive: boolean): Promise<boolean>;
}

export interface SkillFilters {
  category?: string;
  isActive?: boolean;
  minConfidence?: number;
  limit?: number;
}

export interface IAIService {
  generateResponse(messages: Array<{ role: string; content: string }>): Promise<string>;
  generateStructuredResponse<T>(
    messages: Array<{ role: string; content: string }>,
    schema: any
  ): Promise<T>;
  extractSkills(text: string): Promise<SkillInput[]>;
  generateMilestones(conversationText: string): Promise<Milestone[]>;
  analyzeCareerProgress(profile: Profile, skills: SkillRecord[]): Promise<CareerAnalysis>;
}

export interface CareerAnalysis {
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  nextSteps: string[];
  score: number;
}

export interface IContextService {
  extractContext(userId: number, lookbackDays?: number): Promise<ConversationContext>;
  generateCheckInTheme(userId: number, context: ConversationContext): Promise<CheckInTheme | null>;
  extractMilestonesFromConversation(conversationText: string): Promise<ExtractedMilestones | null>;
  updateProgressFromCheckIn(userId: number, checkInConversation: string): Promise<ExtractedMilestones | null>;
  generateContextualCheckIn(userId: number): Promise<CheckInTheme>;
}

export interface ConversationContext {
  challenges: Challenge[];
  decisions: Decision[];
  achievements: Achievement[];
  goals: Goal[];
  patterns: Pattern[];
}

export interface Challenge {
  description: string;
  severity: 'low' | 'medium' | 'high';
  category: string;
  firstMentioned: string;
  lastMentioned: string;
  status: 'ongoing' | 'resolved' | 'escalating';
}

export interface Decision {
  description: string;
  context: string;
  outcome?: string;
  date: string;
  category: string;
}

export interface Achievement {
  description: string;
  impact: string;
  skills: string[];
  date: string;
}

export interface Goal {
  description: string;
  status: 'planned' | 'in-progress' | 'completed' | 'blocked';
  dueDate?: string;
  tasks: string[];
}

export interface Pattern {
  type: string;
  description: string;
  frequency: number;
  lastOccurrence: string;
}

export interface CheckInTheme {
  primaryTheme: 'challenges_insights' | 'decisions_collaboration' | 'learning_reflection' | 'goals_progress' | 'momentum_success';
  reasoning: string;
  specificFocus: string[];
  suggestedQuestions: string[];
  contextualReferences: string[];
}

export interface ExtractedMilestones {
  completedMilestones: CompletedMilestone[];
  progressUpdates: ProgressUpdate[];
  newGoals: NewGoal[];
  challengesIdentified: IdentifiedChallenge[];
}

export interface CompletedMilestone {
  description: string;
  category: string;
  impact: string;
  skills: string[];
  dateContext: string;
  significance: 'minor' | 'moderate' | 'major';
}

export interface ProgressUpdate {
  project: string;
  previousStatus: string;
  currentStatus: string;
  nextSteps: string[];
}

export interface NewGoal {
  description: string;
  timeframe: string;
  requiredTasks: string[];
}

export interface IdentifiedChallenge {
  description: string;
  impact: string;
  potentialSolutions: string[];
}