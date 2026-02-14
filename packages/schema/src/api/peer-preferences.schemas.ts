/**
 * Peer Preferences API Schemas
 * Request and response schemas for peer insights preferences endpoints
 */

import { z } from 'zod';

export const peerPreferencesUpdateSchema = z.object({
  receivePeerInsights: z.boolean().optional(),
  sharePeerInsights: z.boolean().optional(),
  shareScopeDefault: z.enum(['all', 'per_session']).optional(),
});

export type PeerPreferencesUpdate = z.infer<typeof peerPreferencesUpdateSchema>;

export const sessionSharingToggleSchema = z.object({
  enabled: z.boolean(),
});

export type SessionSharingToggle = z.infer<typeof sessionSharingToggleSchema>;

export const trackSharingToggleSchema = z.object({
  enabled: z.boolean(),
});

export type TrackSharingToggle = z.infer<typeof trackSharingToggleSchema>;
