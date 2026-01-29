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

  // Step 7: Use fallback extractor if provided
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
 */
function repairTruncatedJson(text: string): string {
  let json = text.trim();

  // Count opening and closing brackets
  const openBrackets = (json.match(/\[/g) || []).length;
  const closeBrackets = (json.match(/\]/g) || []).length;
  const openBraces = (json.match(/\{/g) || []).length;
  const closeBraces = (json.match(/\}/g) || []).length;

  // Check for unclosed strings (odd number of unescaped quotes)
  const unescapedQuotes = json.match(/(?<!\\)"/g) || [];
  if (unescapedQuotes.length % 2 !== 0) {
    // Try to close the string
    json = json + '"';
  }

  // Check if we're in the middle of a value and close appropriately
  const lastChar = json.slice(-1);
  const lastNonWhitespaceMatch = json.match(/\S(?=\s*$)/);
  const lastNonWhitespace = lastNonWhitespaceMatch ? lastNonWhitespaceMatch[0] : '';

  // If ends with comma or colon, likely truncated mid-value
  if (lastNonWhitespace === ',' || lastNonWhitespace === ':') {
    // Remove trailing comma/colon
    json = json.slice(0, json.lastIndexOf(lastNonWhitespace));
  }

  // Close unclosed arrays first (inner structures)
  const missingBrackets = openBrackets - closeBrackets;
  if (missingBrackets > 0) {
    json += ']'.repeat(missingBrackets);
  }

  // Close unclosed objects (outer structures)
  const missingBraces = openBraces - closeBraces;
  if (missingBraces > 0) {
    json += '}'.repeat(missingBraces);
  }

  return json;
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
