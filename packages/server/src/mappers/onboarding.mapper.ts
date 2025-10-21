/**
 * Mappers for User Onboarding API
 * Transform between service layer and controller DTOs
 */

import type {
  OnboardingCompletionResponse,
  ProfileDataResponse,
  UserUpdateResponse,
} from '@journey/schema';

import { MappedResponse } from '../middleware/response-validation.middleware';

export class OnboardingMapper {
  /**
   * Map updated user to response
   * Returns MappedResponse for fluent validation: .withSchema(userUpdateResponseSchema)
   */
  static toUserUpdateResponse(user: any): MappedResponse<UserUpdateResponse> {
    return new MappedResponse({ user });
  }

  /**
   * Map profile data to response
   * Returns MappedResponse for fluent validation: .withSchema(profileDataResponseSchema)
   */
  static toProfileResponse(
    profileData: any
  ): MappedResponse<ProfileDataResponse> {
    return new MappedResponse({ profile: profileData });
  }

  /**
   * Map onboarding completion response
   * Returns MappedResponse for fluent validation: .withSchema(onboardingCompletionResponseSchema)
   */
  static toCompletionResponse(
    responseData: any
  ): MappedResponse<OnboardingCompletionResponse> {
    return new MappedResponse(responseData);
  }
}
