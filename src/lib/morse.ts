import { on } from "svelte/events";

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
  private tree: (string | null)[] = [];
  protected oncallback: () => void;
  protected offcallback: () => void;

  constructor(oncallback: () => void, offcallback: () => void) {
    this.installMap(DEFAULT_MORSE);
    this.oncallback = oncallback;
    this.offcallback = offcallback;
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
  commitDot() {
    this.index = 2 * this.index + 1;
  }
  commitDash() {
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

    const ch = this.tree[this.index];
    return (ch ?? '?') + ' ' + code.split('').reverse().join('');
  }

  setWPM(wpm: number) {
    // placeholder
  }
}

class MorseDecodeDouble extends MorseDecode {
}

class MorseDecodeTimed extends MorseDecode {
  ditDuration: number; // in ms
  // state for timed input
  private lastTime: number | null = null;
  private state: 'idle' | 'on' | 'code' | 'word' = 'idle';

  constructor(oncallback: () => void, offcallback: () => void) {
    super(oncallback, offcallback);
    this.ditDuration = 100;
  }

  setWPM(wpm: number) {
    this.ditDuration = 1200 / wpm; // in ms
  }

  /*     press / release
  idle   goto 'on' / ignore
    on   ignore / commit dot/dash, go to code; set timer
  code   goto 'on' / goto code or emit letter, goto word; set timer
  word   goto 'on' / goto word or emit space, goto idle; set timer
  */
  input(pressed: boolean) : string {
    console.log(`input(${pressed}), state=${this.state}`);
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
        this.oncallback();
      }
      return '';

    } else if (this.state === 'on') {
      if (!pressed) {
        // measure ON duration
        if (duration < this.ditDuration * 2) {
          this.commitDot();
        } else {
          this.commitDash();
        }
        this.state = 'code';
        this.lastTime = now;
        this.offcallback();
      }
      return '';

    } else if (this.state === 'code') {
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
      if (pressed) {
        this.state = 'on';
        this.lastTime = now;
        this.oncallback();
      }
      return ch;

    } else if (this.state === 'word') {
      let ch = '';
      if (duration >= this.ditDuration * 7) { // word gap
        this.state = 'idle';
        ch = ' ';
      }
      if (pressed) {
        this.state = 'on';
        this.lastTime = now;
        this.oncallback();
      }
      return ch;

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
 * - 'side': uses a `MorseDecodeDouble` instance and the caller should invoke
 *           `commitDot()` / `commitDash()` when appropriate; call `endLetter()` to
 *           emit the decoded character for the sequence typed so far.
 * Other methods are placeholders and will return null until implemented.
 */
export class MorseInput {
  method: InputMethod;
  decodeSide: MorseDecodeDouble;
  decodeStraight : MorseDecodeTimed;

  constructor(method: InputMethod, oncallback: () => void, offcallback: () => void) {
    this.method = method;
    this.decodeSide = new MorseDecodeDouble(oncallback, offcallback);
    this.decodeStraight = new MorseDecodeTimed(oncallback, offcallback);
  }

  setMethod(m: InputMethod) {
    this.method = m;
    // reset decode state when switching to a morse-driven method
    this.decodeSide.resetIndex();
    this.decodeStraight.resetIndex();
  }

  showIndex() : string {
    if (this.method === 'side') {
      return this.decodeSide.showIndex();
    } else if (this.method === 'straight') {
      return this.decodeStraight.showIndex();
    }
    return '';
  }

  // Generic per-key input dispatcher. Returns a string when an emitted
  // character is available (for methods that produce decoded letters), or
  // null otherwise. For 'raw' method this simply returns the key.
  inputKey(key: string, pressed: boolean): string {
    if (this.method === 'raw') {
      if (key === 'Backspace') {
        return '\b';
      }
      return key;

    } else if (this.method === 'side') {
      if (!pressed) return '';
      if (key === 'j') {
        this.decodeSide.commitDot();
        return '';
      }
      if (key === 'k') {
        this.decodeSide.commitDash();
        return '';
      }
      if (key === ' ' || key === 'Enter') {
        return this.decodeSide.resetIndex() || '';
      }
      return '';

    } else if (this.method === 'straight') {
      if (key === ' ' || key === 'Enter') {
        return this.decodeStraight.resetIndex() || '';
      }
      return this.decodeStraight.input(pressed);

    } else if (this.method === 'paddle') {
      // unimplemented methods return null for now
      return '';
    } else if (this.method === 'iambic') {
      // unimplemented methods return null for now
      return '';

    } else {
      throw new Error(`invalid input method: ${this.method}`);
    }
  }
}
