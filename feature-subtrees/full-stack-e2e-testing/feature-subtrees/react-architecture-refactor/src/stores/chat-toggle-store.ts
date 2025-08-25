import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatToggleState {
  chatEnabled: boolean;
  setChatEnabled: (enabled: boolean) => void;
}

/**
 * Store for managing chat toggle state
 * Persists user preference for chat vs manual mode
 */
export const useChatToggleStore = create<ChatToggleState>()(
  persist(
    (set) => ({
      chatEnabled: false, // Default to manual mode
      setChatEnabled: (enabled: boolean) => set({ chatEnabled: enabled }),
    }),
    {
      name: 'chat-toggle-storage', // localStorage key
      version: 1,
    }
  )
);

export default useChatToggleStore;