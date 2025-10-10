/**
 * Mappers for User API
 * Transform between service layer and controller DTOs
 */

import type { UserDto, UserListDto } from '../responses/user.dto';

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
      createdAt: user.createdAt?.toISOString ? user.createdAt.toISOString() : user.createdAt,
      updatedAt: user.updatedAt?.toISOString ? user.updatedAt.toISOString() : user.updatedAt,
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
}
