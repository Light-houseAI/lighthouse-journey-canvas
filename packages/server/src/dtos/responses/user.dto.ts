/**
 * Response DTOs for User API
 */

/**
 * User profile response (same as auth profile, re-exported for clarity)
 */
export interface UserDto {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  userName: string | null;
  interest: string | null;
  hasCompletedOnboarding: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * User list response
 */
export interface UserListDto {
  users: UserDto[];
  total: number;
}
