export const escapeHtml = (str = '') =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const toRubyHtml = (text = '') => escapeHtml(text.replace(/\[([^\][]+)\]/g, ''));

export const toAriaLabel = (text = '') => text.replace(/\[([^\][]+)\]/g, '');


