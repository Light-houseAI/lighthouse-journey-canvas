// ============================================================================
// USER SEARCH TYPES
// ============================================================================

export interface SanitizedUser {
  id: number;
  email: string;
  userName: string;
  firstName: string;
  lastName: string;
  experienceLine: string;
  avatarUrl: string;
}

// ============================================================================
// SEARCH USERS ENDPOINT
// ============================================================================

export interface UserSearchSuccessResponse {
  success: true;
  data: {
    data: SanitizedUser[];
    count: number;
  };
}
