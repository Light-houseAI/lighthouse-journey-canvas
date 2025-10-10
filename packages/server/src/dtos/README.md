# DTOs (Data Transfer Objects)

This directory contains Data Transfer Objects for API endpoints, following a layered architecture pattern.

## Architecture

```
Controller → DTO → Service → Repository → Entity
```

**DTOs provide:**
- ✅ Type safety and validation using existing Zod schemas
- ✅ Clear request/response contracts
- ✅ Separation of concerns between layers
- ✅ Transformation logic via mappers
- ✅ OpenAPI/Swagger documentation support

## Structure

```
src/dtos/
├── requests/        # Input DTOs with Zod validation
├── responses/       # Output DTOs for API responses
├── mappers/         # Transform between DTOs and entities
└── index.ts         # Central export point
```

## Pattern

### 1. Request DTOs (`requests/`)

**Use existing Zod schemas from `@journey/schema` when available:**

```typescript
// Re-export existing schema
import { signUpSchema, type SignUpInput } from '@journey/schema';

export { signUpSchema };
export type SignUpRequestDto = SignUpInput;
```

**Create new Zod schemas for endpoints without existing schemas:**

```typescript
import { z } from 'zod';

export const getMatchesParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid UUID format'),
});

export type GetMatchesParamsDto = z.infer<typeof getMatchesParamsSchema>;
```

### 2. Response DTOs (`responses/`)

**Define output shape using TypeScript interfaces:**

```typescript
export interface UserProfileDto {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  userName: string | null;
  hasCompletedOnboarding: boolean;
  createdAt: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserProfileDto;
}
```

### 3. Mappers (`mappers/`)

**Transform between service entities and DTOs - return plain objects:**

```typescript
export class AuthMapper {
  static toUserProfileDto(user: User): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      createdAt: user.createdAt.toISOString(),
    };
  }

  static toAuthResponseDto(
    accessToken: string,
    refreshToken: string,
    user: User
  ): AuthResponseDto {
    return {
      accessToken,
      refreshToken,
      user: this.toUserProfileDto(user),
    };
  }
}
```

## Controller Usage

```typescript
import {
  signUpSchema,
  AuthMapper,
} from '../dtos';

async signup(req: Request, res: Response) {
  // 1. Validate using Zod schema
  const signUpData = signUpSchema.parse(req.body);

  // 2. Call service layer
  const user = await this.userService.createUser(signUpData);
  const tokenPair = this.jwtService.generateTokenPair(user);

  // 3. Map to response DTO (returns plain object)
  const response = AuthMapper.toAuthResponseDto(
    tokenPair.accessToken,
    tokenPair.refreshToken,
    user
  );

  // 4. Return response
  this.created(res, response, req);
}
```

## Benefits

1. **Type Safety**: TypeScript types throughout the stack
2. **Validation**: Zod schemas for runtime validation
3. **Decoupling**: Controllers don't depend on database entities
4. **Transformation**: Clean separation of external/internal data shapes
5. **Documentation**: Clear API contracts for OpenAPI generation
6. **Reusability**: Mappers can be used across multiple endpoints

## Examples

- **Authentication**: `auth.dto.ts` - Shows re-using existing @journey/schema schemas
- **Experience Matches**: `experience-matches.dto.ts` - Shows creating new schemas for specific endpoints

## Guidelines

1. ✅ **DO** re-use existing Zod schemas from `@journey/schema`
2. ✅ **DO** create new Zod schemas for endpoint-specific validation
3. ✅ **DO** use TypeScript interfaces for response DTOs
4. ✅ **DO** use mappers that return plain objects
5. ✅ **DO** use mappers for complex transformations
6. ❌ **DON'T** duplicate validation logic
7. ❌ **DON'T** expose internal entity structures directly
8. ❌ **DON'T** add business logic to DTOs (keep them pure data)
9. ❌ **DON'T** use class constructors - return plain objects instead
