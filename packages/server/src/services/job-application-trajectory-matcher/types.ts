/**
 * Core types for Job Application Career Trajectory Matching (LIG-207)
 */

/**
 * A single step in a career trajectory
 */
export interface CareerStep {
  type: 'job' | 'education' | 'career-transition';

  // Job fields
  role?: string;
  normalizedRole?: string;
  level?: 'intern' | 'junior' | 'mid' | 'senior' | 'staff' | 'principal';
  track?: 'IC' | 'Manager';
  company?: string;
  normalizedCompany?: string;

  // Education fields
  degree?: string;
  field?: string;
  institution?: string;

  // Career transition fields
  description?: string;
  title?: string;

  // Common fields
  duration: number; // months
  startDate: Date;
  endDate?: Date;
}

/**
 * A complete career trajectory for a user
 */
export interface CareerTrajectory {
  userId: number;
  steps: CareerStep[]; // Ordered chronologically
  targetCompany?: string;
  targetRole?: string;
}

/**
 * Result of aligning two career sequences
 */
export interface AlignmentResult {
  score: number; // Raw alignment score
  normalizedScore: number; // Normalized to 0-100
  alignmentPath: AlignmentOperation[];
  anchoredAtTarget: boolean; // Whether alignment ends at target position
}

/**
 * A single operation in the alignment path
 */
export interface AlignmentOperation {
  type: 'match' | 'mismatch' | 'gap-user' | 'gap-candidate';
  userIndex?: number;
  candidateIndex?: number;
  score: number;
}

/**
 * Result of trajectory matching for a single candidate
 */
export interface TrajectoryMatchResult {
  userId: number;
  score: number; // 0-1
  subscores: {
    roleAlignment: number;
    levelProgression: number;
    companyMatch: number;
    recency: number;
  };
  alignmentPath: Array<[number, number]>; // Aligned step indices
  explanation: string[];
}

/**
 * Parsed components of a job title
 */
export interface NormalizedTitle {
  level:
    | 'intern'
    | 'junior'
    | 'mid'
    | 'senior'
    | 'staff'
    | 'principal'
    | 'executive';
  track: 'IC' | 'Manager';
  role: string; // Canonical role name
}

/**
 * Configuration for trajectory matching
 */
export interface TrajectoryMatcherConfig {
  gapOpenPenalty: number;
  gapExtendPenalty: number;
  maxCandidates: number;
  timeWindowYears: number;
  cacheSize: number;
  enableRecencyWeighting: boolean;
  recencyDecayLambda: number;
}

/**
 * Weights for different aspects of career step similarity
 */
export interface SimilarityWeights {
  role: number;
  level: number;
  company: number;
  duration: number;
  typeWeights: {
    job: number;
    project: number;
    education: number;
  };
}
