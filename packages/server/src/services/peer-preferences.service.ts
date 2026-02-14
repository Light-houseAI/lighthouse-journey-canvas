import type { Logger } from '../core/logger.js';
import type { UserPreferencesRepository, UserPreferencesData } from '../repositories/user-preferences.repository.js';
import type { SessionMappingRepository } from '../repositories/session-mapping.repository.js';

export interface PeerPreferencesServiceDeps {
  userPreferencesRepository: UserPreferencesRepository;
  sessionMappingRepository: SessionMappingRepository;
  logger: Logger;
}

export class PeerPreferencesService {
  private readonly prefsRepo: UserPreferencesRepository;
  private readonly sessionRepo: SessionMappingRepository;
  private readonly logger: Logger;

  constructor(deps: PeerPreferencesServiceDeps) {
    this.prefsRepo = deps.userPreferencesRepository;
    this.sessionRepo = deps.sessionMappingRepository;
    this.logger = deps.logger;
  }

  /**
   * Get preferences for a user, creating defaults if none exist.
   */
  async getPreferences(userId: number) {
    const existing = await this.prefsRepo.findByUserId(userId);
    if (existing) return existing;

    // Create default preferences (both OFF)
    return this.prefsRepo.upsert(userId, {
      receivePeerInsights: false,
      sharePeerInsights: false,
      shareScopeDefault: 'all',
    });
  }

  /**
   * Update receive/share toggles and scope.
   */
  async updatePreferences(userId: number, data: UserPreferencesData) {
    return this.prefsRepo.upsert(userId, data);
  }

  /**
   * Toggle peer sharing for a single session.
   */
  async toggleSessionSharing(
    sessionId: string,
    userId: number,
    enabled: boolean
  ): Promise<void> {
    await this.sessionRepo.updatePeerSharing(sessionId, userId, enabled);
  }

  /**
   * Toggle peer sharing for all sessions in a track (node).
   */
  async toggleTrackSharing(
    nodeId: string,
    userId: number,
    enabled: boolean
  ): Promise<void> {
    await this.sessionRepo.updatePeerSharingByNode(nodeId, userId, enabled);
  }
}
