/**
 * JSON Repair Utilities for LLM Structured Output
 *
 * Handles common issues with LLM-generated JSON:
 * - Truncated responses (incomplete arrays/objects)
 * - Trailing commas
 * - Markdown code blocks around JSON
 * - Unclosed quotes and brackets
 * - Partial array extraction when full parsing fails
 */

export interface JsonRepairResult<T> {
  success: boolean;
  data: T | null;
  repaired: boolean;
  originalError?: string;
  repairMethod?: string;
}

/**
 * Repair and parse potentially malformed JSON from LLM responses
 *
 * @param text - Raw text that should contain JSON
 * @param fallbackExtractor - Optional function to extract partial data if parsing fails
 * @returns Parsed JSON object or null if repair failed
 */
export function repairAndParseJson<T>(
  text: string,
  fallbackExtractor?: (text: string) => T | null
): JsonRepairResult<T> {
  if (!text || typeof text !== 'string') {
    return { success: false, data: null, repaired: false, originalError: 'Empty or invalid input' };
  }

  // Step 1: Clean markdown code blocks
  let cleaned = cleanMarkdownCodeBlocks(text);

  // Step 2: Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    return { success: true, data: parsed, repaired: false };
  } catch (directError) {
    // Continue to repair attempts
  }

  // Step 3: Try to find and extract JSON object/array
  cleaned = extractJsonStructure(cleaned);

  // Step 4: Try parsing after extraction
  try {
    const parsed = JSON.parse(cleaned);
    return { success: true, data: parsed, repaired: true, repairMethod: 'extract_structure' };
  } catch (extractError) {
    // Continue to more aggressive repair
  }

  // Step 5: Repair truncated structures
  const repaired = repairTruncatedJson(cleaned);

  try {
    const parsed = JSON.parse(repaired);
    return { success: true, data: parsed, repaired: true, repairMethod: 'repair_truncated' };
  } catch (repairError) {
    // Continue to fallback
  }

  // Step 6: Try removing trailing commas
  const noTrailingCommas = removeTrailingCommas(repaired);

  try {
    const parsed = JSON.parse(noTrailingCommas);
    return { success: true, data: parsed, repaired: true, repairMethod: 'remove_trailing_commas' };
  } catch (commaError) {
    // Continue to fallback
  }

  // Step 7: Try extracting the last complete object/array from truncated text
  // This handles cases where the LLM output was truncated mid-array
  try {
    const truncationRepaired = extractLastCompleteStructure(noTrailingCommas);
    if (truncationRepaired) {
      const parsed = JSON.parse(truncationRepaired);
      return { success: true, data: parsed, repaired: true, repairMethod: 'extract_last_complete_structure' };
    }
  } catch (truncError) {
    // Continue to fallback
  }

  // Step 8: Use fallback extractor if provided
  if (fallbackExtractor) {
    try {
      const fallbackData = fallbackExtractor(text);
      if (fallbackData) {
        return { success: true, data: fallbackData, repaired: true, repairMethod: 'fallback_extractor' };
      }
    } catch (fallbackError) {
      // Fallback also failed
    }
  }

  return {
    success: false,
    data: null,
    repaired: false,
    originalError: 'All repair attempts failed',
  };
}

/**
 * Remove markdown code blocks from text
 */
function cleanMarkdownCodeBlocks(text: string): string {
  // Remove ```json ... ``` blocks
  let cleaned = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```$/im, '');

  // Also handle cases where the code block is in the middle
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  }

  return cleaned.trim();
}

/**
 * Extract JSON structure from text (find { or [ and extract to end)
 */
function extractJsonStructure(text: string): string {
  // Find the first { or [
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');

  let start = -1;
  let isObject = false;

  if (objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart)) {
    start = objectStart;
    isObject = true;
  } else if (arrayStart >= 0) {
    start = arrayStart;
    isObject = false;
  }

  if (start === -1) {
    return text;
  }

  // Extract from start
  let json = text.slice(start);

  // Try to find matching end (simple heuristic)
  if (isObject) {
    // Find last }
    const lastBrace = json.lastIndexOf('}');
    if (lastBrace > 0) {
      json = json.slice(0, lastBrace + 1);
    }
  } else {
    // Find last ]
    const lastBracket = json.lastIndexOf(']');
    if (lastBracket > 0) {
      json = json.slice(0, lastBracket + 1);
    }
  }

  return json;
}

/**
 * Repair truncated JSON by closing unclosed structures
 *
 * Handles:
 * - Truncation mid-string value (unclosed quotes)
 * - Truncation mid-property (trailing comma/colon)
 * - Truncation mid-array/object (unclosed brackets/braces)
 * - Truncation mid-key-value pair (incomplete property after closing quote)
 */
function repairTruncatedJson(text: string): string {
  let json = text.trim();

  // Check for unclosed strings (odd number of unescaped quotes)
  const unescapedQuotes = json.match(/(?<!\\)"/g) || [];
  if (unescapedQuotes.length % 2 !== 0) {
    // We're inside a string — close it
    json = json + '"';
  }

  // After closing any open string, clean up trailing artifacts
  // Remove trailing patterns that indicate truncation mid-value:
  // - Trailing comma: `..., ` (item was about to start)
  // - Trailing colon: `"key": ` (value was about to start)
  // - Trailing comma after value inside object: `"key": "val",` (next key was about to start)
  const trimmed = json.trimEnd();
  const lastChar = trimmed.slice(-1);

  if (lastChar === ':') {
    // Truncated right after a key's colon — add empty string value
    json = trimmed + '""';
  } else if (lastChar === ',') {
    // Truncated after a comma — remove the trailing comma
    json = trimmed.slice(0, -1);
  }

  // Count opening and closing brackets/braces AFTER string and comma repairs
  const openBrackets = (json.match(/\[/g) || []).length;
  const closeBrackets = (json.match(/\]/g) || []).length;
  const openBraces = (json.match(/\{/g) || []).length;
  const closeBraces = (json.match(/\}/g) || []).length;

  // Build the correct closing sequence using a stack-based approach
  // This ensures proper nesting order (inner structures closed before outer)
  const closingSequence = buildClosingSequence(json);
  if (closingSequence) {
    json += closingSequence;
  } else {
    // Fallback: simple bracket counting (less accurate for nesting)
    const missingBrackets = openBrackets - closeBrackets;
    if (missingBrackets > 0) {
      json += ']'.repeat(missingBrackets);
    }
    const missingBraces = openBraces - closeBraces;
    if (missingBraces > 0) {
      json += '}'.repeat(missingBraces);
    }
  }

  return json;
}

/**
 * Build the correct closing sequence for truncated JSON using a stack-based parser.
 * This ensures proper nesting order (e.g., `]}` not `}]`).
 */
function buildClosingSequence(json: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  if (stack.length === 0) return null;
  return stack.reverse().join('');
}

/**
 * Remove trailing commas from JSON
 */
function removeTrailingCommas(text: string): string {
  // Remove trailing commas before ] or }
  return text
    .replace(/,(\s*\])/g, '$1')
    .replace(/,(\s*\})/g, '$1');
}

/**
 * Extract partial array items from malformed JSON
 * Useful for extracting what we can from truncated arrays
 */
export function extractPartialArrayItems<T>(
  text: string,
  itemPattern: RegExp,
  itemParser: (match: RegExpMatchArray) => T | null
): T[] {
  const items: T[] = [];
  const matches = text.matchAll(itemPattern);

  for (const match of matches) {
    try {
      const item = itemParser(match);
      if (item !== null) {
        items.push(item);
      }
    } catch {
      // Skip malformed items
    }
  }

  return items;
}

/**
 * Extract string array from potentially malformed JSON
 * Useful for extracting follow-up questions or simple lists
 */
export function extractStringArray(text: string): string[] {
  const results: string[] = [];

  // Try direct parse first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    // Continue to regex extraction
  }

  // Pattern for quoted strings in array context
  const stringPattern = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let match;

  while ((match = stringPattern.exec(text)) !== null) {
    const value = match[1];
    // Filter out very short strings (likely to be keys or artifacts)
    if (value && value.length > 10) {
      results.push(value);
    }
  }

  return results;
}

/**
 * Extract objects from a malformed array response
 * Attempts to find complete objects even if the array is truncated
 */
export function extractCompleteObjects<T>(
  text: string,
  requiredKeys: string[],
  transformer?: (obj: Record<string, unknown>) => T
): T[] {
  const results: T[] = [];

  // Find all potential object boundaries
  const objectPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let match;

  while ((match = objectPattern.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]) as Record<string, unknown>;

      // Check if object has required keys
      const hasRequired = requiredKeys.every(key => key in obj);
      if (hasRequired) {
        const item = transformer ? transformer(obj) : (obj as T);
        results.push(item);
      }
    } catch {
      // Skip malformed objects
    }
  }

  return results;
}

/**
 * Create a fallback extractor for best practices from A4-Web
 */
export function createBestPracticesFallbackExtractor() {
  return (text: string): { practices: unknown[] } | null => {
    const practices = extractCompleteObjects(
      text,
      ['title', 'description'],
      (obj) => ({
        title: String(obj.title || 'Optimization'),
        description: String(obj.description || ''),
        applicableInefficiencyIds: Array.isArray(obj.applicableInefficiencyIds)
          ? obj.applicableInefficiencyIds
          : ['general'],
        estimatedTimeSavingsSeconds: Number(obj.estimatedTimeSavingsSeconds) || 60,
        toolSuggestion: String(obj.toolSuggestion || ''),
        claudeCodeApplicable: Boolean(obj.claudeCodeApplicable),
        claudeCodePrompt: String(obj.claudeCodePrompt || ''),
        confidence: Math.min(1, Math.max(0, Number(obj.confidence) || 0.5)),
      })
    );

    if (practices.length > 0) {
      return { practices };
    }

    return null;
  };
}

/**
 * Extract the last complete JSON structure from truncated text.
 * Scans backwards from the end to find the last complete `}` or `]`
 * that produces valid JSON when paired with the beginning of the text.
 */
function extractLastCompleteStructure(text: string): string | null {
  // Find the first opening delimiter
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  if (firstBrace === -1 && firstBracket === -1) return null;

  const start = firstBrace >= 0 && firstBracket >= 0
    ? Math.min(firstBrace, firstBracket)
    : firstBrace >= 0 ? firstBrace : firstBracket;

  const openChar = text[start];
  const closeChar = openChar === '{' ? '}' : ']';

  // Scan backwards for each closing delimiter and try to parse
  let searchFrom = text.length - 1;
  for (let attempts = 0; attempts < 5; attempts++) {
    const lastClose = text.lastIndexOf(closeChar, searchFrom);
    if (lastClose <= start) break;

    const candidate = text.slice(start, lastClose + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Try the next-to-last closing delimiter
      searchFrom = lastClose - 1;
    }
  }

  return null;
}

/**
 * Create a fallback extractor for guidance from A4-Company
 */
export function createGuidanceFallbackExtractor() {
  return (text: string): { guidance: unknown[] } | null => {
    const guidance = extractCompleteObjects(
      text,
      ['guidanceText'],
      (obj) => ({
        documentId: String(obj.documentId || 'unknown'),
        guidanceText: String(obj.guidanceText || ''),
        applicableInefficiencyIds: Array.isArray(obj.applicableInefficiencyIds)
          ? obj.applicableInefficiencyIds
          : ['general'],
        estimatedTimeSavingsSeconds: Number(obj.estimatedTimeSavingsSeconds) || 60,
        toolSuggestion: String(obj.toolSuggestion || ''),
        claudeCodeApplicable: Boolean(obj.claudeCodeApplicable),
        claudeCodePrompt: obj.claudeCodePrompt ? String(obj.claudeCodePrompt) : undefined,
        confidence: Math.min(1, Math.max(0, Number(obj.confidence) || 0.5)),
      })
    );

    if (guidance.length > 0) {
      return { guidance };
    }

    return null;
  };
}
