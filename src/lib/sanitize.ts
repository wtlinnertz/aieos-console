import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  // Block elements
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'blockquote', 'pre', 'code',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'br', 'div',
  // Inline elements
  'strong', 'em', 'a', 'span',
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href'],
  code: ['class'],
  span: ['class'],
  pre: ['class'],
  div: ['class', 'id'],
  h1: ['id'],
  h2: ['id'],
  h3: ['id'],
  h4: ['id'],
  h5: ['id'],
  h6: ['id'],
};

const ALLOWED_SCHEMES = ['http', 'https'];

export async function sanitizeContent(markdown: string): Promise<string> {
  const { remark } = await import('remark');
  const remarkHtml = (await import('remark-html')).default;
  const remarkGfm = (await import('remark-gfm')).default;

  const processed = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);
  const rawHtml = String(processed);

  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag: {
      a: ALLOWED_SCHEMES,
    },
  });
}
