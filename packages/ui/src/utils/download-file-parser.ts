/**
 * Download File Parser Utility
 *
 * Parses markdown content for downloadable file blocks and provides
 * utilities to trigger browser downloads.
 *
 * Syntax: ```download:filename.ext
 */

export interface ParsedDownloadFile {
  filename: string;
  content: string;
  mimeType: string;
  language: string;
}

export interface ParseResult {
  cleanContent: string;
  downloadableFiles: ParsedDownloadFile[];
}

/**
 * Get MIME type based on file extension
 */
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    md: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    xml: 'application/xml',
    csv: 'text/csv',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    ts: 'text/typescript',
  };
  return mimeTypes[extension] || 'text/plain';
}

/**
 * Parse markdown content for downloadable file blocks
 *
 * Looks for code blocks with the syntax:
 * ```download:filename.ext
 * content here
 * ```
 *
 * Returns the clean content (with download blocks removed) and
 * an array of parsed downloadable files.
 */
export function parseDownloadableFiles(markdown: string): ParseResult {
  const downloadableFiles: ParsedDownloadFile[] = [];

  // Regex to match ```download:filename.ext followed by content and closing ```
  // Uses non-greedy match for content to handle multiple blocks
  const downloadBlockRegex = /```download:([^\s\n]+)\n([\s\S]*?)```/g;

  let match;
  while ((match = downloadBlockRegex.exec(markdown)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trimEnd(); // Preserve leading whitespace but trim trailing
    const extension = filename.split('.').pop()?.toLowerCase() || 'txt';
    const mimeType = getMimeType(extension);

    downloadableFiles.push({
      filename,
      content,
      mimeType,
      language: extension,
    });
  }

  // Remove download blocks from content, leaving a placeholder marker
  // that won't be rendered (empty string)
  const cleanContent = markdown.replace(downloadBlockRegex, '').trim();

  return { cleanContent, downloadableFiles };
}

/**
 * Trigger file download using the Blob API
 *
 * Creates a temporary anchor element to trigger the browser's
 * native download dialog.
 */
export function downloadFile(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
