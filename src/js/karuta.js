/**
 * Karuta card-matching game logic
 */

const shuffle = (array, random = Math.random) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Build a deck of 20 karuta cards for the specified color
 * @param {Object} params - Parameters
 * @param {Array} params.poems - All poems
 * @param {string} params.color - Color to filter by
 * @param {Function} params.random - Random function for shuffling
 * @returns {Array} Array of 20 card objects with state
 */
export function buildKarutaDeck({ poems, color, random = Math.random }) {
  const allPoems = Array.isArray(poems) ? poems : [];
  const poemsByColor = allPoems.filter(poem => poem.color === color);

  if (poemsByColor.length < 20) {
    throw new Error(`指定の色に20枚の歌が見つかりません: ${color}`);
  }

  const selected = shuffle(poemsByColor, random).slice(0, 20);

  return selected.map(poem => ({
    kimariji: poem.kimarijiLong || poem.kimarijiShort || '決まり字なし',
    shimoNoKu: poem.shimoNoKu,
    shimoReading: poem.shimoReading,
    kamiNoKu: poem.kamiNoKu,
    kamiReading: poem.kamiReading,
    state: 'active', // 'active', 'taken', 'wrong'
  }));
}

/**
 * Build a list of 20 reading cards (upper poems) in shuffled order
 * @param {Object} params - Parameters
 * @param {Array} params.poems - All poems
 * @param {string} params.color - Color to filter by
 * @param {Function} params.random - Random function for shuffling
 * @returns {Array} Array of 20 reading objects
 */
export function buildKarutaReadings({ poems, color, random = Math.random }) {
  const allPoems = Array.isArray(poems) ? poems : [];
  const poemsByColor = allPoems.filter(poem => poem.color === color);

  if (poemsByColor.length < 20) {
    throw new Error(`指定の色に20枚の歌が見つかりません: ${color}`);
  }

  const selected = shuffle(poemsByColor, random).slice(0, 20);

  return selected.map(poem => ({
    kimariji: poem.kimarijiLong || poem.kimarijiShort || '決まり字なし',
    kamiNoKu: poem.kamiNoKu,
    kamiReading: poem.kamiReading,
    hint: poem.hint,
  }));
}

/**
 * Check if a card matches the current reading
 * @param {Object} reading - Current reading card
 * @param {Object} card - Card to check
 * @returns {boolean} True if match, false otherwise
 */
export function checkKarutaMatch(reading, card) {
  return reading.kimariji === card.kimariji;
}
