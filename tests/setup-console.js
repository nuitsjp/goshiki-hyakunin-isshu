import { afterEach, beforeEach, vi } from 'vitest';

let errorSpy;
let warnSpy;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  if (errorSpy) errorSpy.mockRestore();
  if (warnSpy) warnSpy.mockRestore();
});
