/**
 * Tests for retry-utils.ts
 * Run with: npx tsx src/core/__tests__/retry-utils.test.ts
 */

import {
  withRetry,
  ConcurrencyLimiter,
  isRateLimitError,
  isTransientError,
  extractRetryAfter,
  sleep,
  calculateDelay,
} from '../retry-utils.js';

async function runTests() {
  console.log('=== Testing retry-utils.ts ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.log(`  ❌ ${message}`);
      failed++;
    }
  }

  // Test 1: Rate Limit Detection
  console.log('1. Rate Limit Detection:');
  assert(isRateLimitError({ message: 'Rate limit reached for gpt-4o' }), 'Detects "Rate limit"');
  assert(isRateLimitError({ message: 'Too many requests' }), 'Detects "Too many requests"');
  assert(isRateLimitError({ message: 'tokens per min (TPM): Limit 30000' }), 'Detects TPM limit');
  assert(isRateLimitError({ message: 'Please try again in 1.5s' }), 'Detects retry message');
  assert(!isRateLimitError({ message: 'Normal error' }), 'Does not false positive');

  // Test 2: Transient Error Detection
  console.log('\n2. Transient Error Detection:');
  assert(isTransientError({ message: 'Connection timeout' }), 'Detects timeout');
  assert(isTransientError({ message: 'ECONNRESET' }), 'Detects ECONNRESET');
  assert(isTransientError({ message: '503 Service Unavailable' }), 'Detects 503');
  assert(!isTransientError({ message: 'Invalid API key' }), 'Does not false positive');

  // Test 3: Retry-After Extraction
  console.log('\n3. Retry-After Extraction:');
  assert(extractRetryAfter({ message: 'Please try again in 1.5s' }) === 1500, 'Extracts 1.5s');
  assert(extractRetryAfter({ message: 'try again in 2.3s' }) === 2300, 'Extracts 2.3s');
  assert(extractRetryAfter({ message: 'No retry info' }) === null, 'Returns null when none');

  // Test 4: ConcurrencyLimiter
  console.log('\n4. ConcurrencyLimiter:');
  const limiter = new ConcurrencyLimiter(2);
  assert(limiter.status.maxConcurrency === 2, 'Has correct max concurrency');
  assert(limiter.status.running === 0, 'Starts with 0 running');
  assert(limiter.status.queued === 0, 'Starts with 0 queued');

  // Test concurrent execution
  let concurrentCount = 0;
  let maxConcurrent = 0;
  const tasks = Array(5).fill(null).map((_, i) =>
    limiter.run(async () => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      await sleep(50);
      concurrentCount--;
      return i;
    })
  );
  await Promise.all(tasks);
  assert(maxConcurrent <= 2, `Max concurrent was ${maxConcurrent} (should be ≤2)`);

  // Test 5: withRetry
  console.log('\n5. withRetry:');

  // Test successful retry
  let attempts = 0;
  const result = await withRetry(
    async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Transient error: timeout');
      }
      return 'success';
    },
    { maxRetries: 3, baseDelayMs: 10 }
  );
  assert(result === 'success', 'Returns success after retries');
  assert(attempts === 3, `Took ${attempts} attempts (expected 3)`);

  // Test non-retryable error
  let nonRetryableAttempts = 0;
  try {
    await withRetry(
      async () => {
        nonRetryableAttempts++;
        throw new Error('Invalid API key');
      },
      { maxRetries: 3, baseDelayMs: 10 }
    );
    assert(false, 'Should have thrown');
  } catch (e) {
    assert(nonRetryableAttempts === 1, `Non-retryable failed immediately (${nonRetryableAttempts} attempt)`);
  }

  // Test rate limit retry
  let rateLimitAttempts = 0;
  try {
    await withRetry(
      async () => {
        rateLimitAttempts++;
        if (rateLimitAttempts < 2) {
          throw new Error('Rate limit reached');
        }
        return 'recovered';
      },
      { maxRetries: 3, baseDelayMs: 10 }
    );
    assert(rateLimitAttempts === 2, `Rate limit retried successfully (${rateLimitAttempts} attempts)`);
  } catch (e) {
    assert(false, 'Rate limit should have recovered');
  }

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test runner error:', e);
  process.exit(1);
});
