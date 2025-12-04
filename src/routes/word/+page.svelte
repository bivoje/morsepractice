<script lang="ts">
  import { onMount } from 'svelte';
    import { wpmCalc, MorseInput } from '../../lib/morse';
    import type { InputMethod } from '../../lib/morse';

  // Default word list — replace or extend later
  let words: string[] = [];

  let typed: string = $state(''); // letters the user has typed correctly for current word
  let wrongIndex: number = $state(-1); // temporarily mark the index that was typed incorrectly
  let wrongTimeout: number | undefined;
  type HistoryEntry = { idx: number; word: string; startedAt: number | null; endedAt: number | null };

  // History: previous words with timestamps (first input)
  let history: HistoryEntry[] = $state([]);

  // number of previous words to keep in memory (adjustable)
  let prevCount: number = $state(5);

  let random: boolean = $state(false);

  let currentCode: string = $state(''); // current morse code buffer display

  // whether to show the current morse buffer in the UI
  let showMorse: boolean = $state(true);

  function toggleShowMorse() {
    showMorse = !showMorse;
  }

  function morseOncallback() {
    morseOn = true;
    startBeep();
  }

  function morseOffcallback() {
    morseOn = false;
    stopBeep();
  }

  // visual flag: true during a morse 'on' event (used to tint background)
  let morseOn: boolean = $state(false);
  // WebAudio: use a persistent oscillator and control gain for low-latency toggles.
  // Creating/stopping an oscillator repeatedly adds latency and can drop clicks when toggled rapidly.
  let _audioCtx: AudioContext | null = null;
  let _osc: OscillatorNode | null = null;
  let _gain: GainNode | null = null;
  let _audioInitialized = false;

  function ensureAudio(): AudioContext | null {
    if (_audioCtx) return _audioCtx;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
    return _audioCtx;
  }

  // Initialize oscillator/gain once and keep oscillator running. startBeep/stopBeep will only adjust gain.
  async function initAudioOnce() {
    const ctx = ensureAudio();
    if (!ctx) return null;
    if (_audioInitialized) return ctx;
    _gain = ctx.createGain();
    // keep it effectively silent initially
    _gain.gain.value = 0.000001;
    _gain.connect(ctx.destination);

    _osc = ctx.createOscillator();
    _osc.type = 'sine';
    _osc.frequency.value = 600;
    _osc.connect(_gain);
    try {
      _osc.start();
    } catch (e) {
      // start may throw if not allowed yet; we'll still mark initialized so further resume/start attempts don't duplicate
      console.warn('oscillator start warning', e);
    }
    _audioInitialized = true;
    return ctx;
  }

  // Pre-initialize audio on first user gesture to satisfy browser autoplay/user-gesture policies.
  if (typeof window !== 'undefined') {
    const _unlockAudio = async () => {
      try { await initAudioOnce(); } catch (e) { /* ignore */ }
      window.removeEventListener('pointerdown', _unlockAudio);
      window.removeEventListener('keydown', _unlockAudio);
    };
    window.addEventListener('pointerdown', _unlockAudio, { once: true });
    window.addEventListener('keydown', _unlockAudio, { once: true });
  }

  async function startBeep() {
    try {
      const ctx = await initAudioOnce();
      if (!ctx || !_gain) return;
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (e) { /* ignore */ }
      }
      const t = ctx.currentTime;
      // cancel any scheduled values and ramp quickly (fast attack)
      _gain.gain.cancelScheduledValues(t);
      const from = Math.max(0.000001, _gain.gain.value || 0.000001);
      _gain.gain.setValueAtTime(from, t);
      _gain.gain.linearRampToValueAtTime(0.08, t + 0.005);
    } catch (err) {
      console.error('startBeep error', err);
    }
  }

  function stopBeep() {
    try {
      const ctx = _audioCtx;
      if (!ctx || !_gain) return;
      const t = ctx.currentTime;
      _gain.gain.cancelScheduledValues(t);
      _gain.gain.setValueAtTime(_gain.gain.value, t);
      // quick release but not instant to avoid zipper artifacts
      _gain.gain.linearRampToValueAtTime(0.000001, t + 0.01);
      // keep oscillator running for next start to ensure minimal latency
    } catch (err) {
      console.error('stopBeep error', err);
    }
  }

  // input method: raw | straight | side | paddle | iambic
  const morseInput = new MorseInput('straight', morseOncallback, morseOffcallback);

  // words-per-minute control for timed morse input
  let wpm: number = $state(20);

  // Explicit updater for WPM — avoids Svelte reactive statements that are
  // disallowed in the current 'runes' mode. Call on slider input/change.
  function applyWpm() {
    try {
      morseInput.decodeStraight.setWPM(wpm);
      morseInput.decodeSide.setWPM(wpm);
    } catch (e) {
      // ignore if decoders not present
    }
  }

  // Apply initial WPM immediately
  applyWpm();

  let averageWPM: string = $state('0.0');
  let wpmInterval = setInterval(() => {
    if (history.length < 2) {
      averageWPM = '0.0';
    } else {
      let hist = history.slice(0, history.length - 2);
      const duration = Date.now() - history[0].startedAt!;
      averageWPM = wpmCalc(hist.map(h => h.word), duration / 1000).toFixed(1);
    }
  }, 500);

  function toggleRandom() {
    random = !random;
    init();
  }

  function nextWord() {
    let idx = history.length ? history[history.length - 1].idx : -1;
    let newIdx = idx;
    // pick next word
    if (random && words.length > 1) {
      while (newIdx === idx) {
        newIdx = Math.floor(Math.random() * words.length);
      }
    } else {
      newIdx = (idx + 1) % words.length;
    }

    // record current word into history with start/completion timestamps
    history.push({ idx: newIdx, word: words[newIdx], startedAt: null, endedAt: null });
    trimHistory();

    typed = '';
    wrongIndex = -1;
  }

  let offTimerHandle: number | null = null;

  function setOffTimer(timeMs: number | null = null) {
    console.log(`set off timer: ${timeMs} ms`);
    if (offTimerHandle !== null) {
      clearTimeout(offTimerHandle);
      offTimerHandle = null;
    }
    if (timeMs !== null) {
      offTimerHandle = setTimeout(() => {
        console.log(`off timer expired (${timeMs} ms)`);
        offTimerHandle = null;
        callMorseInput('', false);
      }, timeMs);
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.repeat) return;

    // ignore modifier-only keys
    if ((e as any).ctrlKey || (e as any).altKey || (e as any).metaKey) return;
    const key = (e as KeyboardEvent).key;

    if (e.type === 'keydown') {
      setOffTimer(null);
    }

    callMorseInput(key, e.type === 'keydown');
  }

  function callMorseInput(key: string, pressed: boolean) {
    const out = morseInput.inputKey(key, pressed);
    console.log(`key ${pressed ? 'down' : 'up'}: ${key} -> morse output: "${out}"`);

    if (out.offTimer) {
      setOffTimer(out.offTimer);
    }

    // out may be a single character (or space). Feed each character into letterInput
    for (const ch of Array.from(out.char)) {
      letterInput(ch);
    }
    currentCode = morseInput.showIndex();
  }

  function letterInput(letter: string) {
    console.assert(history.length >= 2, 'no current word in history');

    if (letter === '\b') {
      if (typed.length > 0) {
        typed = typed.slice(0, -1);
      }
      wrongIndex = -1;
      return;
    }

    console.assert(letter.length === 1, 'letterInput called with non-letter');
    let currentWord = history[history.length - 2].word;
    const char = letter.toLowerCase();
    const expected = currentWord[typed.length].toLowerCase();

    // record first typing timestamp
    if (history[history.length - 2].startedAt === null && typed.length === 0) {
      history[history.length - 2].startedAt = Date.now();
    }

    if (char === expected) {
      typed += char;
      // completed word -> short delay then next
      if (typed.length === currentWord.length) {
        history[history.length - 2].endedAt = Date.now();
        // record completion timestamp
        nextWord();
      }
    } else {
      // wrong letter: flicker red at current position briefly
      wrongIndex = typed.length;
      if (wrongTimeout) clearTimeout(wrongTimeout);
      wrongTimeout = window.setTimeout(() => {
        wrongIndex = -1;
      }, 180);
    }
  }

  function trimHistory() {
    while (history.length > prevCount+2) history.shift();
  }

  // Drag & drop state/handlers: log dropped file path(s)
  let dragging: boolean = $state(false);

  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    dragging = true;
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    dragging = false;
  }

  // https://www.reddit.com/r/tauri/comments/1kswzv0/comment/mtp1q9p/
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const dt = e.dataTransfer;
    if (!dt) return;

    // get the file contents from the first dropped file
    if (dt.files.length > 0) {
      const file = dt.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          const newWords = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
          init(newWords);
        }
      };
      reader.readAsText(file);
    }
  }

  function calcHistoryWPM(entry: HistoryEntry): string {
    if (entry.startedAt === null) return '';
    const start = entry.startedAt;
    let end = entry.endedAt ?? Date.now();
    const durationSec = (end - start) / 1000;
    return wpmCalc([entry.word], durationSec).toFixed(1);
  }

  import { open } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';

  async function loadFile(): Promise<void> {
    try {
      // @ts-ignore: dynamic import - available in Tauri runtime
      const path: string | string[] | null = await open({
        multiple: false,
        directory: false,
      });
      if (path && typeof path === 'string') {
        const newWords: string[] = await invoke<string[]>('load_wordserver_from_path', { path });
        init(newWords);
      }
    } catch (err) {
      alert('Error loading word file: ' + String(err) );
    }
  }

  onMount(() => {
    // svelte:window handles the keydown listener; nothing else required here

    // invoke load_wordserver_from_path with no path to get default words then init with it
    invoke<string[]>('load_wordserver_from_path', { path: null }).then((defaultWords) => {
      init(defaultWords);
    }).catch((err) => {
      // alert('Error loading default word list: ' + String(err) );
      init([]);
    });
  });

  function init(newWords: string[] | null = null) {
    if (newWords !== null) {
      if (newWords.length == 0) {
        newWords = [ 'paris', 'codex', 'th is', 'te sti ng',];
      }
      words = newWords;
    }

    // reset history
    history = [];
    typed = '';
    wrongIndex = -1;

    nextWord();
    nextWord();
  }


</script>

<svelte:window onkeydown={handleKey} onkeyup={handleKey} />

<main class="mode" ondragover={onDragOver} ondragenter={onDragEnter} ondragleave={onDragLeave} ondrop={handleDrop} class:dragging={dragging} class:morse-on={morseOn}>
  <a class="back" href="/">← Back</a>

  <section class="center">
    <h1>Word Mode</h1>
    <p class="hint">Type the letters of the word below. Correct letters turn green; wrong letters flicker red.</p>

    <div class="words-row" aria-live="polite" aria-atomic="true">
      <div class="sibling prev" aria-hidden="true">{ history.length >= 3 ? history[history.length - 3].word : '' }</div>

      <div class="word current-word">
        {#each Array.from(history.length >= 2 ? history[history.length - 2].word : '') as letter, i}
          <span
            class="letter {i < typed.length ? 'correct' : ''} {i === typed.length && wrongIndex === i ? 'wrong' : ''} {i === typed.length && wrongIndex === -1 ? 'current' : ''}"
            >{letter}</span
          >
        {/each}
      </div>

      <div class="sibling next" aria-hidden="true">{ history.length >= 1 ? history[history.length - 1].word : '' }</div>
    </div>

    {#if showMorse}
      <div class="morse-buffer" aria-hidden="true">
        <code>{currentCode}</code>
      </div>
    {/if}

    <div class="controls">
      <button onclick={loadFile} aria-label="Load a word file">Load</button>
      <button class:active={random} aria-pressed={random} onclick={toggleRandom}>Random</button>
      <button class:active={showMorse} aria-pressed={showMorse} onclick={toggleShowMorse}>Show Code</button>
      <label class="wpm-control">WPM:
        <input type="range" min="5" max="40" step="1" bind:value={wpm} oninput={applyWpm} aria-label="WPM slider" />
        <output>{wpm}</output>
      </label>
      <label class="input-method">Input:
        <select onchange={(e) => {
          console.log('setting method to', (e.target as HTMLSelectElement).value);
          morseInput.setMethod((e.target as HTMLSelectElement).value as InputMethod)
          console.log('method is now', morseInput.method, showMorse);
        }
        }>
          <option value="raw">Raw</option>
          <option value="side">Side</option>
          <option value="straight">Straight</option>
          <option value="paddle">Paddle</option>
          <option value="iambic">Iambic</option>
        </select>
      </label>
    </div>

    <div class="history" role="table" aria-label="previous words">
        <div class="history-item" role="row">
            <label class="prev-count"># prev:
                <input type="number" min="1" max="20" bind:value={prevCount} onchange={trimHistory} />
            </label>
            <div class="cell time" role="cell"><small>{averageWPM}</small></div>
        </div>
        {#each history.slice(0, history.length-2).reverse() as h}
            <div class="history-item" role="row">
                <div class="cell word" role="cell">{h.word}</div>
                <div class="cell time" role="cell"><small>{calcHistoryWPM(h)}</small></div>
            </div>
        {/each}
    </div>
  </section>
</main>

<style>
  .mode{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:28px}
  .back{position:absolute;left:18px;top:18px;color:#065fd4;text-decoration:none}
  .center{max-width:880px;text-align:center;margin-top:28px}
  h1{margin:0 0 6px}
  .hint{color:#666;margin:0 0 18px}
  .words-row{display:flex;align-items:center;justify-content:center;gap:28px}
  .word{display:inline-block;padding:18px 22px;border-radius:8px;border:1px dashed #e3e7ee;background:#fff;box-shadow:0 6px 14px rgba(20,30,60,0.03)}
  .current-word{display:flex;align-items:center}
  .sibling{font-size:2.6rem;color:#9aa4ae;font-weight:600;opacity:0.9}
  .sibling.prev{margin-right:6px}
  .sibling.next{margin-left:6px}
  .letter{display:inline-block;font-size:2.6rem;min-width:1ch;padding:0 3px;font-weight:600;color:#222;transition:color .08s ease, transform .08s ease}
  .letter.current{text-decoration:underline dotted rgba(0,0,0,0.12)}
  .letter.correct{color:#117a12}
  .letter.wrong{color:#a81b1b;transform:translateY(-2px);animation:flicker .16s linear}

  @keyframes flicker{0%{transform:translateY(-2px) scale(1.02)}50%{transform:translateY(0) scale(.98)}100%{transform:translateY(-2px) scale(1)}}

  .controls{margin-top:18px;display:flex;gap:8px;justify-content:center;align-items:center}
  .controls button{padding:3px 6px;border-radius:6px;border:1px solid #cfd9ea;background:#f8fbff;color:#065fd4;cursor:pointer;display:inline-flex;align-items:center;height:20px}
  .controls button.active, .controls button[aria-pressed="true"]{background:#065fd4;color:#fff;border-color:#065fd4}

  /* History: table-like rows with very subtle borders */
  .history{margin:2px auto 0;width:min(200px,100%);border-radius:4px;overflow:hidden;border:1px solid rgba(10,20,30,0.02);background:transparent;font-size:.86rem}
  .history-item{display:flex;justify-content:space-between;align-items:center;padding:2px 6px;border-bottom:1px solid rgba(10,20,30,0.02);background:#fff;gap:6px}
  .history-item:last-child{border-bottom:0}
  .history .cell.word{padding:0;font-weight:600;color:rgb(85, 85, 99);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:68%}
  .history .cell.time small{padding:0;color:#667;font-variant-numeric:tabular-nums;font-size:.78rem}

  @media (max-width:520px){
    .letter{font-size:2rem}
    .word{padding:12px 16px}
    .history{width:100%}
    .history-item{padding:6px 8px}
  }

  /* visual state when a draggable file is over the page */
  .mode.dragging{outline:3px dashed rgba(6,95,212,0.9);background:rgba(6,95,212,0.03)}

  .morse-buffer{margin-top:10px;color:#234;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;font-size:1rem;min-height:1.2em}
  .morse-buffer code{background:transparent;padding:2px 6px;border-radius:4px}
  .mode.morse-on{background:rgba(255, 180, 180, 0.356);transition:background .05s linear, .03s linear}
</style>
