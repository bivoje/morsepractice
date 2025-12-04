export type MorseMap = Record<string, string>;

const DEFAULT_MORSE: MorseMap = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..',

    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',

    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
    '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
    ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
    '"': '.-..-.', '$': '...-..-', '@': '.--.-.', ' ': '/',

    // prosigns
    'AR': '.-.-.', // end of message
    'AS': '.-...', // wait
    'BT': '-...-', // new paragraph
    'SK': '...-.-', // end of contact
    'HH': '........', // error
    'CT': '-.-.-', // start copying
    'RN': '.-.-.', // next message follows



};

/**
 * MorseDecode decodes morse text (dot/dash strings) and can parse timed pulse sequences.
 *
 * Usage:
 *   const d = new MorseDecode();
 *   d.decode('.- -... / -.-'); // 'AB K'
 *
 *   // decode timed pulses (alternating on/off durations in ms, starting with 'on'):
 *   const text = d.decodeTimed([100,100,300,100,100,700], 100);
 */
export class MorseDecode {
  tree: (string | null)[] = [];

  constructor(map?: MorseMap) {
    this.installMap(map ?? DEFAULT_MORSE);
  }

  // create binary search tree from map
  installMap(map: MorseMap) {
    const maxLen = Math.max(...Object.values(map).map(code => code.length));
    const size = Math.pow(2, maxLen + 1) - 1;
    let tree = new Array<string | null>(size).fill(null);

    for (const [char, code] of Object.entries(map)) {
      let index = 0;
      for (const symbol of code) {
        if (symbol === '.') {
          index = 2 * index + 1;
        } else if (symbol === '-') {
          index = 2 * index + 2;
        } else {
          throw new Error(`invalid Morse symbol: ${symbol}`);
        }
      }
      tree[index] = char;
    }
    this.tree = tree;
  }


  // decode a code into letter
  decode(code: string): string | null {
    let index = 0;
    for (const symbol of code) {
      if (symbol === '.') {
        index = 2 * index + 1;
      } else if (symbol === '-') {
        index = 2 * index + 2;
      } else {
        throw new Error(`invalid Morse symbol: ${symbol}`);
      }
    }
    return this.tree[index];
  }
}

class MorseDecodeTimed extends MorseDecode {
  ditDuration: number; // in ms

  constructor(ditDuration: number, map?: MorseMap) {
    super(map);
    this.ditDuration = ditDuration;
  }

  // decode timed input and emit letters if complete
  input(pressed: boolean) : string | null {
    return null;
  }

}


/**
 * Compute words-per-minute (WPM) from typed words and duration in seconds.
 * Uses the common definition where 1 word = 5 characters (WPM for typed text).
 * @param words array of typed words (strings)
 * @param seconds elapsed time in seconds
 * @returns wpm (float)
 */
export function wpmCalc(words: string[], seconds: number): number {
    let ditCount = 0;
    for (const w of words) {
        for (const c of w) {
            const cUpper = c.toUpperCase();
            if (cUpper in DEFAULT_MORSE) {
                const code = DEFAULT_MORSE[cUpper];
                for (const s of code) {
                    if (s === '.') ditCount += 1;
                    else if (s === '-') ditCount += 3;
                }
                ditCount += (code.length - 1) * 1; // intra-character gaps
            } else {
                // print warning
                console.warn(`wpmCalc: character '${c}' not in Morse map`);
            }
        }
        ditCount += (w.length - 1) * 3; // inter-character gaps
    }
    ditCount += (words.length - 0) * 7; // inter-word gaps

    const ditspeed = ditCount / seconds; // dits per second
    const wpm = (ditspeed * 60) / 50; // 1 WPM = 50 dits per minute
    return wpm;
}

export default MorseDecode;
