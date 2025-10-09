// ============================================================================
// SHARED USER DATA INTERFACE
// ============================================================================

export interface UserData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  userName: string;
  interest: string | null;
  hasCompletedOnboarding: boolean;
  createdAt?: string; // ISO string
}

// ============================================================================
// SIGNUP ENDPOINT
// ============================================================================

export interface SignUpSuccessResponse {
  success: true;
  data: {
    accessToken: string;
    refreshToken: string;
    user: UserData;
  };
}

// ============================================================================
// SIGNIN ENDPOINT
// ============================================================================

export interface SignInSuccessResponse {
  success: true;
  data: {
    accessToken: string;
    refreshToken: string;
    user: UserData;
  };
}

// ============================================================================
// REFRESH TOKEN ENDPOINT
// ============================================================================

export interface RefreshTokenSuccessResponse {
  success: true;
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

// ============================================================================
// LOGOUT ENDPOINT
// ============================================================================

export interface LogoutSuccessResponse {
  success: true;
  data: {
    message: string;
  };
}

// ============================================================================
// REVOKE ALL TOKENS ENDPOINT
// ============================================================================

export interface RevokeAllTokensSuccessResponse {
  success: true;
  data: {
    message: string;
    revokedCount: number;
  };
}

// ============================================================================
// UPDATE PROFILE ENDPOINT
// ============================================================================

export interface UpdateProfileSuccessResponse {
  success: true;
  data: {
    user: Omit<UserData, 'createdAt'>; // Update profile doesn't return createdAt
  };
}

// ============================================================================
// DEBUG TOKENS ENDPOINT (development only)
// ============================================================================

export interface DebugTokensSuccessResponse {
  success: true;
  data: {
    userTokens: Array<{
      tokenId: string;
      createdAt: Date;
      lastUsedAt: Date;
      expiresAt: Date;
      ipAddress: string | null;
      userAgent: string;
    }>;
    stats: any;
  };
}
