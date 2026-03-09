'use client';

import { useState, useCallback } from 'react';

interface TemplateSection {
  heading: string;
  description: string;
}

interface IntakeFormProps {
  template: string;
  initialContent?: string;
  onSave: (content: string) => void;
  saving?: boolean;
}

function parseTemplate(template: string): TemplateSection[] {
  const parts = template.split(/^## /m);
  const sections: TemplateSection[] = [];

  for (let i = 0; i < parts.length; i++) {
    const trimmed = parts[i].trim();
    if (!trimmed) continue;

    // The first part (before any ## heading) is preamble, not a section
    if (i === 0 && !template.startsWith('## ')) continue;

    const newlineIndex = trimmed.indexOf('\n');
    if (newlineIndex === -1) {
      sections.push({ heading: trimmed, description: '' });
    } else {
      sections.push({
        heading: trimmed.slice(0, newlineIndex).trim(),
        description: trimmed.slice(newlineIndex + 1).trim(),
      });
    }
  }

  return sections;
}

function parseInitialContent(
  content: string,
  sections: TemplateSection[],
): Record<number, string> {
  const values: Record<number, string> = {};

  if (sections.length === 0) {
    values[0] = content;
    return values;
  }

  const parts = content.split(/^## /m);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const newlineIndex = trimmed.indexOf('\n');
    const heading =
      newlineIndex === -1 ? trimmed : trimmed.slice(0, newlineIndex).trim();
    const body =
      newlineIndex === -1 ? '' : trimmed.slice(newlineIndex + 1).trim();

    const sectionIndex = sections.findIndex((s) => s.heading === heading);
    if (sectionIndex !== -1) {
      values[sectionIndex] = body;
    }
  }

  return values;
}

function assembleMarkdown(
  sections: TemplateSection[],
  values: Record<number, string>,
): string {
  if (sections.length === 0) {
    return values[0] ?? '';
  }

  return sections
    .map((section, i) => {
      const content = values[i] ?? '';
      return `## ${section.heading}\n${content}`;
    })
    .join('\n\n');
}

export default function IntakeForm({
  template,
  initialContent,
  onSave,
  saving = false,
}: IntakeFormProps) {
  const sections = parseTemplate(template);

  const [values, setValues] = useState<Record<number, string>>(() => {
    if (initialContent) {
      return parseInitialContent(initialContent, sections);
    }
    return {};
  });

  const handleChange = useCallback((index: number, value: string) => {
    setValues((prev) => ({ ...prev, [index]: value }));
  }, []);

  const handleSave = useCallback(() => {
    const markdown = assembleMarkdown(sections, values);
    onSave(markdown);
  }, [sections, values, onSave]);

  if (sections.length === 0) {
    return (
      <div>
        <textarea
          aria-label="Content"
          value={values[0] ?? ''}
          onChange={(e) => handleChange(0, e.target.value)}
          rows={10}
        />
        <button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
      </div>
    );
  }

  return (
    <div>
      {sections.map((section, i) => (
        <div key={section.heading}>
          <h2>{section.heading}</h2>
          {section.description && <p>{section.description}</p>}
          <textarea
            aria-label={section.heading}
            value={values[i] ?? ''}
            onChange={(e) => handleChange(i, e.target.value)}
            rows={6}
          />
        </div>
      ))}
      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Draft'}
      </button>
    </div>
  );
}
