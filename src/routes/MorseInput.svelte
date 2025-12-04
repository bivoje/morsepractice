<script lang="ts">
  import { MorseDecodeDouble, MorseDecodeTimed } from '$lib/morse';
  import type { InputResult } from '$lib/morse';


  let {
    letterInput,
    morseOnCallback = () => {},
    morseOffCallback = () => {},
  } = $props();

  let offTimerHandle: number | null = null;

  let currentCode: string = $state(''); // current morse code buffer display

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

  export function callMorseInput(key: string, pressed: boolean) {
    if (pressed) {
      setOffTimer(null);
    }

    const out = inputKey(key, pressed);
    console.log(`key ${pressed ? 'down' : 'up'}: ${key} -> morse output: "${out}"`);

    if (out.offTimer) {
      setOffTimer(out.offTimer);
    }

    // out may be a single character (or space). Feed each character into letterInput
    for (const ch of Array.from(out.char)) {
      letterInput(ch);
    }

    if (method === 'side') {
      currentCode = decodeSide.showIndex();
    } else if (method === 'straight') {
      currentCode = decodeStraight.showIndex();
    }
    return '';
  }

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
    morseOffCallback();
  }

  type InputMethod = 'raw' | 'straight' | 'side' | 'paddle' | 'iambic';

  let method: InputMethod = $state('straight');
  const decodeSide: MorseDecodeDouble = new MorseDecodeDouble(morseOnCallback_, morseOffCallback_);
  const decodeStraight: MorseDecodeTimed = new MorseDecodeTimed(morseOnCallback_, morseOffCallback_);

  function inputKey(key: string, pressed: boolean): InputResult {
    if (method === 'raw') {
      if (key === 'Backspace') {
        return { char: '\b', offTimer: 0 };
      }
      return { char: key, offTimer: 0 };

    } else if (method === 'side') {
      if (!pressed) return { char: '', offTimer: 0 };
      if (key === 'j') {
        decodeSide.commitDot();
        return { char: '', offTimer: 0 };
      }
      if (key === 'k') {
        decodeSide.commitDash();
        return { char: '', offTimer: 0 };
      }
      if (key === ' ' || key === 'Enter') {
        return { char: (decodeSide.forceEmit()) + ' ', offTimer: 0 };
      }
      return { char: '', offTimer: 0 };

    } else if (method === 'straight') {
      if (key === ' ' || key === 'Enter') {
        return { char: (decodeStraight.forceEmit()) + ' ', offTimer: 0 };
      }
      return decodeStraight.input(pressed);

    } else if (method === 'paddle') {
      // unimplemented methods return null for now
      return { char: '', offTimer: 0 };
    } else if (method === 'iambic') {
      // unimplemented methods return null for now
      return { char: '', offTimer: 0 };

    } else {
      throw new Error(`invalid input method: ${method}`);
    }
  }

  // words-per-minute control for timed morse input
  let wpm: number = $state(20);

  // Explicit updater for WPM — avoids Svelte reactive statements that are
  // disallowed in the current 'runes' mode. Call on slider input/change.
  function applyWpm() {
    decodeStraight.setWPM(wpm);
    decodeSide.setWPM(wpm);
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
    decodeSide.resetIndex();
    decodeStraight.resetIndex();
    method = (e.target as HTMLSelectElement).value as InputMethod;
  }} bind:value={method} aria-label="Morse input method selector">
    <option value="raw">Raw</option>
    <option value="side">Side</option>
    <option value="straight">Straight</option>
    <option value="paddle">Paddle</option>
    <option value="iambic">Iambic</option>
  </select>
</label>

<style>
  .morse-buffer{margin-top:10px;color:#234;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;font-size:1rem;min-height:1.2em}
  .morse-buffer code{background:transparent;padding:2px 6px;border-radius:4px}
</style>