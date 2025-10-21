/**
 * Mappers for User API
 * Transform between service layer and controller DTOs
 */

import type { UserSearchResponse } from '@journey/schema';

import { MappedResponse } from '../../middleware/response-validation.middleware';
import type {
  UserDto,
  UserListDto,
  UserSearchResultDto,
} from '../responses/user.dto';

export class UserMapper {
  /**
   * Map user to DTO
   */
  static toUserDto(user: any): UserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      interest: user.interest,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      createdAt: user.createdAt?.toISOString
        ? user.createdAt.toISOString()
        : user.createdAt,
      updatedAt: user.updatedAt?.toISOString
        ? user.updatedAt.toISOString()
        : user.updatedAt,
    };
  }

  /**
   * Map user list to DTO
   */
  static toUserListDto(users: any[]): UserListDto {
    return {
      users: users.map((u) => this.toUserDto(u)),
      total: users.length,
    };
  }

  /**
   * Map user to search result DTO
   */
  static toUserSearchResultDto(user: any): UserSearchResultDto {
    return {
      id: user.id,
      email: user.email || '',
      userName: user.userName || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      experienceLine: user.experienceLine || '',
      avatarUrl: user.avatarUrl || null,
    };
  }

  /**
   * Map user search results to DTO
   * Returns MappedResponse for fluent validation: .withSchema(userSearchResponseSchema)
   */
  static toUserSearchResponseDto(
    users: any[]
  ): MappedResponse<UserSearchResponse> {
    return new MappedResponse<UserSearchResponse>({
      users: users.map((u) => this.toUserSearchResultDto(u)),
      count: users.length,
    });
  }
}
