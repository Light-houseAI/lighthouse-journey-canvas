import { LLMRequest, IPCResponse, UserProfile, LLMResponse } from '../shared/types';

declare global {
  interface Window {
    api: {
      loadProfiles: () => Promise<IPCResponse<UserProfile[]>>;
      getProfile: (profileId: string) => Promise<IPCResponse<UserProfile>>;
      getLLMSuggestion: (request: LLMRequest) => Promise<IPCResponse<LLMResponse>>;
    };
    electron: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (...args: any[]) => void) => any;
      removeListener: (channel: string, callback: any) => void;
    };
  }
}
