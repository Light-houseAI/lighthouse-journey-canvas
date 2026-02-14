/**
 * Peer Preferences Routes
 * API endpoints for peer insights preferences (receive/share toggles)
 *
 * Endpoints:
 * - GET    /api/v2/peer-preferences                    - Get current preferences
 * - PATCH  /api/v2/peer-preferences                    - Update preferences
 * - PATCH  /api/v2/peer-preferences/session/:sessionId - Toggle per-session sharing
 * - PATCH  /api/v2/peer-preferences/track/:nodeId      - Toggle sharing for all sessions in track
 */

import { Router } from 'express';
import {
  peerPreferencesUpdateSchema,
  sessionSharingToggleSchema,
  trackSharingToggleSchema,
} from '@journey/schema';

import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';
import type { PeerPreferencesService } from '../services/peer-preferences.service.js';

const router = Router();

router.use(requireAuth);

/**
 * @route GET /api/v2/peer-preferences
 * @summary Get current user's peer preferences
 */
router.get('/', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const service: PeerPreferencesService = req.scope.resolve(
      CONTAINER_TOKENS.PEER_PREFERENCES_SERVICE
    );
    const prefs = await service.getPreferences(req.user.id);
    res.json(prefs);
  } catch (error) {
    next(error);
  }
});

/**
 * @route PATCH /api/v2/peer-preferences
 * @summary Update peer preferences (receive/share toggles and scope)
 */
router.patch('/', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const parsed = peerPreferencesUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }
    const service: PeerPreferencesService = req.scope.resolve(
      CONTAINER_TOKENS.PEER_PREFERENCES_SERVICE
    );
    const updated = await service.updatePreferences(req.user.id, parsed.data);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * @route PATCH /api/v2/peer-preferences/session/:sessionId
 * @summary Toggle peer sharing for a single session
 */
router.patch(
  '/session/:sessionId',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const parsed = sessionSharingToggleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
      }
      const service: PeerPreferencesService = req.scope.resolve(
        CONTAINER_TOKENS.PEER_PREFERENCES_SERVICE
      );
      await service.toggleSessionSharing(
        req.params.sessionId,
        req.user.id,
        parsed.data.enabled
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PATCH /api/v2/peer-preferences/track/:nodeId
 * @summary Toggle peer sharing for all sessions in a track
 */
router.patch(
  '/track/:nodeId',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const parsed = trackSharingToggleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
      }
      const service: PeerPreferencesService = req.scope.resolve(
        CONTAINER_TOKENS.PEER_PREFERENCES_SERVICE
      );
      await service.toggleTrackSharing(
        req.params.nodeId,
        req.user.id,
        parsed.data.enabled
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
