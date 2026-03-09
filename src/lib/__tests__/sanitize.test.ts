import { describe, it, expect } from 'vitest';
import { sanitizeContent } from '../sanitize.js';

describe('sanitizeContent', () => {
  describe('Acceptance Tests', () => {
    it('AC1: renders headings, lists, tables, and code blocks with allowed elements', async () => {
      const md = [
        '# Heading 1',
        '## Heading 2',
        '',
        '- item one',
        '- item two',
        '',
        '| Col A | Col B |',
        '|-------|-------|',
        '| 1     | 2     |',
        '',
        '```',
        'const x = 1;',
        '```',
      ].join('\n');

      const html = await sanitizeContent(md);

      expect(html).toContain('<h1>Heading 1</h1>');
      expect(html).toContain('<h2>Heading 2</h2>');
      expect(html).toContain('<li>item one</li>');
      expect(html).toContain('<table>');
      expect(html).toContain('<pre><code>');
    });

    it('AC2: strips script tags', async () => {
      const md = '<script>alert("xss")</script>';
      const html = await sanitizeContent(md);

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert');
    });

    it('AC2: strips img onerror', async () => {
      const md = '<img onerror="alert(\'xss\')" src="x.png">';
      const html = await sanitizeContent(md);

      expect(html).not.toContain('onerror');
      expect(html).not.toContain('alert');
      expect(html).not.toContain('<img');
    });

    it('AC2: strips javascript: URLs', async () => {
      const md = '<a href="javascript:alert(\'xss\')">click me</a>';
      const html = await sanitizeContent(md);

      expect(html).not.toContain('javascript:');
      expect(html).toContain('click me');
    });
  });

  describe('XSS Attack Vectors', () => {
    it('strips <script>alert("xss")</script>', async () => {
      const md = '<script>alert("xss")</script>';
      const html = await sanitizeContent(md);

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert');
    });

    it('strips <img onerror="alert(\'xss\')">', async () => {
      const md = '<img onerror="alert(\'xss\')" src="bad.jpg">';
      const html = await sanitizeContent(md);

      expect(html).not.toContain('onerror');
      expect(html).not.toContain('<img');
    });

    it('strips javascript: href but preserves link text', async () => {
      const md = '<a href="javascript:alert(\'xss\')">safe text</a>';
      const html = await sanitizeContent(md);

      expect(html).not.toContain('javascript:');
      expect(html).toContain('safe text');
    });

    it('strips <iframe>', async () => {
      const md = '<iframe src="https://evil.com"></iframe>';
      const html = await sanitizeContent(md);

      expect(html).not.toContain('<iframe');
      expect(html).not.toContain('evil.com');
    });

    it('strips onclick from div but preserves the div', async () => {
      const md = '<div onclick="alert(\'xss\')">content inside div</div>';
      const html = await sanitizeContent(md);

      expect(html).not.toContain('onclick');
      expect(html).toContain('content inside div');
      expect(html).toMatch(/<div>/);
    });

    it('strips <object>, <embed>, <form>', async () => {
      const md = '<object data="x"></object><embed src="y"><form action="z"><input></form>';
      const html = await sanitizeContent(md);

      expect(html).not.toContain('<object');
      expect(html).not.toContain('<embed');
      expect(html).not.toContain('<form');
      expect(html).not.toContain('<input');
    });
  });

  describe('Positive Tests', () => {
    it('preserves headings, bold, italic, and http/https links', async () => {
      const md = [
        '# Title',
        '',
        'This is **bold** and *italic* text.',
        '',
        '[Link](https://example.com)',
      ].join('\n');

      const html = await sanitizeContent(md);

      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
      expect(html).toContain('<a href="https://example.com">Link</a>');
    });

    it('preserves code blocks', async () => {
      const md = '```\nconst x = 42;\n```';
      const html = await sanitizeContent(md);

      expect(html).toContain('<pre><code>');
      expect(html).toContain('const x = 42;');
    });

    it('preserves tables', async () => {
      const md = [
        '| Name | Value |',
        '|------|-------|',
        '| foo  | bar   |',
      ].join('\n');

      const html = await sanitizeContent(md);

      expect(html).toContain('<table>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<th>Name</th>');
      expect(html).toContain('<td>foo</td>');
    });
  });
});
