import type { ProfileData } from '../types';
import type { SuccessResponse } from './common';
export interface UpdateInterestDTO {
    interest: string;
}
export interface ExtractProfileDTO {
    username: string;
}
export interface SaveProfileDTO {
    username: string;
    filteredData: ProfileData;
}
export interface UserData {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    userName: string;
    interest: string | null;
    hasCompletedOnboarding: boolean;
    createdAt: string;
}
export interface ProfileExtractData {
    profile: ProfileData;
}
export interface SaveProfileData {
    profile: {
        id: string;
        username: string;
        nodesCreated: number;
        nodes: any[];
    };
}
export type UpdateInterestSuccessResponse = SuccessResponse<{
    user: UserData;
}>;
export type ExtractProfileSuccessResponse = SuccessResponse<ProfileExtractData>;
export type SaveProfileSuccessResponse = SuccessResponse<SaveProfileData>;
export type CompleteOnboardingSuccessResponse = SuccessResponse<{
    user: UserData;
}>;
//# sourceMappingURL=onboarding.d.ts.map