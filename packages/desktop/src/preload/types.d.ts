import { LLMRequest, IPCResponse, UserProfile, LLMResponse } from '../shared/types';

declare global {
  interface Window {
    api: {
      loadProfiles: () => Promise<IPCResponse<UserProfile[]>>;
      getProfile: (profileId: string) => Promise<IPCResponse<UserProfile>>;
      getLLMSuggestion: (request: LLMRequest) => Promise<IPCResponse<LLMResponse>>;
    };
  }
}
