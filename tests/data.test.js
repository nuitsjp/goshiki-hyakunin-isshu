import { describe, expect, it, vi } from 'vitest';
import { fetchCsv, loadCsv, parseCsvText } from '../src/js/data.js';

describe('data', () => {
  it('parseCsvText throws when parser is missing', () => {
    expect(() => parseCsvText('a')).toThrow(/PapaParse/);
  });

  it('parseCsvText maps fields and filters invalid rows', () => {
    const parser = {
      parse: vi.fn(() => ({
        data: [
          {
            '\uFEFF色': '青',
            '上の句': '上の句1',
            '下の句': '下の句1',
            '上の句読み': 'かみ1',
            '下の句読み': 'しも1',
            '決まり字（競技かるた）': 'あ',
            '決まり字（五色百人一首）': '',
            'ヒント': 'ひ1',
          },
          {
            '色': '青',
            '上の句': '上の句2',
            '下の句': '',
            '決まり字（五色百人一首）': 'い',
          },
        ],
        errors: [],
      })),
    };

    const poems = parseCsvText('dummy', parser);
    expect(poems).toHaveLength(1);
    expect(poems[0]).toMatchObject({
      color: '青',
      kamiNoKu: '上の句1',
      shimoNoKu: '下の句1',
      kamiReading: 'かみ1',
      shimoReading: 'しも1',
      kimarijiLong: 'あ',
      kimarijiShort: '',
      hint: 'ひ1',
    });
  });

  it('parseCsvText throws when no valid rows', () => {
    const parser = {
      parse: vi.fn(() => ({
        data: [
          {
            '色': '',
            '上の句': '',
            '下の句': '',
            '決まり字（五色百人一首）': '',
          },
        ],
        errors: [],
      })),
    };

    expect(() => parseCsvText('dummy', parser))
      .toThrow(/CSVから有効なデータを読み込めません/);
  });

  it('parseCsvText warns on parse errors', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const parser = {
      parse: vi.fn(() => ({
        data: [
          {
            '色': '青',
            '上の句': '上',
            '下の句': '下',
            '決まり字（競技かるた）': 'あ',
          },
        ],
        errors: [{ message: 'err' }],
      })),
    };

    parseCsvText('dummy', parser);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('fetchCsv resolves text when response is ok', async () => {
    const fetcher = vi.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve('csv'),
    }));
    const text = await fetchCsv('https://example.com/csv', fetcher);
    expect(text).toBe('csv');
  });

  it('fetchCsv throws when response is not ok', async () => {
    const fetcher = vi.fn(() => Promise.resolve({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    }));
    await expect(fetchCsv('https://example.com/csv', fetcher))
      .rejects
      .toThrow(/status 500/);
  });

  it('loadCsv falls back for local protocol', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('csv'),
      });
    const parser = {
      parse: vi.fn(() => ({
        data: [
          {
            '色': '青',
            '上の句': '上',
            '下の句': '下',
            '決まり字（競技かるた）': 'あ',
          },
        ],
        errors: [],
      })),
    };

    const poems = await loadCsv({
      fetcher,
      location: { protocol: 'file:', hostname: 'localhost' },
      parser,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(poems).toHaveLength(1);
  });

  it('loadCsv rethrows error when not local protocol', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('primary failed'));
    await expect(loadCsv({
      fetcher,
      location: { protocol: 'https:', hostname: 'example.com' },
      parser: { parse: vi.fn() },
    })).rejects.toThrow(/primary failed/);
  });
});
