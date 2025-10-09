import type { SuccessResponse } from './common';

// Request interfaces
export interface UserSearchQuery {
    q: string;  // Search query string (min 1, max 100 characters)
}

// Response data types
export interface SanitizedUser {
    id: number;
    email: string;
    userName: string;
    firstName: string;
    lastName: string;
    experienceLine: string;
    avatarUrl: string;
}

export interface UserSearchData {
    data: SanitizedUser[];
    count: number;
}

// Response types
export type UserSearchSuccessResponse = SuccessResponse<UserSearchData>;