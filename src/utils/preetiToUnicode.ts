/**
 * Preeti Font to Unicode Nepali Converter
 *
 * Preeti is a legacy Nepali font that maps ASCII characters to Nepali glyphs.
 * This converter transforms Preeti-encoded text to proper Unicode Devanagari.
 */

// Preeti to Unicode character mapping
const PREETI_MAP: Record<string, string> = {
  // Consonants (व्यंजन)
  'S': 'श',
  'I': 'ष',
  'if': 'षा',
  's': 'स',
  'x': 'ह',
  'Q': 'क्ष',
  '1': 'ज्ञ',
  'q': 'त्र',

  // Basic consonants
  'c': 'अ',
  'cf': 'आ',
  'O': 'इ',
  'O{': 'ई',
  'p': 'उ',
  'pm': 'ऊ',
  'C': 'ऋ',
  'P': 'ए',
  'P]': 'ऐ',
  'cf]': 'ओ',
  'cf}': 'औ',

  'k': 'प',
  'K': 'फ',
  'a': 'ब',
  'e': 'भ',
  'd': 'म',

  't': 'त',
  'T': 'थ',
  'b': 'द',
  'w': 'ध',
  'g': 'न',

  '6': 'ट',
  '7': 'ठ',
  '8': 'ड',
  '9': 'ढ',
  '0': 'ण',

  'r': 'च',
  'R': 'छ',
  'h': 'ज',
  'H': 'झ',
  '~': 'ञ',

  'i': 'य',
  '/': 'र',
  'n': 'ल',
  'j': 'व',

  // Special characters
  '\\': '्',  // Halant
  '+': '्',   // Halant (alternate)
  'f': 'ा',   // Vowel sign aa
  'F': 'ँ',   // Chandrabindu
  ']': 'े',   // Vowel sign e
  '}': 'ै',   // Vowel sign ai
  '[': 'ृ',   // Vowel sign ri
  'l': 'ि',   // Vowel sign i
  'L': 'ी',   // Vowel sign ii
  'u': 'ु',   // Vowel sign u
  'U': 'ू',   // Vowel sign uu
  'f]': 'ो',  // Vowel sign o
  'f}': 'ौ',  // Vowel sign au

  // Half letters and conjuncts
  'é': '्र',
  '|': '्र',
  '«': 'रु',
  '¿': 'रू',
  '¤': 'ह्र',
  'å': 'द्व',
  'Ý': 'ट्ट',
  'ß': 'ट्ठ',
  'Î': 'ड्ड',
  'Ï': 'ड्ढ',
  'Þ': 'क्र',
  'क्र': 'क्र',
  'ª': 'ङ',

  // Numbers
  '!': '१',
  '@': '२',
  '#': '३',
  '$': '४',
  '%': '५',
  '^': '६',
  '&': '७',
  '*': '८',
  '(': '९',
  ')': '०',

  // Punctuation
  '=': '।',
  '?': 'रु',
  '_': ')',
  '.': '।',
  ',': ',',
  ';': ';',
  ':': ':',

  // Additional mappings
  'D': 'ं',   // Anusvara
  'M': 'ः',   // Visarga
  'v': 'ख',
  'V': 'ख्',
  'y': 'य',
  'Y': 'य्',
  'z': 'श',
  'Z': 'श्',
  'N': 'ण्',
  'G': 'घ',
  'W': 'ध्',
  'o': 'अ',
  'm': 'ू',

  // More consonants
  '-': '-',
  "'": '्',
  '"': '"',
  '–': '-',
  '\u2018': '\u2018', // Left single quote
  '\u2019': '\u2019', // Right single quote
};

// Special multi-character sequences (order matters - longer sequences first)
const SPECIAL_SEQUENCES: [string, string][] = [
  // Vowel combinations
  ['cf}', 'औ'],
  ['cf]', 'ओ'],
  ['cf', 'आ'],
  ['O{', 'ई'],
  ['P]', 'ऐ'],
  ['pm', 'ऊ'],

  // Vowel signs
  ['f}', 'ौ'],
  ['f]', 'ो'],
  ['f', 'ा'],

  // Conjuncts
  ['Qm', 'क्म'],
  ['Qn', 'क्ल'],
  ['Qj', 'क्व'],
  ['Sb', 'ख्य'],
  ['Ub', 'घ्य'],
  ['ª\\', 'ङ्'],
  ['ª\u094d', 'ङ्'],
  ['¨', 'ङ्ग'],
  ['ª', 'ङ'],

  ['~r', 'ञ्च'],
  ['~h', 'ञ्ज'],
  ['¬', 'ञ्'],

  ['§', 'ट्ठ'],
  ['¶', 'ड्ढ'],
  ['·', 'द्द'],
  ['¸', 'द्ध'],

  ['Ab', 'द्य'],
  ['Ad', 'द्म'],
  ['Aj', 'द्व'],
  ['Bb', 'द्ध्य'],

  ['To', 'थ्य'],

  ['¡', 'ज्ञ'],
  ['1', 'ज्ञ'],
  ['´', 'झ्'],

  ['°', 'क्त'],
  ['±', 'क्र'],
  ['²', 'क्ष'],
  ['µ', 'द्र'],
  ['¹', 'श्र'],
  ['º', 'स्र'],
  ['»', 'ह्य'],
  ['¼', 'ह्र'],
  ['½', 'ह्व'],
  ['¾', 'ह्म'],

  ['Ø', 'र्'],  // Repha
  ['{', 'ै'],
  ['[', 'ृ'],

  // Two-char conjuncts
  ['ß', 'ट्ठ'],
  ['Î', 'ड्ड'],
  ['Þ', 'क्र'],
  ['Ý', 'ट्ट'],
];

// Repha handling - र् that appears before consonants
const REPHA_CHAR = 'Ø';

/**
 * Check if text appears to be Preeti encoded
 * Preeti text contains ASCII characters that don't make sense as English
 */
export function isPreetiEncoded(text: string): boolean {
  if (!text || text.length === 0) return false;

  // If it already contains Devanagari, it's not Preeti
  if (/[\u0900-\u097F]/.test(text)) return false;

  // Check for common Preeti patterns
  const preetiPatterns = [
    /[cfgjdknetbwhrls]{2,}/i,  // Multiple consonant mappings together
    /[f\]}\[luU]/,              // Vowel signs in Preeti
    /[!@#$%^&*()]/,             // Numbers in Preeti
    /[QSIGTWPOKL]/,             // Capital letters used in Preeti
    /\//,                        // र (ra) character
  ];

  // Count matches
  let matchCount = 0;
  for (const pattern of preetiPatterns) {
    if (pattern.test(text)) matchCount++;
  }

  // If at least 2 patterns match, likely Preeti
  return matchCount >= 2;
}

/**
 * Convert Preeti encoded text to Unicode Nepali
 */
export function convertPreetiToUnicode(text: string): string {
  if (!text) return text;

  let result = text;

  // First, handle special multi-character sequences
  for (const [preeti, unicode] of SPECIAL_SEQUENCES) {
    result = result.split(preeti).join(unicode);
  }

  // Handle repha (र्) - it comes before the consonant in Preeti but after in Unicode
  // This is complex and handled separately
  result = handleRepha(result);

  // Now replace single characters
  let output = '';
  for (let i = 0; i < result.length; i++) {
    const char = result[i];

    // Check for two-character combinations first
    if (i < result.length - 1) {
      const twoChar = char + result[i + 1];
      if (PREETI_MAP[twoChar]) {
        output += PREETI_MAP[twoChar];
        i++; // Skip next character
        continue;
      }
    }

    // Single character mapping
    if (PREETI_MAP[char]) {
      output += PREETI_MAP[char];
    } else {
      output += char;
    }
  }

  // Post-processing: fix vowel sign positioning
  output = fixVowelSigns(output);

  return output;
}

/**
 * Handle repha (र्) positioning
 * In Preeti, repha comes before the consonant, in Unicode it comes after
 */
function handleRepha(text: string): string {
  // Repha in Preeti is typically 'Ø' or similar
  // It should move to after the following consonant cluster
  return text.replace(/Ø([क-ह])/g, '$1र्');
}

/**
 * Fix vowel sign positioning
 * इ-कार (ि) should come before the consonant in display but after in storage
 */
function fixVowelSigns(text: string): string {
  // The ि vowel sign in Unicode comes after the consonant in storage
  // but displays before it. This is handled automatically by Unicode.

  // Fix any double vowel signs
  text = text.replace(/ा{2,}/g, 'ा');
  text = text.replace(/ि{2,}/g, 'ि');
  text = text.replace(/ी{2,}/g, 'ी');
  text = text.replace(/ु{2,}/g, 'ु');
  text = text.replace(/ू{2,}/g, 'ू');
  text = text.replace(/े{2,}/g, 'े');
  text = text.replace(/ै{2,}/g, 'ै');
  text = text.replace(/ो{2,}/g, 'ो');
  text = text.replace(/ौ{2,}/g, 'ौ');

  return text;
}

/**
 * Convert text - auto-detects if Preeti and converts, otherwise returns as-is
 */
export function autoConvertToNepali(text: string): { original: string; nepali: string; wasPreeti: boolean } {
  if (!text) {
    return { original: text, nepali: text, wasPreeti: false };
  }

  // Check if already Devanagari
  if (/[\u0900-\u097F]/.test(text)) {
    return { original: text, nepali: text, wasPreeti: false };
  }

  // Check if likely Preeti
  if (isPreetiEncoded(text)) {
    const converted = convertPreetiToUnicode(text);
    return { original: text, nepali: converted, wasPreeti: true };
  }

  // Return as-is (might be English or other)
  return { original: text, nepali: text, wasPreeti: false };
}
