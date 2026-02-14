import type { PeerPreferencesUpdate } from '@journey/schema';
import { httpClient } from './http-client';

const BASE_URL = '/api/v2/peer-preferences';

export interface PeerPreferences {
  id: string;
  userId: number;
  receivePeerInsights: boolean;
  sharePeerInsights: boolean;
  shareScopeDefault: 'all' | 'per_session';
  createdAt: string;
  updatedAt: string;
}

export function getPeerPreferences(): Promise<PeerPreferences> {
  return httpClient.get<PeerPreferences>(BASE_URL);
}

export function updatePeerPreferences(
  data: PeerPreferencesUpdate
): Promise<PeerPreferences> {
  return httpClient.patch<PeerPreferences>(BASE_URL, data);
}

export function toggleSessionSharing(
  sessionId: string,
  enabled: boolean
): Promise<void> {
  return httpClient.patch(`${BASE_URL}/session/${sessionId}`, { enabled });
}

export function toggleTrackSharing(
  nodeId: string,
  enabled: boolean
): Promise<void> {
  return httpClient.patch(`${BASE_URL}/track/${nodeId}`, { enabled });
}
