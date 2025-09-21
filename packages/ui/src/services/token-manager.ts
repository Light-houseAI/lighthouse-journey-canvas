/**
 * Token Manager
 *
 * Handles JWT token storage, retrieval, and validation for client-side authentication.
 * Implements secure storage with memory cache and localStorage fallback.
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: number;
  email: string;
  userName?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface RefreshTokenPayload {
  userId: number;
  tokenId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

/**
 * Token Manager for secure JWT token storage and management
 */
export class TokenManager {
  private static instance: TokenManager;

  // Memory storage for current session (primary)
  private memoryTokens: TokenPair | null = null;

  // Storage keys
  private static readonly ACCESS_TOKEN_KEY = 'lighthouse_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'lighthouse_refresh_token';

  // Private constructor for singleton pattern
  private constructor() {
    this.loadTokensFromStorage();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Store token pair securely
   */
  setTokens(tokens: TokenPair): void {
    this.memoryTokens = tokens;

    try {
      // Store in localStorage for persistence across sessions
      localStorage.setItem(TokenManager.ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(TokenManager.REFRESH_TOKEN_KEY, tokens.refreshToken);
    } catch (error) {
      console.warn('Failed to store tokens in localStorage:', error);
      // Continue with memory-only storage
    }
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    // Prefer memory storage
    if (this.memoryTokens?.accessToken) {
      return this.memoryTokens.accessToken;
    }

    // Fallback to localStorage
    try {
      return localStorage.getItem(TokenManager.ACCESS_TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to read access token from localStorage:', error);
      return null;
    }
  }

  /**
   * Get current refresh token
   */
  getRefreshToken(): string | null {
    // Prefer memory storage
    if (this.memoryTokens?.refreshToken) {
      return this.memoryTokens.refreshToken;
    }

    // Fallback to localStorage
    try {
      return localStorage.getItem(TokenManager.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to read refresh token from localStorage:', error);
      return null;
    }
  }

  /**
   * Get both tokens as a pair
   */
  getTokens(): TokenPair | null {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();

    if (accessToken && refreshToken) {
      return { accessToken, refreshToken };
    }

    return null;
  }

  /**
   * Clear all tokens (logout)
   */
  clearTokens(): void {
    this.memoryTokens = null;

    try {
      localStorage.removeItem(TokenManager.ACCESS_TOKEN_KEY);
      localStorage.removeItem(TokenManager.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to clear tokens from localStorage:', error);
    }
  }

  /**
   * Check if user is authenticated (has valid tokens)
   */
  isAuthenticated(): boolean {
    return !!(this.getAccessToken() && this.getRefreshToken());
  }

  /**
   * Decode JWT token without verification (client-side only)
   */
  decodeToken(token: string): JWTPayload | RefreshTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch (error) {
      console.warn('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Check if access token is expired (client-side check)
   * Note: This is for UX optimization only, server always validates
   */
  isAccessTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;

    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return true;

    // Check if token expires within next 30 seconds (buffer for network latency)
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now + 30;
  }

  /**
   * Check if refresh token is expired
   */
  isRefreshTokenExpired(): boolean {
    const token = this.getRefreshToken();
    if (!token) return true;

    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
  }

  /**
   * Load tokens from localStorage on initialization
   */
  private loadTokensFromStorage(): void {
    try {
      // Skip localStorage operations in test environment
      if (
        typeof window === 'undefined' ||
        typeof localStorage === 'undefined'
      ) {
        return;
      }

      const accessToken = localStorage.getItem(TokenManager.ACCESS_TOKEN_KEY);
      const refreshToken = localStorage.getItem(TokenManager.REFRESH_TOKEN_KEY);

      if (accessToken && refreshToken) {
        this.memoryTokens = { accessToken, refreshToken };
      }
    } catch (error) {
      console.warn('Failed to load tokens from localStorage:', error);
    }
  }

  /**
   * Get user ID from current access token
   */
  getUserId(): number | null {
    const token = this.getAccessToken();
    if (!token) return null;

    const payload = this.decodeToken(token) as JWTPayload;
    return payload?.userId || null;
  }

  /**
   * Get user email from current access token
   */
  getUserEmail(): string | null {
    const token = this.getAccessToken();
    if (!token) return null;

    const payload = this.decodeToken(token) as JWTPayload;
    return payload?.email || null;
  }
}

// Export singleton instance for convenience (lazy initialization)
export const tokenManager = TokenManager.getInstance();
