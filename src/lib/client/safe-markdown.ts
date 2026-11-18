/**
 * YAI Studio — Safe Markdown Formatter
 *
 * Minimal, zero-dependency Markdown to sanitized HTML parser for client rendering.
 * Sanitizes all input: strips <script>, <iframe>, event attributes (onclick, etc.),
 * and dangerous protocols (javascript:).
 *
 * @module lib/client/safe-markdown
 */

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/on\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/javascript:/gi, '');
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatMarkdown(text: string): string {
  if (!text) return '';

  // 1. Extract and preserve code blocks
  const codeBlocks: string[] = [];
  let formatted = text.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_, lang, code) => {
    const escapedCode = escapeHtml(code.trim());
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    codeBlocks.push(`<pre><code${langAttr}>${escapedCode}</code></pre>`);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 2. Escape standard characters in prose
  formatted = escapeHtml(formatted);

  // 3. Inline code
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 4. Headers
  formatted = formatted
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 5. Bold & Italic
  formatted = formatted
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 6. Blockquotes
  formatted = formatted.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 7. Unordered lists
  formatted = formatted.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  formatted = formatted.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  formatted = formatted.replace(/<\/ul>\s*<ul>/g, '');

  // 8. Links
  formatted = formatted.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // 9. Paragraphs and line breaks
  formatted = formatted
    .split(/\n\n+/)
    .map((para) => {
      if (
        para.startsWith('<h1>') ||
        para.startsWith('<h2>') ||
        para.startsWith('<h3>') ||
        para.startsWith('<blockquote>') ||
        para.startsWith('<ul>') ||
        para.startsWith('__CODE_BLOCK_')
      ) {
        return para;
      }
      return `<p>${para.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  // 10. Restore code blocks
  formatted = formatted.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => {
    return codeBlocks[Number(idx)] || '';
  });

  return sanitizeHtml(formatted);
}
