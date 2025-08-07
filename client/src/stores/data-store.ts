import { createWithEqualityFn } from 'zustand/traditional';
import type { Education } from '@shared/schema';

// Core data interfaces
export interface WorkExperienceData {
  id: string;
  title: string;
  company: string;
  start: string;
  end: string;
  description: string;
  location?: string;
  projects?: ProjectData[];
}

// Using Education type from shared schema instead of local interface
export type EducationData = Education;

export interface ProjectData {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  technologies?: string[];
  experienceId: string;
}

export interface ProfileData {
  experiences?: WorkExperienceData[];
  education?: EducationData[];
  events?: any[];
  actions?: any[];
  filteredData?: {
    experiences?: any[];
    education?: any[];
    events?: any[];
    actions?: any[];
  };
  [key: string]: any;
}

/**
 * Component-centric Data Store
 * Single responsibility: Profile data management
 * No UI state, no React Flow concerns - pure data
 */
export interface DataStore {
  // State
  profileData: ProfileData | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setProfileData: (data: ProfileData) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadProfileData: () => Promise<void>;
  refreshProfileData: () => Promise<void>;
  clearProfileData: () => void;
}

/**
 * Utility function for API calls with exponential backoff retry
 */
const fetchWithRetry = async (url: string, maxRetries = 3, onRetry?: (attempt: number, error: Error) => void): Promise<Response> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      
      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break;
      }
      
      // Notify about retry attempt
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

/**
 * Clean data store following Zustand best practices
 * Handles only profile data - no UI concerns
 */
export const useDataStore = createWithEqualityFn<DataStore>((set, get) => ({
  // State
  profileData: null,
  isLoading: false,
  error: null,
  
  // Actions
  setProfileData: (data: ProfileData) => {
    set({ profileData: data, error: null });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ error, isLoading: false });
  },

  loadProfileData: async () => {
    const { profileData } = get();
    
    // Don't reload if we already have data
    if (profileData) return;
    
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetchWithRetry('/api/profile', 3, (attempt, error) => {
        console.warn(`Profile API retry attempt ${attempt}/3:`, error.message);
      });
      const data = await response.json();
      set({ 
        profileData: data, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      console.error('Failed to load profile data:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load profile data',
        isLoading: false 
      });
    }
  },

  refreshProfileData: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetchWithRetry('/api/profile', 3, (attempt, error) => {
        console.warn(`Profile API refresh retry attempt ${attempt}/3:`, error.message);
      });
      const data = await response.json();
      set({ 
        profileData: data, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      console.error('Failed to refresh profile data:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to refresh profile data',
        isLoading: false 
      });
    }
  },

  clearProfileData: () => {
    set({ 
      profileData: null, 
      isLoading: false, 
      error: null
    });
  },
}));