import sanitizeHtml from 'sanitize-html';

// Helper function to safely strip HTML tags while preserving text content
export function stripHtmlTags(html) {
  if (!html) return html;
  
  // Use sanitize-html to remove all tags while preserving text content
  return sanitizeHtml(html, {
    // Remove all tags
    allowedTags: [],
    // Remove all attributes
    allowedAttributes: {},
    // Decode HTML entities
    decodeEntities: true,
    // Remove style and script tags even if they're not in the allowed list
    disallowedTagsMode: 'discard',
    // Clean up whitespace
    textFilter: function(text) {
      return text.replace(/\s+/g, ' ').trim();
    }
  });
}