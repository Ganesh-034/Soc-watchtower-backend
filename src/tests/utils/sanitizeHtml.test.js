
// src/tests/utils/sanitizeHtml.test.js
import { stripHtmlTags } from '../../utils/sanitizeHtml.js';

/**
 * Convert HTML-escaped strings to real HTML tags for sanitize-html to parse.
 * Also inserts spaces between adjacent tags ("><" -> "> <") to avoid
 * concatenated words after tags are stripped.
 */
function prepareHtml(escaped) {
  if (escaped == null) return escaped;
  let s = String(escaped);

  // Decode escaped tag brackets and common entities used in your fixtures
  s = s
    .replaceAll(/&lt;/gi, '<')
    .replaceAll(/&gt;/gi, '>')
    .replaceAll(/&nbsp;/gi, ' ')
    .replaceAll(/&quot;/gi, '"')
    .replaceAll(/&#39;/gi, "'");

  // Ensure a space between adjacent tags to preserve word boundaries
  s = s.replaceAll(/>\s*</g, '> <');

  return s;
}

describe('stripHtmlTags', () => {
  test('returns falsy inputs as-is', () => {
    expect(stripHtmlTags(undefined)).toBeUndefined();
    expect(stripHtmlTags(null)).toBeNull();
    expect(stripHtmlTags('')).toBe('');
    // By design: non-string falsy values are returned as-is
    expect(stripHtmlTags(0)).toBe(0);
    expect(stripHtmlTags(false)).toBe(false);
  });

  test('preserves plain text', () => {
    expect(stripHtmlTags('Hello world')).toBe('Hello world');
  });

  test('removes all tags and attributes but preserves text content', () => {
    const escaped =
      '&lt;p class="x"&gt;&lt;strong id="y"&gt;Hello&lt;/strong&gt; &lt;a href="https://x.y"&gt;world&lt;/a&gt;&lt;/p&gt;';
    const input = prepareHtml(escaped);
    const output = stripHtmlTags(input);
    // Anchor tag removed, inner text kept; attributes dropped; URL not kept
    expect(output).toBe('Hello world');
  });

  test('discards script content entirely', () => {
    const escaped =
      '&lt;div&gt;safe&lt;/div&gt;&lt;script&gt;alert("xss")&lt;/script&gt; &lt;p&gt;after&lt;/p&gt;';
    const input = prepareHtml(escaped);
    const output = stripHtmlTags(input);
    expect(output).toBe('safe after');
    expect(output.includes('alert')).toBe(false);
  });

  test('discards style content entirely', () => {
    const escaped = '&lt;style&gt;body{color:red}&lt;/style&gt;&lt;span&gt;text&lt;/span&gt;';
    const input = prepareHtml(escaped);
    const output = stripHtmlTags(input);
    expect(output).toBe('text');
    expect(output.includes('color')).toBe(false);
  });

  test('decodes HTML entities in output (decodeEntities: true)', () => {
    // NOTE: Expect decoded entities in the final output: &amp; -> &, &nbsp; -> space
    const escaped = 'Tom &amp; Jerry &lt;b&gt;love&lt;/b&gt; fun &nbsp;&nbsp;!';
    const input = prepareHtml(escaped);
    const output = stripHtmlTags(input);
    // Entities decoded; tags removed; whitespace collapsed
    expect(output).toBe('Tom & Jerry love fun !');
  });

  test('normalizes whitespace (spaces, newlines, tabs)', () => {
    const escaped = `
      &lt;div&gt;
        Hello     
        world\t\t
        &lt;span&gt;   from&lt;/span&gt;
        &lt;em&gt;  Jest  &lt;/em&gt;
      &lt;/div&gt;
    `;
    const input = prepareHtml(escaped);
    const output = stripHtmlTags(input);
    expect(output).toBe('Hello world from Jest');
  });

  test('handles nested tags', () => {
    const escaped =
      '&lt;p&gt;&lt;strong&gt;Nested&lt;/strong&gt; &lt;em&gt;tags&lt;/em&gt; &lt;u&gt;work&lt;/u&gt;&lt;/p&gt;';
    const input = prepareHtml(escaped);
    const output = stripHtmlTags(input);
    expect(output).toBe('Nested tags work');
  });

  test('works with mixed dangerous HTML', () => {
    const escaped = `
      &lt;div onclick="evil()"&gt;Click&lt;/div&gt;
      &lt;a href="javascript:alert(1)"&gt;link&lt;/a&gt;
      Text &amp; more &lt;b&gt;TEXT&lt;/b&gt;
    `;
    const input = prepareHtml(escaped);
    const output = stripHtmlTags(input);
    // Tags removed, inner text preserved; entities decoded
    expect(output).toBe('Click link Text & more TEXT');
    expect(output.includes('javascript')).toBe(false);
  });

  test('output is a trimmed, normalized string when input is a string', () => {
    const escaped = '   &lt;span&gt; spaced   text &lt;/span&gt;   ';
    const input = prepareHtml(escaped);
    const output = stripHtmlTags(input);
    expect(typeof output).toBe('string');
    expect(output).toBe('spaced text');
  });
});
``
