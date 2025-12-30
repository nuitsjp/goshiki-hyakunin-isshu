import { CSV_URL, CSV_FALLBACK_URL } from './config.js';

export function parseCsvText(text, parser = window.Papa) {
  if (!parser) {
    throw new Error('PapaParseが読み込まれていません。');
  }
  const result = parser.parse(text, { header: true, skipEmptyLines: true });
  if (result.errors && result.errors.length) {
    console.warn('CSV parse errors', result.errors);
  }
  const cleanKey = key => key ? key.replace(/^\uFEFF/, '').trim() : '';
  const pickField = (row, candidates) => {
    for (const name of candidates) {
      const val = row[name] ?? row[cleanKey(name)];
      if (val) return val;
    }
    return '';
  };
  const poems = result.data.map(row => ({
    color: pickField(row, ['色', '\uFEFF色']),
    kamiNoKu: pickField(row, ['上の句']),
    shimoNoKu: pickField(row, ['下の句']),
    kamiReading: pickField(row, ['上の句読み']),
    shimoReading: pickField(row, ['下の句読み']),
    kimarijiLong: pickField(row, ['決まり字（競技かるた）']),
    kimarijiShort: pickField(row, ['決まり字（五色百人一首）']),
    hint: pickField(row, ['ヒント']),
  })).filter(p => p.color && p.shimoNoKu && p.kimarijiLong);
  if (!poems.length) {
    throw new Error('CSVから有効なデータを読み込めませんでした。');
  }
  return poems;
}

export function fetchCsv(url, fetcher = fetch) {
  return fetcher(url, { cache: 'no-cache' }).then(resp => {
    if (!resp.ok) throw new Error(`CSV取得失敗 (status ${resp.status})`);
    return resp.text();
  });
}

export function loadCsv({
  fetcher = fetch,
  location = window.location,
  parser = window.Papa
} = {}) {
  return fetchCsv(CSV_URL, fetcher)
    .catch(err => {
      console.warn('Primary CSV fetch failed, trying fallback.', err);
      if (location.protocol === 'file:' || location.hostname === 'localhost') {
        return fetchCsv(CSV_FALLBACK_URL, fetcher);
      }
      throw err;
    })
    .then(text => parseCsvText(text, parser));
}
