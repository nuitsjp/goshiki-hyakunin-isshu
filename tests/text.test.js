import { describe, expect, it } from 'vitest';
import { escapeHtml, toAriaLabel, toRubyHtml } from '../src/js/text.js';

describe('text utils', () => {
  it('escapeHtml escapes HTML special characters', () => {
    const input = `<div class="a&b">'x'</div>`;
    const escaped = escapeHtml(input);
    expect(escaped).toBe('&lt;div class=&quot;a&amp;b&quot;&gt;&#39;x&#39;&lt;/div&gt;');
  });

  it('toRubyHtml strips ruby brackets and escapes', () => {
    const input = 'か[き]く<';
    const output = toRubyHtml(input);
    expect(output).toBe('かく&lt;');
  });

  it('toAriaLabel strips ruby brackets only', () => {
    const input = 'さ[し]す';
    expect(toAriaLabel(input)).toBe('さす');
  });
});
