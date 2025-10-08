# Authentication Security Roadmap

## Current Implementation (MVP - Minimal but Functional)

### ✅ What We Have

- **Access tokens**: 15 minute expiry
- **Refresh tokens**: 7 day expiry
- **Smart scheduling**: Tokens refreshed based on actual expiry (30s before)
- **Sleep handling**: Visibility change handler catches sleeping tabs
- **Transient retry**: Single retry with jitter (200-500ms) for network failures
- **Reactive refresh**: 401 errors trigger automatic token refresh
- **Request queuing**: Concurrent requests wait during token refresh

### ⚠️ Known Security Limitations

- **localStorage for refresh tokens**: Vulnerable to XSS attacks
- **No token rotation**: Stolen refresh token valid for 7 days
- **No multi-tab coordination**: Each tab manages tokens independently
- **No CSRF protection**: Currently relying on SameSite defaults

## Future Improvements (When User Base Grows)

### High Priority - Security

#### 1. HttpOnly Cookie for Refresh Tokens

**Problem**: XSS can steal refresh tokens from localStorage  
**Solution**: Move refresh token to HttpOnly, Secure, SameSite cookie

**Changes Required**:

- **Server-side**:
  ```typescript
  // On login/refresh, set cookie instead of returning in JSON
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: true, // HTTPS only
    sameSite: 'strict', // or 'lax' if needed
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth', // Limit scope
  });
  ```
- **Client-side**:
  ```typescript
  // Remove refresh token from localStorage
  // TokenManager only stores access token in memory
  // Refresh endpoint reads token from cookie automatically
  ```

**Benefits**:

- JavaScript cannot access refresh token (XSS protection)
- Cookie sent automatically on refresh requests
- SameSite prevents CSRF on modern browsers

**Effort**: 1-2 days (backend + frontend changes)

---

#### 2. Refresh Token Rotation

**Problem**: Stolen refresh token valid for full 7 days  
**Solution**: Issue new refresh token on every refresh, detect reuse

**Server Implementation**:

```typescript
// On token refresh
1. Generate new refresh token
2. Store token family ID in database
3. Invalidate old refresh token
4. If old token used again → revoke entire family (security breach)
5. Return new tokens

// Database schema
interface RefreshTokenRecord {
  tokenId: string;
  userId: number;
  familyId: string; // Links related tokens
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}
```

**Benefits**:

- Stolen token only valid until next refresh (max 15 mins with current schedule)
- Reuse detection catches token theft
- Limits blast radius of compromised token

**Effort**: 2-3 days (database, server logic)

---

#### 3. Access Token in Memory Only

**Problem**: Access token in localStorage also vulnerable to XSS  
**Solution**: Keep access token in memory only, no persistence

**Changes**:

```typescript
// TokenManager
class TokenManager {
  private memoryTokens: TokenPair | null = null;

  setTokens(tokens: TokenPair): void {
    this.memoryTokens = tokens;
    // DO NOT write to localStorage
  }

  getAccessToken(): string | null {
    return this.memoryTokens?.accessToken || null;
  }
}
```

**Trade-off**:

- ✅ Better security (XSS can't steal it)
- ⚠️ User logged out on page refresh (need to use refresh token on mount)

**Mitigation**:

```typescript
// On app mount, if no access token but refresh cookie exists
useEffect(() => {
  if (!tokenManager.getAccessToken()) {
    httpClient.refreshTokenIfNeeded(); // Use refresh cookie
  }
}, []);
```

**Effort**: 1 day

---

### Medium Priority - Performance & UX

#### 4. Multi-Tab Coordination

**Problem**: Each tab refreshes independently, wastes requests  
**Solution**: BroadcastChannel with leader election

**Implementation**:

```typescript
// Token refresh coordinator
const channel = new BroadcastChannel('auth_tokens');

// Leader election with lock
const acquireLock = async () => {
  const lockKey = 'token_refresh_lock';
  const lockExpiry = Date.now() + 5000; // 5s TTL

  const existingLock = localStorage.getItem(lockKey);
  if (existingLock && parseInt(existingLock) > Date.now()) {
    return false; // Another tab holds lock
  }

  localStorage.setItem(lockKey, lockExpiry.toString());
  return true;
};

// On refresh needed
const isLeader = await acquireLock();
if (isLeader) {
  await httpClient.refreshTokenIfNeeded();
  channel.postMessage({ type: 'tokens_refreshed', tokens });
} else {
  // Wait for leader to broadcast new tokens
  await new Promise((resolve) => {
    channel.onmessage = (e) => {
      if (e.data.type === 'tokens_refreshed') {
        tokenManager.setTokens(e.data.tokens);
        resolve();
      }
    };
  });
}
```

**Benefits**:

- Single refresh request across all tabs
- Faster token updates in non-leader tabs
- Reduces server load

**Effort**: 2 days

---

#### 5. CSRF Protection (if using SameSite=None)

**Problem**: Cross-site requests can include cookies  
**Solution**: Add CSRF token validation

**Only needed if**:

- Using `SameSite=None` (cross-origin requests)
- Supporting legacy browsers without SameSite

**Implementation**:

```typescript
// Server: Generate CSRF token on login
const csrfToken = crypto.randomBytes(32).toString('hex');
res.cookie('csrf_token', csrfToken, {
  httpOnly: false, // JS needs to read this
  secure: true,
  sameSite: 'strict',
});

// Client: Include in refresh request
fetch('/api/auth/refresh', {
  headers: {
    'X-CSRF-Token': getCsrfToken(), // Read from cookie
  },
});
```

**Effort**: 1 day (if needed)

---

### Low Priority - Robustness

#### 6. Additional Hardening

- **Queue size limit**: Cap at 100 requests during refresh
- **Idle timeout**: Don't refresh if user idle for > 30 mins
- **Telemetry**: Track refresh failures, 401 frequency
- **Circuit breaker**: Stop refresh attempts during outages

**Effort**: 1-2 days total

---

## Migration Plan

### Phase 1 (When you have 100+ active users)

1. HttpOnly cookies for refresh tokens
2. Access token memory-only
3. Server-side token rotation

**Time**: 1 week  
**Risk**: Low (backwards compatible with feature flag)

### Phase 2 (When you have 1000+ users)

4. Multi-tab coordination
5. CSRF protection (if needed)
6. Additional hardening

**Time**: 1 week  
**Risk**: Low

---

## Testing Checklist

Before implementing security improvements:

- [ ] Test token refresh with network offline
- [ ] Test multiple tabs refreshing simultaneously
- [ ] Test XSS attack scenarios (inject script trying to steal tokens)
- [ ] Test token reuse detection (replay old refresh token)
- [ ] Test CSRF (cross-origin requests with cookies)
- [ ] Load test refresh endpoint (many concurrent refreshes)
- [ ] Test mobile app sleep/wake cycles

---

## References

- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Auth0: Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
- [RFC 6749: OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
