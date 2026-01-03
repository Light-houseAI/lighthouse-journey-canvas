# Langfuse Integration for Desktop Companion

## Implementation Status: ✅ COMPLETE

The Desktop Companion (`Desktop-companion/`) now has full Langfuse integration for:
- Screenshot sequence analysis (batch Gemini Vision calls)
- Single screenshot analysis
- Error tracking and success metrics
- Graceful shutdown with event flushing

## Files Modified

| File | Changes |
|------|---------|
| `lib/langfuse.js` | New module - Langfuse singleton, tracing, and scoring utilities |
| `lib/screenshot-analysis.js` | Added tracing for both `analyzeScreenshotSequence` and `analyzeScreenshotWithCache` |
| `main.js` | Added Langfuse shutdown on app quit |

## What's Tracked

### Traces
- `gemini-screenshot-sequence-analysis` - Batch screenshot analysis
- `gemini-single-screenshot-analysis` - Individual screenshot analysis
- `gemini-single-screenshot-error` - Error cases

### Generations
- `gemini-vision-sequence` - LLM call for batch analysis
- `gemini-vision-single` - LLM call for single screenshot

### Scores
- `analysis-success` - 1.0 for success, 0.0 for failure
- `descriptions-coverage` - Ratio of screenshots successfully described

### Metadata
- `screenshotCount` - Number of screenshots in batch
- `totalPayloadKb` - Image payload size
- `durationMs` - API call duration
- `descriptionsGenerated` - Count of descriptions returned
- `meaningfulCount` - Count of meaningful screenshots

## Setup

### 1. Install Langfuse SDK

```bash
cd Desktop-companion
npm install langfuse
```

### 2. Environment Variables

Add to `.env` or set in environment:

```
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

### 3. Test

1. Set environment variables
2. Run Desktop Companion
3. Start a recording session
4. Check Langfuse dashboard for traces

## Code Reference

### lib/langfuse.js

```javascript
const { Langfuse } = require('langfuse');

let langfuseInstance = null;

function getLangfuse() {
  if (langfuseInstance) return langfuseInstance;

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;

  if (!secretKey || !publicKey) {
    console.log('[Langfuse] Not configured - tracing disabled');
    return null;
  }

  langfuseInstance = new Langfuse({
    secretKey,
    publicKey,
    baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  });

  return langfuseInstance;
}

function createTrace(options) { /* ... */ }
function logScore(options) { /* ... */ }
async function flushLangfuse() { /* ... */ }
async function shutdownLangfuse() { /* ... */ }

module.exports = { getLangfuse, createTrace, logScore, flushLangfuse, shutdownLangfuse };
```

### Usage in screenshot-analysis.js

```javascript
const { createTrace, logScore } = require('./langfuse');

async function analyzeScreenshotSequence({ screenshots, geminiModel }) {
  const trace = createTrace({
    name: 'gemini-screenshot-sequence-analysis',
    metadata: { screenshotCount: screenshots.length },
    tags: ['desktop-companion', 'gemini-vision', 'sequence-analysis'],
  });

  const generation = trace?.generation({
    name: 'gemini-vision-sequence',
    model: 'gemini-1.5-flash',
    input: { screenshotCount: screenshots.length },
  });

  try {
    const result = await generateContentWithRetry(geminiModel, promptParts, { responseSchema });

    generation?.end({ output: { responseReceived: true } });

    logScore({
      traceId: trace.id,
      name: 'analysis-success',
      value: 1.0,
    });

    return result;
  } catch (error) {
    logScore({
      traceId: trace.id,
      name: 'analysis-success',
      value: 0.0,
      comment: error.message,
    });
    throw error;
  }
}
```

## Notes

- Langfuse is optional - if env vars are not set, tracing is disabled
- Events are sent asynchronously and don't block the app
- `flushLangfuse()` and `shutdownLangfuse()` are called on app quit to ensure all events are sent
- The Desktop Companion runs on user machines, so network connectivity to Langfuse cloud must be available
