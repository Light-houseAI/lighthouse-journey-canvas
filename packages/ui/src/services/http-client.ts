/**
 * HTTP Client with JWT Authentication
 *
 * Provides a fetch-based HTTP client that automatically handles:
 * - JWT token attachment
 * - Token refresh on 401 errors
 * - Request queuing during refresh
 * - Error handling and retries
 */

import { tokenManager } from './token-manager';

export interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

export interface AuthApiResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
    interest?: string;
    hasCompletedOnboarding: boolean;
    createdAt: string;
  };
}

/**
 * HTTP Client with automatic JWT token management
 */
export class HttpClient {
  private static instance: HttpClient;

  // Queue for requests waiting during token refresh
  private refreshPromise: Promise<void> | null = null;
  private requestQueue: Array<() => void> = [];

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  /**
   * Make authenticated HTTP request
   */
  async request<T>(url: string, config: RequestConfig = {}): Promise<T> {
    // Wait if token refresh is in progress
    if (this.refreshPromise) {
      await this.refreshPromise;
    }

    // Convert relative URLs to absolute URLs using appropriate base URL
    const finalUrl = url;

    const finalConfig = this.prepareRequest(finalUrl, config);
    let response = await fetch(finalUrl, finalConfig);

    // Handle 401 Unauthorized - attempt token refresh
    if (response.status === 401 && !config.skipRefresh) {
      const refreshed = await this.handleUnauthorized();

      if (refreshed) {
        // Retry request with new token
        const retryConfig = this.prepareRequest(finalUrl, config);
        response = await fetch(finalUrl, retryConfig);
      }
    }

    return this.processResponse<T>(response);
  }

  /**
   * Make GET request
   */
  async get<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  /**
   * Make POST request
   */
  async post<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Make PUT request
   */
  async put<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Make PATCH request
   */
  async patch<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Make DELETE request
   */
  async delete<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  /**
   * Prepare request with authentication headers
   */
  private prepareRequest(url: string, config: RequestConfig): RequestInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((config.headers as Record<string, string>) || {}),
    };

    // Add Authorization header if not skipping auth
    if (!config.skipAuth) {
      const accessToken = tokenManager.getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    return {
      ...config,
      headers,
    };
  }

  /**
   * Process response and return data or throw error
   * Unwraps server response format and returns just the data
   */
  private async processResponse<T>(response: Response): Promise<T> {
    let responseData: any;

    try {
      responseData = await response.json();
    } catch (error) {
      // Handle non-JSON responses
      console.warn('Non-JSON response received:', error);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return {} as T;
    }

    // Check if response indicates an error
    if (!response.ok || responseData.success === false) {
      const errorMessage =
        responseData?.error?.message ||
        responseData?.message ||
        `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    // All APIs return {success: true, data: T} format, so always unwrap data
    return responseData.data;
  }

  /**
   * Handle 401 Unauthorized by refreshing token
   */
  private async handleUnauthorized(): Promise<boolean> {
    // If already refreshing, wait for it
    if (this.refreshPromise) {
      await this.refreshPromise;
      return tokenManager.isAuthenticated();
    }

    // Check if refresh token is still valid before attempting refresh
    if (tokenManager.isRefreshTokenExpired()) {
      console.warn('Refresh token expired, cannot refresh access token');
      this.notifyAuthFailure();
      return false;
    }

    // Start refresh process
    this.refreshPromise = this.refreshToken();

    try {
      await this.refreshPromise;
      return tokenManager.isAuthenticated();
    } catch (error) {
      console.error('Token refresh failed:', error);

      // Only logout if refresh token is actually invalid/expired
      // Don't logout on transient network errors when refresh token is still valid
      if (tokenManager.isRefreshTokenExpired()) {
        this.notifyAuthFailure();
      } else {
        console.warn(
          'Token refresh failed but refresh token is still valid - not logging out'
        );
      }

      return false;
    } finally {
      this.refreshPromise = null;
      this.processRequestQueue();
    }
  }

  /**
   * Public method to proactively refresh tokens
   * Used by App.tsx to refresh tokens before they expire
   */
  async refreshTokenIfNeeded(): Promise<boolean> {
    // Check if access token is expired or will expire soon
    if (!tokenManager.isAccessTokenExpired()) {
      return true; // Token is still valid, no refresh needed
    }

    // Check if refresh token is still valid
    if (tokenManager.isRefreshTokenExpired()) {
      return false; // Refresh token expired, cannot refresh
    }

    // If already refreshing, wait for it
    if (this.refreshPromise) {
      try {
        await this.refreshPromise;
        return tokenManager.isAuthenticated();
      } catch {
        return false;
      }
    }

    // Perform refresh
    this.refreshPromise = this.refreshToken();

    try {
      await this.refreshPromise;
      return tokenManager.isAuthenticated();
    } catch (error) {
      console.error('Proactive token refresh failed:', error);
      return false;
    } finally {
      this.refreshPromise = null;
      this.processRequestQueue();
    }
  }

  /**
   * Refresh access token using refresh token
   * Includes single retry for transient failures
   */
  private async refreshToken(): Promise<void> {
    let lastError: Error | null = null;

    // Attempt refresh with one retry for transient failures
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Read refresh token on each attempt (in case it was rotated)
        const refreshToken = tokenManager.getRefreshToken();

        if (!refreshToken || tokenManager.isRefreshTokenExpired()) {
          throw new Error('No valid refresh token available');
        }

        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        // Non-retryable errors (4xx except 429)
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          throw new Error(`Token refresh failed: ${response.status}`);
        }

        // Retryable errors (5xx, 429, network issues)
        if (!response.ok) {
          throw new Error(`Token refresh failed: ${response.status}`);
        }

        const responseData = await response.json();

        if (
          !responseData.success ||
          !responseData.data?.accessToken ||
          !responseData.data?.refreshToken
        ) {
          throw new Error('Invalid refresh response format');
        }

        // Store new tokens
        tokenManager.setTokens({
          accessToken: responseData.data.accessToken,
          refreshToken: responseData.data.refreshToken,
        });

        return; // Success - exit retry loop
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors (except 429)
        if (
          lastError.message.includes('400') ||
          lastError.message.includes('401') ||
          lastError.message.includes('403') ||
          lastError.message.includes('404')
        ) {
          break; // Exit retry loop, fail immediately
        }

        // If this was first attempt and error is retryable, wait and retry
        if (attempt === 0) {
          const jitter = 200 + Math.random() * 300; // 200-500ms
          await new Promise((resolve) => setTimeout(resolve, jitter));
          continue;
        }
      }
    }

    // All attempts failed - clear tokens
    tokenManager.clearTokens();
    throw lastError || new Error('Token refresh failed');
  }

  /**
   * Process queued requests after token refresh
   */
  private processRequestQueue(): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];
    queue.forEach((resolver) => resolver());
  }

  /**
   * Notify auth store of authentication failure
   */
  private notifyAuthFailure(): void {
    // Use dynamic import to avoid circular dependency
    import('../stores/auth-store')
      .then(({ useAuthStore }) => {
        const { setUser } = useAuthStore.getState();
        setUser(null);
      })
      .catch((error) => {
        console.warn('Failed to notify auth store of auth failure:', error);
      });
  }

  /**
   * Authentication methods
   */
  async login(credentials: {
    email: string;
    password: string;
  }): Promise<AuthApiResponse> {
    const response = await this.post<AuthApiResponse>(
      '/api/auth/signin',
      credentials,
      {
        skipAuth: true,
      }
    );

    // Store tokens after successful login
    if (response.accessToken && response.refreshToken) {
      tokenManager.setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
    }

    return response;
  }

  async register(data: {
    email: string;
    password: string;
  }): Promise<AuthApiResponse> {
    const response = await this.post<AuthApiResponse>(
      '/api/auth/signup',
      data,
      {
        skipAuth: true,
      }
    );

    // Store tokens after successful registration
    if (response.accessToken && response.refreshToken) {
      tokenManager.setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
    }

    return response;
  }

  async logout(): Promise<void> {
    const refreshToken = tokenManager.getRefreshToken();

    try {
      // Send logout request with refresh token for server-side cleanup
      await this.post(
        '/api/auth/logout',
        { refreshToken },
        { skipRefresh: true }
      );
    } catch (error) {
      console.warn('Logout request failed:', error);
      // Continue with local cleanup even if server request fails
    } finally {
      // Always clear local tokens
      tokenManager.clearTokens();
    }
  }

  async getCurrentUser(): Promise<any> {
    return this.get('/api/auth/me');
  }

  async updateProfile(updates: any): Promise<any> {
    return this.patch('/api/auth/profile', updates);
  }
}

// Export singleton instance for convenience
export const httpClient = HttpClient.getInstance();
