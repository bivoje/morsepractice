<script lang="ts">
  import { MorseDecodeWinder, MorseDecodeStraight, MorseDecodeIambic } from '$lib/morse';


  let {
    emitCallback = (char: string) => {},
    morseOnCallback = () => {},
    morseOffCallback = () => {},
  } = $props();

  let currentCode: string = $state(''); // current morse code buffer display

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

  function morseOnCallback_() {
    startBeep();
    morseOnCallback();
  }

  function morseOffCallback_() {
    stopBeep();
    updateCurrentCode();
    morseOffCallback();
  }

  function emitCallback_(char: string) {
    updateCurrentCode();
    updateCurrentCode();
    emitCallback(char);
  }

  function updateCurrentCode() {
    if (method === 'winder') {
      currentCode = decodeWinder.showIndex();
    } else if (method === 'straight') {
      currentCode = decodeStraight.showIndex();
    } else if (method === 'iambic') {
      currentCode = decodeIambic.showIndex();
    } else {
      currentCode = '';
    }
  }

  type InputMethod = 'raw' | 'straight' | 'winder' | 'iambic';

  let method: InputMethod = $state('iambic');
  const decodeWinder: MorseDecodeWinder = new MorseDecodeWinder(morseOnCallback_, morseOffCallback_, emitCallback_);
  const decodeStraight: MorseDecodeStraight = new MorseDecodeStraight(morseOnCallback_, morseOffCallback_, emitCallback_);
  const decodeIambic: MorseDecodeIambic = new MorseDecodeIambic(morseOnCallback_, morseOffCallback_, emitCallback_);

  export function callMorseInput(key: string, pressed: boolean): void {
    if (method === 'raw') {
      if (!pressed) return;
      emitCallback_(key);

    } else if (method === 'winder') {
      if (!pressed) return;
      if (key == 'j') decodeWinder.input('.', true);
      if (key == 'k') decodeWinder.input('-', true);
      if (key == ' ' || key == 'Enter') {
        decodeWinder.forceEmit();
        emitCallback_(' ');
      }

    } else if (method === 'straight') {
      if (key === ' ' || key === 'Enter') {
        decodeStraight.forceEmit();
        emitCallback_(' ');
      } else {
        decodeStraight.input('', pressed);
      }

    } else if (method === 'iambic') {
      if (key == 'j') decodeIambic.input('.', pressed);
      if (key == 'k') decodeIambic.input('-', pressed);
      if ((key == ' ' || key == 'Enter') && !pressed) {
        decodeIambic.forceEmit();
        emitCallback_(' ');
      }

    } else {
      throw new Error(`invalid input method: ${method}`);
    }

    updateCurrentCode();
  }

  // words-per-minute control for timed morse input
  let wpm: number = $state(15);

  // Explicit updater for WPM — avoids Svelte reactive statements that are
  // disallowed in the current 'runes' mode. Call on slider input/change.
  function applyWpm() {
    decodeStraight.setWPM(wpm);
    decodeWinder.setWPM(wpm);
  }

  // Apply initial WPM immediately
  applyWpm();
</script>


<div class="morse-buffer" aria-hidden="true">
  <code>{currentCode}</code>
</div>

<label class="wpm-control">WPM:
  <input type="range" min="5" max="40" step="1" bind:value={wpm} oninput={applyWpm} aria-label="WPM slider" />
  <output>{wpm}</output>
</label>
<label class="input-method">Input:
  <select onchange={(e) => {
    decodeWinder.resetIndex();
    decodeStraight.resetIndex();
    method = (e.target as HTMLSelectElement).value as InputMethod;
  }} bind:value={method} aria-label="Morse input method selector">
    <option value="raw">Raw</option>
    <option value="winder">Winder</option>
    <option value="straight">Straight</option>
    <option value="iambic">Iambic</option>
  </select>
</label>

<style>
  .morse-buffer{margin-top:10px;color:#234;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;font-size:1rem;min-height:1.2em}
  .morse-buffer code{background:transparent;padding:2px 6px;border-radius:4px}
</style>