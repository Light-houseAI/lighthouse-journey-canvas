// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { LLMRequest, IPCResponse, UserProfile, LLMResponse } from './shared/types';

export interface SampleDocument {
  id: string
  name: string
  description: string
  filePath: string
  intent: 'resume_writing' | 'requirements_documentation'
}

contextBridge.exposeInMainWorld('api', {
  loadProfiles: (): Promise<IPCResponse<UserProfile[]>> =>
    ipcRenderer.invoke('load-profiles'),

  getProfile: (profileId: string): Promise<IPCResponse<UserProfile>> =>
    ipcRenderer.invoke('get-profile', profileId),

  getLLMSuggestion: (request: LLMRequest): Promise<IPCResponse<LLMResponse>> =>
    ipcRenderer.invoke('llm-suggest', request),

  getSampleDocuments: (): Promise<IPCResponse<SampleDocument[]>> =>
    ipcRenderer.invoke('get-sample-documents'),

  loadSampleDocument: (documentId: string): Promise<IPCResponse<string>> =>
    ipcRenderer.invoke('load-sample-document', documentId),
});

// General electron IPC interface for dynamic handlers
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return subscription;
  },
  removeListener: (channel: string, callback: any) => {
    ipcRenderer.removeListener(channel, callback);
  }
});
