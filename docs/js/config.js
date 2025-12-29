export const APP_VERSION = 'v0.0.21';
export const CSV_URL = new URL('data/hyakunin_isshu_with_ruby.csv', window.location.href).toString();
export const CSV_FALLBACK_URL = 'https://nuitsjp.github.io/goshiki-hyakunin-isshu/data/hyakunin_isshu_with_ruby.csv';
export const colorAccentMap = {
  '青': 'var(--color-blue)',
  'ピンク': 'var(--color-pink)',
  '黄': 'var(--color-yellow)',
  '緑': 'var(--color-green)',
  'オレンジ': 'var(--color-orange)',
};
export const colorTextMap = {
  '黄': '#3b3b00',
};
export const STORAGE_KEYS = {
  HISTORY: 'goshiki_quiz_history',
  VERSION: 'goshiki_stats_version',
  DISPLAY_MODE: 'goshiki_display_mode',
  ORDER_MODE: 'goshiki_order_mode'
};
export const STATS_VERSION = '1.0.0';
export const MAX_HISTORY_ENTRIES = 1000;
export const HISTORY_RETENTION_DAYS = 365;
export const COLORS = ['青', 'ピンク', '黄', '緑', 'オレンジ'];
