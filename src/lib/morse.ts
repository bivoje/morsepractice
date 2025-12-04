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

export type InputResult = { char: string, offTimer: number, };

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
  private offTimerHandle: number | null = null;
  protected oncallback: () => void;
  protected offcallback: () => void;
  protected emitcallback: (ch: string) => void;
  protected ditDuration: number; // in ms

  constructor(oncallback: () => void, offcallback: () => void, emitcallback: (ch: string) => void) {
    this.installMap(DEFAULT_MORSE);
    this.oncallback = oncallback;
    this.offcallback = offcallback;
    this.emitcallback = emitcallback;
    this.ditDuration = 100;
  }

  input(key: string, pressed: boolean): void {
    throw new Error('MorseDecode.input() not implemented');
  }

  setOffTimer(timeMs: number | null = null): void {
    if (this.offTimerHandle !== null) {
      clearTimeout(this.offTimerHandle);
      this.offTimerHandle = null;
    }
    if (timeMs !== null) {
      this.offTimerHandle = setTimeout(() => {
        this.offTimerHandle = null;
        this.input('', false);
      }, timeMs);
    }
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

  forceEmit(): void {
    const ch = this.resetIndex()
    if (ch) this.emitcallback(ch);
  }

  setWPM(wpm: number): void {
    this.ditDuration = 1200 / wpm; // in ms
  }
}

export class MorseDecodeDouble extends MorseDecode {

  input(key: string, pressed: boolean): void {
    if (pressed) {
      if (key === '.') {
        this.commitDot();
      } else {
        this.commitDash();
      }
    }
  }
}

export class MorseDecodeTimed extends MorseDecode {
  // state for timed input
  private lastTime: number | null = null;
  private state: 'idle' | 'on' | 'code' | 'word' = 'idle';

  forceEmit(): void {
    super.forceEmit();
    this.state = 'idle';
  }

  /*     press / release
  idle   goto 'on' / ignore
    on   ignore / commit dot/dash, go to code; set timer
  code   goto 'on' / goto code or emit letter, goto word; set timer
  word   goto 'on' / goto word or emit space, goto idle; set timer
  */
  input(key: string, pressed: boolean): void {
    const now = Date.now();

    // first transition: just record state
    if (this.lastTime === null) {
      this.lastTime = now;
      return;
    }

    const duration = now - this.lastTime;

    if (pressed) {
      this.setOffTimer(null); // clear existing timer
    }

    if (this.state === 'idle') {
      if (pressed) {
        this.state = 'on';
        this.lastTime = now;
        this.oncallback();
      }

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
      this.setOffTimer(this.ditDuration * 3);

    } else if (this.state === 'code') {
      // measure OFF duration
      if (duration >= this.ditDuration * 3) { // letter gap
        let ch = this.resetIndex();
        if (ch) this.emitcallback(ch);
        this.state = 'word';
        this.setOffTimer(this.ditDuration * 7 - duration);
      }
      if (duration >= this.ditDuration * 7) { // word gap
        this.emitcallback(' ');
        this.state = 'idle';
      }
      if (pressed) {
        this.state = 'on';
        this.lastTime = now;
        this.oncallback();
      }

    } else if (this.state === 'word') {
      if (duration >= this.ditDuration * 7) { // word gap
        this.state = 'idle';
        this.emitcallback(' ');
      }
      if (pressed) {
        this.state = 'on';
        this.lastTime = now;
        this.oncallback();
      }

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
      } else if (c === ' ') {
        ditCount += 7;
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
