# PRD: JWT Authentication Migration

## Executive Summary
Migrate Lighthouse application from cookie-based session authentication to JWT (JSON Web Token) based authentication to improve scalability, enable stateless authentication, and better support modern deployment architectures including containerized deployments on platforms like Render.

## Problem Statement

### Current Challenges
1. **Session Storage Dependency**: Current implementation requires PostgreSQL session storage, adding database load and complexity
2. **Scalability Limitations**: Session-based auth complicates horizontal scaling and load balancing
3. **Container Deployment Issues**: Sticky sessions required for multi-instance deployments
4. **Testing Complexity**: Current X-User-Id header testing approach mixes concerns with production auth
5. **Cross-Domain Limitations**: Cookie-based auth restricts API usage across different domains
6. **Mobile App Readiness**: Future mobile apps would need different auth mechanism

### Why Now?
- Preparing for Render deployment with potential multi-instance scaling
- Reduce database dependencies and operational complexity
- Align with modern authentication best practices
- Enable future mobile app development

## Goals & Success Metrics

### Primary Goals
1. Replace cookie-based sessions with JWT tokens
2. Maintain current user experience with no disruption
3. Improve application scalability and deployment flexibility
4. Reduce database load from session management

### Success Metrics
- **Zero downtime** during migration
- **No user logouts** required during transition
- **Response time improvement**: 10-20% faster auth checks (no DB query)
- **Database load reduction**: Eliminate ~30% of DB queries (session reads)
- **100% test coverage** for new auth system
- **Successful deployment** on Render with multi-instance support

## User Stories & Requirements

### User Stories

#### As a User
- I want to stay logged in for 30 days without re-authenticating
- I want secure authentication that protects my data
- I want seamless experience across browser refreshes
- I want to be able to logout from all devices (future enhancement)

#### As a Developer
- I want simple, consistent auth patterns across the codebase
- I want clear testing strategies without production auth bypass
- I want comprehensive error handling and debugging capabilities
- I want automatic token refresh without manual intervention

#### As a DevOps Engineer
- I want stateless authentication for easy horizontal scaling
- I want reduced database dependencies
- I want simplified deployment without session persistence concerns
- I want clear monitoring and security audit capabilities

### Functional Requirements

#### Authentication Flow
1. **Login/Register**: Return access and refresh tokens
2. **Token Storage**: Secure client-side token management
3. **Auto-Refresh**: Seamless token renewal before expiry
4. **Logout**: Proper token cleanup and optional blacklisting

#### Token Specifications
1. **Access Token**
   - JWT format with user claims
   - 15-minute expiry
   - Contains: userId, email, userName
   - Signed with RS256 or HS256

2. **Refresh Token**
   - Opaque token or JWT
   - 30-day expiry
   - Stored in httpOnly cookie or secure storage
   - Rotation on use for security

#### API Requirements
1. All authenticated endpoints accept Bearer token
2. Proper 401/403 error responses
3. Token refresh endpoint
4. No more session cookies
5. CORS headers properly configured

### Non-Functional Requirements

#### Security
- Tokens signed with strong secret/keys
- Refresh tokens properly rotated
- XSS protection for token storage
- CSRF protection maintained
- Rate limiting on auth endpoints

#### Performance
- Token validation < 5ms
- No database query for access token validation
- Efficient token refresh mechanism
- Minimal impact on request payload size

#### Compatibility
- Backward compatibility during migration
- Support for existing test infrastructure
- Gradual rollout capability

## Technical Specifications

### Architecture Design

#### Server-Side Components

```typescript
// JWT Service Interface
interface JWTService {
  generateAccessToken(user: User): string;
  generateRefreshToken(user: User): string;
  verifyAccessToken(token: string): JWTPayload;
  verifyRefreshToken(token: string): RefreshTokenPayload;
  revokeRefreshToken(token: string): Promise<void>;
}

// Token Payload Structures
interface JWTPayload {
  userId: number;
  email: string;
  userName?: string;
  iat: number;
  exp: number;
}

interface RefreshTokenPayload {
  userId: number;
  tokenId: string;
  iat: number;
  exp: number;
}
```

#### Client-Side Components

```typescript
// Token Manager
class TokenManager {
  private accessToken: string | null;
  private refreshToken: string | null;
  
  setTokens(access: string, refresh: string): void;
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  clearTokens(): void;
  isTokenExpired(token: string): boolean;
  scheduleRefresh(): void;
}

// API Client with Interceptors
class APIClient {
  private tokenManager: TokenManager;
  
  constructor(tokenManager: TokenManager);
  
  // Automatically adds Authorization header
  // Handles token refresh on 401
  request(config: RequestConfig): Promise<Response>;
}
```

### Database Schema Changes

```sql
-- Remove session table (after migration)
DROP TABLE IF EXISTS session;

-- Add refresh tokens table (optional, for blacklisting)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

### API Endpoints

#### Modified Endpoints
- `POST /api/signin` - Returns `{ accessToken, refreshToken, user }`
- `POST /api/signup` - Returns `{ accessToken, refreshToken, user }`
- `POST /api/logout` - Accepts refresh token for revocation

#### New Endpoints
- `POST /api/auth/refresh` - Exchanges refresh token for new token pair
- `POST /api/auth/revoke-all` - Revokes all user's refresh tokens

### Environment Variables

```env
# JWT Configuration
JWT_ACCESS_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<different-strong-secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# Optional: Use RSA keys instead
JWT_PRIVATE_KEY_PATH=/path/to/private.key
JWT_PUBLIC_KEY_PATH=/path/to/public.key
```

## Implementation Plan

### Phase 1: Server-Side JWT Infrastructure (Week 1)

#### Todos:
- [ ] Install JWT dependencies (jsonwebtoken, @types/jsonwebtoken)
- [ ] Create JWT service with token generation/verification
- [ ] Implement refresh token storage (Redis or PostgreSQL)
- [ ] Create new auth middleware for JWT validation
- [ ] Add /auth/refresh endpoint
- [ ] Update /signin and /signup to return tokens
- [ ] Add comprehensive unit tests for JWT service
- [ ] Add integration tests for auth flow

### Phase 2: Client-Side Token Management (Week 1-2)

#### Todos:
- [ ] Create TokenManager class for token storage
- [ ] Implement secure storage strategy (memory + localStorage)
- [ ] Create API client with axios interceptors
- [ ] Add automatic token refresh logic
- [ ] Update auth store to handle tokens
- [ ] Remove cookie-based persistence
- [ ] Update all API calls to use new client
- [ ] Add client-side tests

### Phase 3: Migration & Compatibility (Week 2)

#### Todos:
- [ ] Add feature flag for JWT vs session auth
- [ ] Create migration script for existing sessions
- [ ] Update all authenticated routes
- [ ] Remove `credentials: 'include'` from all requests
- [ ] Update development environment setup
- [ ] Remove X-User-Id header testing approach
- [ ] Create new testing utilities for JWT

### Phase 4: Testing & Validation (Week 2-3)

#### Todos:
- [ ] Update all unit tests for new auth
- [ ] Modify E2E tests for JWT flow
- [ ] Performance testing and benchmarking
- [ ] Security audit of token handling
- [ ] Load testing with multiple instances
- [ ] Test token refresh edge cases
- [ ] Test logout and token revocation

### Phase 5: Deployment & Rollout (Week 3)

#### Todos:
- [ ] Deploy to staging environment
- [ ] Monitor for issues and performance
- [ ] Gradual rollout with feature flag
- [ ] Document new auth flow
- [ ] Update API documentation
- [ ] Train team on new auth system
- [ ] Plan rollback strategy if needed

### Phase 6: Cleanup & Optimization (Week 4)

#### Todos:
- [ ] Remove session middleware completely
- [ ] Drop session table from database
- [ ] Remove old auth code
- [ ] Optimize token refresh strategy
- [ ] Implement token blacklisting if needed
- [ ] Add monitoring and alerting
- [ ] Performance optimization

## Testing Strategy

### Unit Tests
- JWT service token generation/verification
- Token expiry handling
- Refresh token rotation
- Auth middleware with various token states
- Token manager storage operations

### Integration Tests
- Complete auth flow (register/login/refresh/logout)
- Token refresh during API calls
- Concurrent refresh token requests
- Error handling for invalid tokens
- Rate limiting on auth endpoints

### E2E Tests
- User registration and login flow
- Session persistence across refreshes
- Automatic token refresh
- Logout functionality
- Protected route access
- Multi-tab synchronization

### Security Tests
- Token signature validation
- Expired token rejection
- Token tampering detection
- XSS prevention in storage
- CSRF protection maintained

### Performance Tests
- Token validation speed
- Impact on request latency
- Database load reduction
- Concurrent user handling
- Token refresh under load

## Risk Assessment

### Technical Risks

#### Risk: Token Storage Security
- **Impact**: High - XSS attacks could steal tokens
- **Mitigation**: 
  - Store access token in memory only
  - Use httpOnly cookies for refresh token
  - Implement CSP headers
  - Regular security audits

#### Risk: Token Size Impact
- **Impact**: Medium - Larger request headers
- **Mitigation**:
  - Minimize JWT payload
  - Use compression
  - Monitor request sizes

#### Risk: Migration Complexity
- **Impact**: High - User disruption during migration
- **Mitigation**:
  - Feature flag for gradual rollout
  - Support both auth methods temporarily
  - Comprehensive testing
  - Clear rollback plan

### Operational Risks

#### Risk: Token Refresh Failures
- **Impact**: Medium - Users logged out unexpectedly
- **Mitigation**:
  - Retry logic for refresh
  - Grace period for expired tokens
  - Clear error messages
  - Monitoring and alerting

#### Risk: Increased Complexity
- **Impact**: Low - Harder to debug auth issues
- **Mitigation**:
  - Comprehensive logging
  - Clear documentation
  - Developer training
  - Debug tools

## Success Criteria

### Acceptance Criteria
- [ ] All existing auth functionality maintained
- [ ] No user disruption during migration
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance metrics met or exceeded
- [ ] Security audit passed
- [ ] Successfully deployed to Render
- [ ] Documentation complete and accurate

### Rollback Criteria
- More than 1% of users experiencing auth issues
- Performance degradation > 20%
- Security vulnerability discovered
- Critical bugs in token refresh logic

## Timeline

- **Week 1**: Server-side implementation
- **Week 2**: Client-side implementation and migration
- **Week 3**: Testing and staging deployment
- **Week 4**: Production rollout and cleanup

Total estimated effort: 4 weeks

## Appendix

### Alternative Approaches Considered
1. **OAuth 2.0**: Too complex for current needs
2. **Passport.js**: Adds unnecessary abstraction
3. **Auth0/Clerk**: Vendor lock-in concerns
4. **Keep sessions**: Doesn't solve scaling issues

### References
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Token Storage Security](https://auth0.com/docs/secure/security-guidance/data-security/token-storage)

### Dependencies
- jsonwebtoken: ^9.0.0
- @types/jsonwebtoken: ^9.0.0
- Optional: ioredis for refresh token storage

---

**Document Status**: APPROVED
**Last Updated**: 2024-12-29
**Author**: Development Team
**Approvals**: Tech Lead, Security Team, DevOps Team