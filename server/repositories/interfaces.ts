import type { User, Profile, Milestone, InsertUser, InsertProfile } from '@shared/schema';

export interface IBaseRepository<T, TInsert = Partial<T>> {
  findById(id: number): Promise<T | null>;
  findMany(options?: QueryOptions): Promise<T[]>;
  create(data: TInsert): Promise<T>;
  update(id: number, data: Partial<T>): Promise<T | null>;
  delete(id: number): Promise<boolean>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  where?: Record<string, any>;
}

export interface IUserRepository extends IBaseRepository<User, InsertUser> {
  findByEmail(email: string): Promise<User | null>;
  findByIdWithProfile(id: number): Promise<(User & { profile?: Profile }) | null>;
  updateOnboardingStatus(id: number, hasCompleted: boolean): Promise<boolean>;
  searchUsers(query: string, limit?: number): Promise<User[]>;
}

export interface IProfileRepository extends IBaseRepository<Profile, InsertProfile> {
  findByUserId(userId: number): Promise<Profile | null>;
  findByUsername(username: string): Promise<Profile | null>;
  updateProjects(profileId: number, projects: Milestone[]): Promise<boolean>;
  addMilestone(profileId: number, milestone: Milestone): Promise<boolean>;
  removeMilestone(profileId: number, milestoneId: string): Promise<boolean>;
  updateMilestone(profileId: number, milestoneId: string, updates: Partial<Milestone>): Promise<boolean>;
}

export interface ISkillRepository {
  findByUserId(userId: number, options?: SkillQueryOptions): Promise<SkillRecord[]>;
  findByCategory(userId: number, category: string): Promise<SkillRecord[]>;
  create(userId: number, skill: SkillInput): Promise<SkillRecord>;
  update(id: number, updates: Partial<SkillRecord>): Promise<SkillRecord | null>;
  upsert(userId: number, skill: SkillInput): Promise<SkillRecord>;
  search(userId: number, query: string, limit?: number): Promise<SkillRecord[]>;
  getStats(userId: number): Promise<SkillStats>;
  updateActivity(userId: number, skillName: string, isActive: boolean): Promise<boolean>;
}

export interface SkillQueryOptions {
  category?: string;
  isActive?: boolean;
  minConfidence?: number;
  limit?: number;
}

export interface SkillRecord {
  id: number;
  userId: number;
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'language' | 'certification';
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  confidence: number;
  source: string;
  context?: string;
  keywords: string[];
  firstMentioned: Date;
  lastMentioned: Date;
  mentionCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillInput {
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'language' | 'certification';
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  confidence: number;
  source: string;
  context?: string;
  keywords?: string[];
}

export interface SkillStats {
  totalSkills: number;
  skillsByCategory: Record<string, number>;
  averageConfidence: number;
  recentSkills: number;
}
