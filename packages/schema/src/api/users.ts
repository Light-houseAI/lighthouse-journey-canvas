import type { SuccessResponse } from './common';
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
export type UserSearchSuccessResponse = SuccessResponse<UserSearchData>;
//# sourceMappingURL=users.d.ts.map