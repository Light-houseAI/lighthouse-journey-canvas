import {
  type InsightCreateDTO,
  type InsightUpdateDTO,
  type NodeInsight,
  type InsertUser,
  type User,
} from '@journey/schema';
import type { NodeFilter } from '../repositories/filters/node-filter.js';
import type {
  CreateNodeDTO,
  NodeWithParent,
  NodeWithParentAndPermissions,
  UpdateNodeDTO,
} from './hierarchy-service.js';

/**
 * Interface for HierarchyService to enable proper mocking in tests
 */
export interface IHierarchyService {
  createNode(dto: CreateNodeDTO, userId: number): Promise<NodeWithParent>;
  getNodeById(nodeId: string, userId: number): Promise<NodeWithParent | null>;
  updateNode(
    nodeId: string,
    dto: UpdateNodeDTO,
    userId: number
  ): Promise<NodeWithParent | null>;
  deleteNode(nodeId: string, userId: number): Promise<boolean>;
  getAllNodes(userId: number, filter?: NodeFilter): Promise<NodeWithParent[]>;
  getAllNodesWithPermissions(
    userId: number,
    filter?: NodeFilter
  ): Promise<NodeWithParentAndPermissions[]>;

  // Insight management methods
  getNodeInsights(nodeId: string, userId: number): Promise<NodeInsight[]>;
  createInsight(
    nodeId: string,
    dto: InsightCreateDTO,
    userId: number
  ): Promise<NodeInsight>;
  updateInsight(
    insightId: string,
    dto: InsightUpdateDTO,
    userId: number
  ): Promise<NodeInsight | null>;
  deleteInsight(insightId: string, userId: number): Promise<boolean>;
}

/**
 * Interface for UserService to enable proper mocking in tests
 */
export interface IUserService {
  getUserById(id: number): Promise<User | null>;
  getUserByIdWithExperience(
    id: number
  ): Promise<(User & { experienceLine?: string }) | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  createUser(userData: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | null>;
  updateUserInterest(userId: number, interest: string): Promise<User>;
  completeOnboarding(id: number): Promise<User>;
  deleteUser(id: number): Promise<boolean>;
  searchUsers(query: string): Promise<User[]>;
  validatePassword(password: string, hashedPassword: string): Promise<boolean>;
}

/**
 * Interface for NodePermissionService to enable proper mocking in tests
 */
export interface INodePermissionService {
  setNodePermissions(
    nodeId: string,
    permissions: unknown,
    userId: number
  ): Promise<unknown>;
  getNodePermissions(nodeId: string, userId: number): Promise<unknown>;
  deleteNodePolicy(
    nodeId: string,
    policyId: string,
    userId: number
  ): Promise<boolean>;
  getNodePolicies(nodeId: string, userId: number): Promise<unknown>;
  deletePolicy(policyId: string, userId: number): Promise<void>;
  updatePolicy(
    policyId: string,
    updates: unknown,
    userId: number
  ): Promise<unknown>;
  canAccess(
    nodeId: string,
    userId: number,
    requiredPermission?: string
  ): Promise<boolean>;
  isNodeOwner(nodeId: string, userId: number): Promise<boolean>;
}

/**
 * Interface for Database to enable proper mocking in tests
 */
export interface IDatabase {
  raw(query: string, bindings?: unknown[]): Promise<unknown>;
  select(columns?: string[]): unknown;
  from(tableName: string): unknown;
  where(column: string, value: unknown): unknown;
}

// Legacy note: Some service interfaces were removed during cleanup
// - IProfileService removed - replaced with UserOnboardingController and HierarchyService
// - All AI-related interfaces removed - unused legacy code
