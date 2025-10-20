import { DEFAULT_CONFIG, MAX_SIMILARITY_SCORE } from './config';
import { TrajectoryScorer } from './trajectory-scorer';
import { AlignmentOperation, AlignmentResult, CareerStep } from './types';

/**
 * Anchored Smith-Waterman alignment engine for career trajectories
 *
 * This implementation uses dynamic programming to find optimal alignment
 * between two career sequences, with the constraint that alignment must
 * end at the target position (anchored alignment).
 */
export class AnchoredAlignmentEngine {
  private readonly gapOpenPenalty: number;
  private readonly gapExtendPenalty: number;
  private readonly scorer: TrajectoryScorer;

  constructor(
    gapOpenPenalty: number = DEFAULT_CONFIG.gapOpenPenalty,
    gapExtendPenalty: number = DEFAULT_CONFIG.gapExtendPenalty,
    scorer?: TrajectoryScorer
  ) {
    this.gapOpenPenalty = gapOpenPenalty;
    this.gapExtendPenalty = gapExtendPenalty;
    this.scorer = scorer || new TrajectoryScorer();
  }

  /**
   * Align two career sequences using anchored Smith-Waterman algorithm
   *
   * @param userSeq - The user's career sequence
   * @param candidateSeq - The candidate's career sequence
   * @returns Alignment result with score and path
   */
  align(userSeq: CareerStep[], candidateSeq: CareerStep[]): AlignmentResult {
    // Handle empty sequences
    if (userSeq.length === 0 || candidateSeq.length === 0) {
      return {
        score: 0,
        normalizedScore: 0,
        alignmentPath: [],
        anchoredAtTarget: false,
      };
    }

    const m = userSeq.length;
    const n = candidateSeq.length;

    // Initialize DP matrices
    const scoreMatrix = this.initializeMatrix(m + 1, n + 1);
    const gapMatrix = this.initializeGapMatrix(m + 1, n + 1);

    // Fill the DP matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const similarity = this.computeSimilarity(
          userSeq[i - 1],
          candidateSeq[j - 1]
        );

        // Match/mismatch score
        const matchScore = scoreMatrix[i - 1][j - 1] + similarity;

        // Gap in candidate sequence (insertion)
        const gapCandidateScore = this.computeGapScore(
          scoreMatrix[i - 1][j],
          gapMatrix[i - 1][j] === 'gap-candidate'
        );

        // Gap in user sequence (deletion)
        const gapUserScore = this.computeGapScore(
          scoreMatrix[i][j - 1],
          gapMatrix[i][j - 1] === 'gap-user'
        );

        // Take maximum score (Smith-Waterman allows local alignment)
        const maxScore = Math.max(
          0,
          matchScore,
          gapCandidateScore,
          gapUserScore
        );
        scoreMatrix[i][j] = maxScore;

        // Track which operation led to this score
        if (maxScore === 0) {
          gapMatrix[i][j] = 'none';
        } else if (maxScore === matchScore) {
          gapMatrix[i][j] = 'match';
        } else if (maxScore === gapCandidateScore) {
          gapMatrix[i][j] = 'gap-candidate';
        } else {
          gapMatrix[i][j] = 'gap-user';
        }
      }
    }

    // Extract anchored score (must end at target position)
    const anchorScore = scoreMatrix[m][n];

    // Perform traceback from anchor position
    const alignmentPath = this.traceback(
      scoreMatrix,
      gapMatrix,
      userSeq,
      candidateSeq,
      m,
      n
    );

    // Normalize score to 0-100 range
    const maxPossibleScore = Math.min(m, n) * MAX_SIMILARITY_SCORE;
    const normalizedScore = this.normalizeScore(anchorScore, maxPossibleScore);

    return {
      score: anchorScore,
      normalizedScore,
      alignmentPath,
      anchoredAtTarget: true,
    };
  }

  /**
   * Initialize a 2D matrix with zeros
   */
  private initializeMatrix(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
  }

  /**
   * Initialize gap tracking matrix
   */
  private initializeGapMatrix(rows: number, cols: number): string[][] {
    return Array.from({ length: rows }, () => Array(cols).fill('none'));
  }

  /**
   * Compute gap score with open/extend penalties
   */
  private computeGapScore(prevScore: number, isExtension: boolean): number {
    if (isExtension) {
      return prevScore + this.gapExtendPenalty;
    } else {
      return prevScore + this.gapOpenPenalty;
    }
  }

  /**
   * Compute similarity between two career steps using TrajectoryScorer
   */
  private computeSimilarity(step1: CareerStep, step2: CareerStep): number {
    return this.scorer.computeSimilarity(step1, step2);
  }

  /**
   * Traceback to reconstruct alignment path
   */
  private traceback(
    scoreMatrix: number[][],
    gapMatrix: string[][],
    userSeq: CareerStep[],
    candidateSeq: CareerStep[],
    startI: number,
    startJ: number
  ): AlignmentOperation[] {
    const path: AlignmentOperation[] = [];
    let i = startI;
    let j = startJ;

    // Traceback from anchor position
    while (i > 0 && j > 0 && scoreMatrix[i][j] > 0) {
      const operation = gapMatrix[i][j];

      if (operation === 'match') {
        const similarity = this.computeSimilarity(
          userSeq[i - 1],
          candidateSeq[j - 1]
        );
        path.unshift({
          type: similarity > 2.0 ? 'match' : 'mismatch',
          userIndex: i - 1,
          candidateIndex: j - 1,
          score: similarity,
        });
        i--;
        j--;
      } else if (operation === 'gap-candidate') {
        path.unshift({
          type: 'gap-candidate',
          userIndex: i - 1,
          score: this.gapExtendPenalty,
        });
        i--;
      } else if (operation === 'gap-user') {
        path.unshift({
          type: 'gap-user',
          candidateIndex: j - 1,
          score: this.gapExtendPenalty,
        });
        j--;
      } else {
        // Reached start of alignment
        break;
      }
    }

    return path;
  }

  /**
   * Normalize score to 0-100 range
   */
  private normalizeScore(rawScore: number, maxPossibleScore: number): number {
    if (maxPossibleScore === 0) return 0;

    // Normalize and clamp to [0, 100]
    const normalized = (rawScore / maxPossibleScore) * 100;
    return Math.max(0, Math.min(100, normalized));
  }
}
