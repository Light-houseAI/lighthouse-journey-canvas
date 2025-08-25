/**
 * User API Service
 * 
 * Handles communication with user endpoints
 */

// API response wrapper
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
  details?: any;
}

// User search result type
export interface UserSearchResult {
  id: number;
  email: string;
  userName: string;
}

// HTTP client with error handling
async function httpClient<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/v2/users${path}`;
  
  // Get test user ID from localStorage
  const testUserId = localStorage.getItem('test-user-id');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };
  
  // Only add X-User-Id header if set in localStorage
  if (testUserId) {
    headers['X-User-Id'] = testUserId;
  }
  
  const config: RequestInit = {
    headers,
    ...init,
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Search for users by username or email
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const response = await httpClient<ApiResponse<UserSearchResult[]>>(`/search?q=${encodeURIComponent(query.trim())}`);
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to search users');
  }

  return response.data || [];
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<UserSearchResult | null> {
  try {
    const response = await httpClient<ApiResponse<UserSearchResult>>(`/${userId}`);
    
    if (!response.success) {
      return null;
    }

    return response.data || null;
  } catch (error) {
    console.error('Failed to fetch user by ID:', error);
    return null;
  }
}

/**
 * Get multiple users by their IDs
 */
export async function getUsersByIds(userIds: number[]): Promise<UserSearchResult[]> {
  if (userIds.length === 0) {
    return [];
  }

  try {
    const userPromises = userIds.map(id => getUserById(id));
    const users = await Promise.all(userPromises);
    return users.filter((user): user is UserSearchResult => user !== null);
  } catch (error) {
    console.error('Failed to fetch users by IDs:', error);
    return [];
  }
}
