import { afterEach, beforeEach, vi } from 'vitest';

let errorSpy;
let warnSpy;
let logSpy;
let infoSpy;
let debugSpy;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  if (errorSpy) errorSpy.mockRestore();
  if (warnSpy) warnSpy.mockRestore();
  if (logSpy) logSpy.mockRestore();
  if (infoSpy) infoSpy.mockRestore();
  if (debugSpy) debugSpy.mockRestore();
});
