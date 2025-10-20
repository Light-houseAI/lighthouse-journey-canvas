import { SimilarityWeights, TrajectoryMatcherConfig } from './types';

/**
 * Default configuration for trajectory matching
 * Based on research and GPT-5 recommendations
 */
export const DEFAULT_CONFIG: TrajectoryMatcherConfig = {
  // Gap penalties for alignment algorithm
  gapOpenPenalty: -3.0,
  gapExtendPenalty: -1.0,

  // Candidate pool limits
  maxCandidates: 200,

  // Time window for career history (100 = effectively unlimited)
  timeWindowYears: 100,

  // Cache configuration
  cacheSize: 1000,

  // Recency weighting
  enableRecencyWeighting: true,
  recencyDecayLambda: 0.15, // Exponential decay parameter
};

/**
 * Weights for different aspects of similarity scoring
 * Validated by GPT-5 and LinkedIn research
 */
export const SIMILARITY_WEIGHTS: SimilarityWeights = {
  role: 3.0, // Most important factor
  level: 1.2,
  company: 0.8,
  duration: 0.5,
  typeWeights: {
    job: 1.0,
    'career-transition': 0.9, // High weight - shows career goals
    education: 0.3,
  },
};

/**
 * Entry-level adjusted weights
 * Weight education higher for candidates with limited work experience
 */
export const ENTRY_LEVEL_WEIGHTS: SimilarityWeights = {
  ...SIMILARITY_WEIGHTS,
  typeWeights: {
    job: 1.0,
    'career-transition': 0.9,
    education: 0.6, // Doubled from default
  },
};

/**
 * Maximum possible similarity score per step
 * Used for normalization: role + level + company + duration
 */
export const MAX_SIMILARITY_SCORE = 5.5;

/**
 * Minimum number of career steps required for meaningful matching
 */
export const MIN_CAREER_STEPS = 2;

/**
 * Feature flag key
 */
export const FEATURE_FLAG_KEY = 'ENABLE_TRAJECTORY_MATCHING';
