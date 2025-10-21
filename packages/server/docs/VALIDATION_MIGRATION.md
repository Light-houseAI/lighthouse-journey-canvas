# API Validation Migration Guide (LIG-208)

## Overview

This guide explains how to migrate controllers to use the new Zod-validated API type system from `@journey/schema/API`.

## Benefits

- **Type Safety**: Compile-time checking of request/response types
- **Runtime Validation**: Automatic validation with clear error messages
- **Zero Breaking Changes**: Opt-in migration, existing endpoints unchanged
- **Production Ready**: Validation warnings in production, errors in development

## Quick Reference

### Before (Old Pattern)

```typescript
// Auth controller - old pattern
const response: ApiSuccessResponse<AuthResponseDto> = {
  success: true,
  data: AuthMapper.toAuthResponseDto(accessToken, refreshToken, user),
};
res.status(HttpStatus.OK).json(response);
```

### After (New Pattern)

```typescript
import { authResponseSchema } from '@journey/schema';

// Auth controller - new pattern with fluent validation
const response = AuthMapper.toAuthResponseDto(
  accessToken,
  refreshToken,
  user
).withSchema(authResponseSchema);

res.status(HttpStatus.CREATED).json(response);
```

## Step-by-Step Migration

### 1. Import New Helpers and Schemas

```typescript
// Add to controller imports
import { sendSuccess, sendCreated } from '../core';
import { API } from '@journey/schema';
```

### 2. Replace Manual JSON Responses

#### For 200 OK Responses

**Before**:

```typescript
const response: ApiSuccessResponse<UserProfileDto> = {
  success: true,
  data: user,
};
res.status(HttpStatus.OK).json(response);
```

**After**:

```typescript
sendSuccess(res, API.userProfileSchema, user);
```

#### For 201 Created Responses

**Before**:

```typescript
const response: ApiSuccessResponse<AuthResponseDto> = {
  success: true,
  data: authResponse,
};
res.status(HttpStatus.CREATED).json(response);
```

**After**:

```typescript
sendCreated(res, API.authResponseSchema, authResponse);
```

### 3. Available Schemas

From `@journey/schema/API`:

**Auth**:

- `signUpRequestSchema`, `signInRequestSchema`, `profileUpdateRequestSchema`
- `userProfileSchema`, `tokenPairSchema`, `authResponseSchema`

**Updates**:

- `apiCreateUpdateRequestSchema`, `apiUpdateUpdateRequestSchema`
- `apiUpdateResponseSchema`, `paginatedUpdatesSchema`

**Timeline Nodes**:

- `createTimelineNodeRequestSchema`, `updateTimelineNodeRequestSchema`
- `timelineNodeResponseSchema`, `hierarchyResponseSchema`

**Users**:

- `userSearchRequestSchema`, `userUpdateRequestSchema`
- `userResponseSchema`, `userSearchResponseSchema`

**Common**:

- `apiSuccessResponseSchema(dataSchema)`, `apiErrorResponseSchema`, `paginationSchema`

### 4. Validation Behavior

**Development/Test**: Throws error if validation fails

```typescript
// In development, this will throw if data doesn't match schema
sendSuccess(res, API.userProfileSchema, userData);
```

**Production**: Logs warning but continues

```typescript
// In production, logs warning but still sends response
// Prevents outages from schema mismatches
sendSuccess(res, API.userProfileSchema, userData);
```

## Migration Examples

### Example 1: Auth Signup Endpoint

**Before**:

```typescript
async signup(req: Request, res: Response): Promise<void> {
  const signUpData = signUpSchema.parse(req.body);
  const user = await this.userService.createUser(signUpData);
  const tokenPair = this.jwtService.generateTokenPair(user);

  const responseData = AuthMapper.toAuthResponseDto(
    tokenPair.accessToken,
    tokenPair.refreshToken,
    user
  );

  const response: ApiSuccessResponse<AuthResponseDto> = {
    success: true,
    data: responseData,
  };
  res.status(HttpStatus.CREATED).json(response);
}
```

**After**:

```typescript
async signup(req: Request, res: Response): Promise<void> {
  const signUpData = signUpSchema.parse(req.body);
  const user = await this.userService.createUser(signUpData);
  const tokenPair = this.jwtService.generateTokenPair(user);

  const responseData = AuthMapper.toAuthResponseDto(
    tokenPair.accessToken,
    tokenPair.refreshToken,
    user
  );

  sendCreated(res, API.authResponseSchema, responseData);
}
```

### Example 2: Get User Profile

**Before**:

```typescript
async getCurrentUser(req: Request, res: Response): Promise<void> {
  const user = this.getAuthenticatedUser(req);
  const profileDto = AuthMapper.toUserProfileDto(user);

  const response: ApiSuccessResponse<UserProfileDto> = {
    success: true,
    data: profileDto,
  };
  res.status(HttpStatus.OK).json(response);
}
```

**After**:

```typescript
async getCurrentUser(req: Request, res: Response): Promise<void> {
  const user = this.getAuthenticatedUser(req);
  const profileDto = AuthMapper.toUserProfileDto(user);

  sendSuccess(res, API.userProfileSchema, profileDto);
}
```

### Example 3: Paginated List

**Before**:

```typescript
async listUpdates(req: Request, res: Response): Promise<void> {
  const { updates, pagination } = await this.updateService.listUpdates(nodeId);

  const response: ApiSuccessResponse<PaginatedUpdatesDto> = {
    success: true,
    data: { updates, pagination },
  };
  res.status(HttpStatus.OK).json(response);
}
```

**After**:

```typescript
async listUpdates(req: Request, res: Response): Promise<void> {
  const { updates, pagination } = await this.updateService.listUpdates(nodeId);

  sendSuccess(res, API.paginatedUpdatesSchema, { updates, pagination });
}
```

## Validation Error Handling

Validation errors are automatically handled:

```typescript
// If data doesn't match schema, helper will throw with formatted errors
try {
  sendSuccess(res, API.userProfileSchema, invalidData);
} catch (error) {
  // Error message: "Response validation failed: email: Invalid email, id: Expected number, received string"
}
```

## Testing

Update controller tests to expect validated responses:

```typescript
it('should return validated user profile', async () => {
  const response = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    success: true,
    data: {
      id: expect.any(Number),
      email: expect.stringMatching(/@/),
      fullName: expect.any(String),
      // ... other fields from schema
    },
  });
});
```

## Migration Checklist

For each endpoint:

- [ ] Import `sendSuccess`/`sendCreated` from `../core`
- [ ] Import `API` from `@journey/schema`
- [ ] Identify the appropriate response schema
- [ ] Replace manual `res.status().json()` with helper
- [ ] Run tests to verify validation works
- [ ] Update integration tests if needed

## Next Steps

After migrating endpoints:

1. **Deprecate Old DTOs**: Mark server DTOs with `@deprecated` (T021)
2. **Update README**: Document new patterns (T022)
3. **Monitor Validation**: Check logs for validation warnings (T035)

## Questions?

See `specs/LIG-208/spec.md` for full specification and design decisions.
