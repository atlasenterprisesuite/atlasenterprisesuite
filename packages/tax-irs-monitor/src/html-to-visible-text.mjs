const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'div', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main',
  'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot',
  'th', 'thead', 'tr', 'ul'
]);

function isWhitespace(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
}

function isTagNameChar(char) {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    char === ':' ||
    char === '-' ||
    char === '_'
  );
}

function findTagEnd(input, start) {
  let quote = '';
  for (let index = start + 1; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return index;
  }
  return -1;
}

function parseTag(input, start, end) {
  let index = start + 1;
  while (index < end && isWhitespace(input[index])) index += 1;

  let closing = false;
  if (input[index] === '/') {
    closing = true;
    index += 1;
    while (index < end && isWhitespace(input[index])) index += 1;
  }

  if (input[index] === '!' || input[index] === '?') {
    return { closing, name: '' };
  }

  const nameStart = index;
  while (index < end && isTagNameChar(input[index])) index += 1;
  const name = input.slice(nameStart, index).toLowerCase();
  return { closing, name };
}

/**
 * Convert HTML-like content to visible text without attempting to sanitize HTML
 * with regular expressions. Script/style bodies are discarded by a small,
 * deterministic tokenizer that tolerates malformed closing tags such as
 * "</script\t\n bar>".
 */
export function htmlToVisibleText(input) {
  const html = String(input ?? '');
  let output = '';
  let rawTextTag = '';
  let index = 0;

  while (index < html.length) {
    if (html.startsWith('<!--', index)) {
      const commentEnd = html.indexOf('-->', index + 4);
      index = commentEnd === -1 ? html.length : commentEnd + 3;
      if (!rawTextTag) output += ' ';
      continue;
    }

    if (html[index] !== '<') {
      if (!rawTextTag) output += html[index];
      index += 1;
      continue;
    }

    const tagEnd = findTagEnd(html, index);
    if (tagEnd === -1) {
      if (!rawTextTag) output += ' ';
      break;
    }

    const tag = parseTag(html, index, tagEnd);

    if (rawTextTag) {
      if (tag.closing && tag.name === rawTextTag) {
        rawTextTag = '';
        output += ' ';
      }
      index = tagEnd + 1;
      continue;
    }

    if (!tag.closing && (tag.name === 'script' || tag.name === 'style')) {
      rawTextTag = tag.name;
      output += ' ';
      index = tagEnd + 1;
      continue;
    }

    if (tag.name === 'br' || (tag.closing && BLOCK_TAGS.has(tag.name))) {
      output += '\n';
    } else {
      output += ' ';
    }

    index = tagEnd + 1;
  }

  return output;
}
