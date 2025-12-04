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
    '"': '.-..-.', '$': '...-..-', '@': '.--.-.',

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

  dumpTree(): void {
    console.log(this.tree);
  }

  index: number = 0;

  resetIndex() : string | null {
    const ch = this.tree[this.index];
    this.index = 0;
    return ch;
  }
  inputDot() {
    this.index = 2 * this.index + 1;
  }
  inputDash() {
    this.index = 2 * this.index + 2;
  }
  showIndex() : string {
    let code = '';
    let index = this.index;
    while (index > 0) {
      if (index % 2 === 1) {
        code += '.';
      } else {
        code += '-';
      }
      index = Math.floor((index - 1) / 2);
    }
    return code.split('').reverse().join('');
  }
}

class MorseDecodeTimed extends MorseDecode {
  ditDuration: number; // in ms
  // state for timed input
  private lastTime: number | null = null;
  private state: 'idle' | 'on' | 'code' | 'word' = 'idle';

  constructor(ditDuration: number, map?: MorseMap) {
    super(map);
    this.ditDuration = ditDuration;
  }

  /*     press / release
  idle   goto 'on' / ignore
    on   ignore / commit dot/dash, go to code; set timer
  code   goto 'on' / goto code or emit letter, goto word; set timer
  word   goto 'on' / goto word or emit space, goto idle; set timer
  */
  input(pressed: boolean) : string {
    const now = Date.now();

    // first transition: just record state
    if (this.lastTime === null) {
      this.lastTime = now;
      return '';
    }

    const duration = now - this.lastTime;

    if (this.state === 'idle') {
      if (pressed) {
        this.state = 'on';
        this.lastTime = now;
      }
      return '';

    } else if (this.state === 'on') {
      if (!pressed) {
        // measure ON duration
        if (duration < this.ditDuration * 2) {
          this.inputDot();
        } else {
          this.inputDash();
        }
        this.state = 'code';
        this.lastTime = now;
      }
      return '';

    } else if (this.state === 'code') {
      if (pressed) {
        this.state = 'on';
        this.lastTime = now;
      } else {
        // measure OFF duration
        let ch = '';
        if (duration >= this.ditDuration * 3) { // letter gap
          ch += this.resetIndex();
          this.state = 'word';
        }
        if (duration >= this.ditDuration * 7) { // word gap
          ch += ' ';
          this.state = 'idle';
        }
        return ch;
      }
      return '';

    } else if (this.state === 'word') {
      if (pressed) {
        this.state = 'on';
        this.lastTime = now;
      } else {
        // measure OFF duration
        if (duration >= this.ditDuration * 7) { // word gap
          this.state = 'idle';
          return ' ';
        }
      }
      return '';

    } else {
      throw new Error(`invalid state: ${this.state}`);
    }
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

export type InputMethod = 'raw' | 'straight' | 'side' | 'paddle' | 'iambic';

/**
 * MorseInput provides a small dispatcher to handle different input methods.
 * - 'raw': returns keys directly
 * - 'side': uses a `MorseDecode` instance and the caller should invoke
 *           `inputDot()` / `inputDash()` when appropriate; call `endLetter()` to
 *           emit the decoded character for the sequence typed so far.
 * Other methods are placeholders and will return null until implemented.
 */
export class MorseInput {
  method: InputMethod;
  decode: MorseDecode;

  constructor(method: InputMethod = 'raw', map?: MorseMap) {
    this.method = method;
    this.decode = new MorseDecode(map);
  }

  setMethod(m: InputMethod) {
    this.method = m;
    // reset decode state when switching to a morse-driven method
    if (m === 'side' || m === 'paddle' || m === 'iambic') {
      this.decode.resetIndex();
    }
  }

  // Generic per-key input dispatcher. Returns a string when an emitted
  // character is available (for methods that produce decoded letters), or
  // null otherwise. For 'raw' method this simply returns the key.
  inputKey(key: string): string {
    if (this.method === 'raw') {
      if (key === 'Backspace') {
        return '\b';
      }
      return key;

    } else if (this.method === 'side') {
      // convention: 'j' -> dot, 'k' -> dash, space/Enter -> end letter
      if (key === 'j') {
        this.inputDot();
        return '';
      }
      if (key === 'k') {
        this.inputDash();
        return '';
      }
      if (key === ' ' || key === 'Enter') {
        return this.endLetter() || '';
      }
      return '';
    }

    // unimplemented methods return null for now
    return '';
  }

  // Called by side/paddle/iambic style handlers when a dot input occurs.
  inputDot(): void {
    this.decode.inputDot();
  }

  // Called by side/paddle/iambic style handlers when a dash input occurs.
  inputDash(): void {
    this.decode.inputDash();
  }

  // Signals end of a character; decodes the buffered traversal index into a
  // character (or null) and resets the index for the next letter.
  endLetter(): string | null {
    // resetIndex returns the character at the current traversal index, if any,
    // and resets the traversal index to the root.
    return this.decode.resetIndex();
  }
}
