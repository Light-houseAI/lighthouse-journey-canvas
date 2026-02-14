import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PeerPreferencesUpdate } from '@journey/schema';
import {
  getPeerPreferences,
  updatePeerPreferences,
  toggleSessionSharing,
  toggleTrackSharing,
  type PeerPreferences,
} from '../services/peer-preferences-api';

export const peerPreferencesKeys = {
  all: ['peer-preferences'] as const,
  current: () => [...peerPreferencesKeys.all, 'current'] as const,
};

export function usePeerPreferences() {
  return useQuery({
    queryKey: peerPreferencesKeys.current(),
    queryFn: getPeerPreferences,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useUpdatePeerPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PeerPreferencesUpdate) => updatePeerPreferences(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(peerPreferencesKeys.current(), updated);
    },
  });
}

export function useToggleSessionSharing() {
  return useMutation({
    mutationFn: ({ sessionId, enabled }: { sessionId: string; enabled: boolean }) =>
      toggleSessionSharing(sessionId, enabled),
  });
}

export function useToggleTrackSharing() {
  return useMutation({
    mutationFn: ({ nodeId, enabled }: { nodeId: string; enabled: boolean }) =>
      toggleTrackSharing(nodeId, enabled),
  });
}
